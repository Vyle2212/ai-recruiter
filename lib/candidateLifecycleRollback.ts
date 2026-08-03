import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";
import {
  buildPersistedWorkflowStateFile,
} from "./recruiterWorkflowPersistence";
import {
  loadPersistedRecruiterWorkflowStore,
  writePersistedRecruiterWorkflowStoreAtomic,
} from "./recruiterWorkflowStore";
import {
  mapLegacyStatusToPipelineStage,
  getDefaultNextAction,
} from "./candidateLifecycle";
import type {
  RecruiterWorkflowStatus,
} from "./recruiterWorkflowTypes";

export type RollbackLifecycleInput = {
  candidateId: string;
  expectedStage?: CandidatePipelineStage;
  actorId?: string | null;
  actorName?: string | null;
  note?: string;
  occurredAt?: string;
  execute: boolean;
  baseDir?: string;
};

const LEGACY_STATUS_BY_STAGE:
  Record<CandidatePipelineStage, RecruiterWorkflowStatus> = {
    sourced: "new_profile",
    screening: "validated",
    submitted: "submitted_to_client",
    interview: "interview_process",
    offer: "offer_process",
    hired: "placed",
    rejected: "rejected",
    on_hold: "archived",
  };

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function lifecycleFromState(
  state: PersistedWorkflowState,
): CandidateLifecycleRecord {
  if (state.lifecycle) return state.lifecycle;

  const stage = mapLegacyStatusToPipelineStage(
    state.currentStatus,
  );

  return {
    lifecycleId:
      `candidate-lifecycle:${state.candidateId}`,
    candidateId: state.candidateId,
    candidateName: state.displayName,
    ownerId: null,
    ownerName: null,
    stage,
    previousStage: state.previousStatus
      ? mapLegacyStatusToPipelineStage(
          state.previousStatus,
        )
      : null,
    nextAction: getDefaultNextAction(stage),
    nextActionNote:
      state.auditNotes[0] ||
      `Review candidate at ${stage} stage.`,
    nextActionDueAt: null,
    priority: state.priority,
    source: "inferred",
    lastActivityAt: state.lastUpdatedAt,
    createdAt: state.lastInferredAt,
    updatedAt: state.lastUpdatedAt,
    history: [],
  };
}

export function rollbackCandidateLifecycleTransition(
  input: RollbackLifecycleInput,
) {
  const file =
    loadPersistedRecruiterWorkflowStore(
      input.baseDir,
    );

  if (!file) {
    return {
      ok: false,
      status: 404,
      error:
        "Persisted workflow state not found",
    };
  }

  const index = file.states.findIndex(
    (state) =>
      state.candidateId ===
      input.candidateId,
  );

  if (index < 0) {
    return {
      ok: false,
      status: 404,
      error:
        "Candidate workflow state not found",
    };
  }

  const currentState =
    file.states[index];

  const lifecycle =
    lifecycleFromState(currentState);

  if (
    input.expectedStage &&
    lifecycle.stage !== input.expectedStage
  ) {
    return {
      ok: false,
      status: 409,
      error:
        "Workflow state changed before rollback.",
      expectedStage:
        input.expectedStage,
      actualStage:
        lifecycle.stage,
    };
  }

  const previousStage =
    lifecycle.previousStage;

  if (!previousStage) {
    return {
      ok: false,
      status: 422,
      error:
        "No previous lifecycle stage is available.",
    };
  }

  const occurredAt =
    input.occurredAt ||
    new Date().toISOString();

  const event:
    CandidateLifecycleEvent = {
      eventId:
        `lifecycle-rollback:${input.candidateId}:${occurredAt}`,
      candidateId:
        input.candidateId,
      fromStage:
        lifecycle.stage,
      toStage:
        previousStage,
      action:
        getDefaultNextAction(previousStage),
      note:
        clean(input.note) ||
        `Rollback from ${lifecycle.stage} to ${previousStage}.`,
      source:
        "recruiter_updated",
      actorId:
        input.actorId || null,
      actorName:
        input.actorName || null,
      occurredAt,
    };

  const nextLifecycle:
    CandidateLifecycleRecord = {
      ...lifecycle,
      previousStage:
        lifecycle.stage,
      stage:
        previousStage,
      nextAction:
        getDefaultNextAction(
          previousStage,
        ),
      nextActionNote:
        event.note,
      nextActionDueAt:
        null,
      source:
        "recruiter_updated",
      lastActivityAt:
        occurredAt,
      updatedAt:
        occurredAt,
      history: [
        ...lifecycle.history,
        event,
      ],
    };

  if (!input.execute) {
    return {
      ok: true,
      status: 200,
      executed: false,
      lifecycle:
        nextLifecycle,
      event,
      safetyNote:
        "Rollback preview only. Workflow state was not written.",
    };
  }

  const updatedState:
    PersistedWorkflowState = {
      ...currentState,
      previousStatus:
        currentState.currentStatus,
      currentStatus:
        LEGACY_STATUS_BY_STAGE[
          previousStage
        ],
      lastUpdatedAt:
        occurredAt,
      lifecycle:
        nextLifecycle,
      auditNotes: [
        event.note,
        ...currentState.auditNotes,
      ],
    };

  const states =
    [...file.states];

  states[index] =
    updatedState;

  const updatedFile =
    buildPersistedWorkflowStateFile(
      states,
      occurredAt,
    );

  const write =
    writePersistedRecruiterWorkflowStoreAtomic(
      updatedFile,
      input.baseDir,
    );

  return {
    ok: true,
    status: 200,
    executed: true,
    candidateId:
      input.candidateId,
    previous:
      lifecycle,
    lifecycle:
      nextLifecycle,
    event,
    persistence: {
      path:
        write.path,
      backupPath:
        write.backupPath,
      atomicWrite:
        write.atomicWrite,
      candidateDbWrites: 0,
    },
  };
}