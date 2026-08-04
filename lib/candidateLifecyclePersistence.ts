import {
  previewCandidateLifecycleTransition,
} from "./candidateLifecycleEngine";
import {
  buildCandidateLifecycleRecord,
} from "./candidateLifecycle";
import type {
  CandidateLifecycleAction,
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "./recruiterWorkflowPersistence";
import {
  buildPersistedWorkflowStateFile,
} from "./recruiterWorkflowPersistence";
import {
  hydrateRecruiterWorkflow,
} from "./recruiterWorkflowStateHydration";
import {
  loadPersistedRecruiterWorkflowStore,
  writePersistedRecruiterWorkflowStoreAtomic,
} from "./recruiterWorkflowStore";
import type {
  RecruiterWorkflowActionType,
  RecruiterWorkflowStatus,
} from "./recruiterWorkflowTypes";

export type ExecuteLifecycleTransitionInput = {
  candidateId: string;
  toStage: CandidatePipelineStage;
  expectedStage?: CandidatePipelineStage;
  note?: string;
  dueAt?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  occurredAt?: string;
  execute: boolean;
  baseDir?: string;
};

const LEGACY_STATUS_BY_STAGE:
  Record<
    CandidatePipelineStage,
    RecruiterWorkflowStatus
  > = {
    sourced: "new_profile",
    screening: "validated",
    submitted: "submitted_to_client",
    interview: "interview_process",
    offer: "offer_process",
    hired: "placed",
    rejected: "rejected",
    on_hold: "archived",
  };

const LEGACY_ACTION_BY_LIFECYCLE:
  Record<
    CandidateLifecycleAction,
    RecruiterWorkflowActionType
  > = {
    review_profile: "validate_profile",
    contact_candidate: "validate_profile",
    complete_screening:
      "generate_submission",
    prepare_submission:
      "generate_submission",
    submit_to_client:
      "submit_to_client",
    follow_up_client:
      "update_client_feedback",
    schedule_interview:
      "schedule_interview",
    collect_interview_feedback:
      "update_candidate_feedback",
    prepare_offer:
      "move_to_offer",
    follow_up_offer:
      "update_candidate_feedback",
    complete_placement:
      "mark_placed",
    review_rejection:
      "mark_rejected",
    review_on_hold:
      "archive_candidate",
    no_action:
      "validate_profile",
  };

function lifecycleForState(
  state: PersistedWorkflowState,
) {
  return (
    state.lifecycle ||
    buildCandidateLifecycleRecord(
      {
        id: state.candidateId,
        name: state.displayName,
        status: state.currentStatus,
        updated_at:
          state.lastUpdatedAt,
      },
      {
        currentStatus:
          state.currentStatus,
        priority:
          state.priority,
        nextActionNote:
          state.auditNotes[0],
        lastUpdated:
          state.lastUpdatedAt,
      },
    )
  );
}

function initialStateFile(
  baseDir?: string,
) {
  const saved =
    loadPersistedRecruiterWorkflowStore(
      baseDir,
    );

  if (saved) return saved;

  const hydration =
    hydrateRecruiterWorkflow();

  return buildPersistedWorkflowStateFile(
    hydration.states,
    hydration.generatedAt,
  );
}

export function executeCandidateLifecycleTransition(
  input: ExecuteLifecycleTransitionInput,
) {
  const file =
    initialStateFile(input.baseDir);

  const stateIndex =
    file.states.findIndex(
      (state) =>
        state.candidateId ===
        input.candidateId,
    );

  if (stateIndex < 0) {
    return {
      ok: false,
      status: 404,
      error:
        "Candidate workflow state not found",
    };
  }

  const currentState =
    file.states[stateIndex];

  const lifecycle =
    lifecycleForState(currentState);

  if (
    input.expectedStage &&
    lifecycle.stage !==
      input.expectedStage
  ) {
    return {
      ok: false,
      status: 409,
      error:
        "Workflow state changed after preview.",
      expectedStage:
        input.expectedStage,
      actualStage:
        lifecycle.stage,
    };
  }

  const decision =
    previewCandidateLifecycleTransition({
      lifecycle,
      toStage: input.toStage,
      note: input.note,
      dueAt: input.dueAt,
      actorId: input.actorId,
      actorName: input.actorName,
      occurredAt: input.occurredAt,
    });

  if (
    !input.execute ||
    !decision.allowed ||
    !decision.next
  ) {
    return {
      ok: decision.allowed,
      status:
        decision.allowed ? 200 : 422,
      executed: false,
      decision,
      safetyNote:
        "Preview only. Workflow state was not written.",
    };
  }

  const nextLifecycle =
    decision.next;

  const legacyStatus =
    LEGACY_STATUS_BY_STAGE[
      nextLifecycle.stage
    ];

  const legacyAction =
    LEGACY_ACTION_BY_LIFECYCLE[
      nextLifecycle.nextAction
    ];

  const updatedState:
    PersistedWorkflowState = {
      ...currentState,
      previousStatus:
        currentState.currentStatus,
      currentStatus:
        legacyStatus,
      recommendedNextAction:
        legacyAction,
      lastUpdatedAt:
        nextLifecycle.updatedAt,
      source:
        "workflow_inference",
      lifecycle:
        nextLifecycle,
      readyForShortlist:
        nextLifecycle.stage ===
        "screening",
      clientSubmissionBlocked:
        ![
          "screening",
          "submitted",
          "interview",
          "offer",
          "hired",
        ].includes(
          nextLifecycle.stage,
        ),
      auditNotes: [
        decision.event?.note ||
          `Lifecycle changed to ${nextLifecycle.stage}.`,
        ...currentState.auditNotes,
      ],
    };

  const states = [
    ...file.states,
  ];

  states[stateIndex] =
    updatedState;

  const generatedAt =
    nextLifecycle.updatedAt;

  const updatedFile =
    buildPersistedWorkflowStateFile(
      states,
      generatedAt,
    );

  const writeResult =
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
    decision,
    persistence: {
      path:
        writeResult.path,
      backupPath:
        writeResult.backupPath,
      atomicWrite:
        writeResult.atomicWrite,
      candidateDbWrites: 0,
    },
  };
}