import {
  getDefaultNextAction,
} from "./candidateLifecycle";
import {
  findCandidateLifecycleTransition,
  getAllowedLifecycleTransitions,
} from "./candidateLifecycleTransitions";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";

export type CandidateLifecycleTransitionInput = {
  lifecycle: CandidateLifecycleRecord;
  toStage: CandidatePipelineStage;
  note?: string;
  dueAt?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  occurredAt?: string;
};

export type CandidateLifecycleTransitionDecision = {
  allowed: boolean;
  previewOnly: true;
  blockers: string[];
  warnings: string[];
  previous: CandidateLifecycleRecord;
  next: CandidateLifecycleRecord | null;
  event: CandidateLifecycleEvent | null;
  allowedTransitions: CandidatePipelineStage[];
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(value: string | null | undefined) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function previewCandidateLifecycleTransition(
  input: CandidateLifecycleTransitionInput,
): CandidateLifecycleTransitionDecision {
  const {
    lifecycle,
    toStage,
  } = input;

  const blockers: string[] = [];
  const warnings: string[] = [];

  const rule = findCandidateLifecycleTransition(
    lifecycle.stage,
    toStage,
  );

  if (!rule) {
    blockers.push(
      `Transition from ${lifecycle.stage} to ${toStage} is not allowed.`,
    );
  }

  if (lifecycle.stage === toStage) {
    blockers.push(
      "Candidate is already in the requested stage.",
    );
  }

  const note = clean(input.note);

  if (rule?.requiresNote && !note) {
    blockers.push(
      "A transition note is required.",
    );
  }

  if (
    rule?.requiresDueDate &&
    !validDate(input.dueAt)
  ) {
    blockers.push(
      "A valid due date is required.",
    );
  }

  if (
    input.dueAt &&
    !validDate(input.dueAt)
  ) {
    blockers.push(
      "The supplied due date is invalid.",
    );
  }

  if (!input.actorId && !input.actorName) {
    warnings.push(
      "No actor identity was supplied for the preview.",
    );
  }

  if (blockers.length || !rule) {
    return {
      allowed: false,
      previewOnly: true,
      blockers,
      warnings,
      previous: lifecycle,
      next: null,
      event: null,
      allowedTransitions:
        getAllowedLifecycleTransitions(
          lifecycle.stage,
        ).map((item) => item.to),
    };
  }

  const occurredAt =
    input.occurredAt ||
    new Date().toISOString();

  const event: CandidateLifecycleEvent = {
    eventId:
      `lifecycle-event:${lifecycle.candidateId}:${occurredAt}`,
    candidateId: lifecycle.candidateId,
    fromStage: lifecycle.stage,
    toStage,
    action: rule.action,
    note:
      note ||
      `Move candidate from ${lifecycle.stage} to ${toStage}.`,
    source: "recruiter_updated",
    actorId: input.actorId || null,
    actorName: input.actorName || null,
    occurredAt,
  };

  const next: CandidateLifecycleRecord = {
    ...lifecycle,
    previousStage: lifecycle.stage,
    stage: toStage,
    nextAction: getDefaultNextAction(toStage),
    nextActionNote:
      note ||
      `Review candidate at ${toStage} stage.`,
    nextActionDueAt:
      input.dueAt || null,
    source: "recruiter_updated",
    lastActivityAt: occurredAt,
    updatedAt: occurredAt,
    history: [
      ...lifecycle.history,
      event,
    ],
  };

  return {
    allowed: true,
    previewOnly: true,
    blockers: [],
    warnings,
    previous: lifecycle,
    next,
    event,
    allowedTransitions:
      getAllowedLifecycleTransitions(
        toStage,
      ).map((item) => item.to),
  };
}