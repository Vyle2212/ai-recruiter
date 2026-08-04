import {
  CANDIDATE_PIPELINE_STAGES,
  type CandidateLifecycleAction,
  type CandidateLifecycleRecord,
  type CandidatePipelineStage,
} from "./candidateLifecycleTypes";

type AnyRecord = Record<string, unknown>;

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isCandidatePipelineStage(
  value: unknown,
): value is CandidatePipelineStage {
  return CANDIDATE_PIPELINE_STAGES.includes(
    normalized(value) as CandidatePipelineStage,
  );
}

export function mapLegacyStatusToPipelineStage(
  value: unknown,
): CandidatePipelineStage {
  const status = normalized(value);

  if (
    [
      "placed",
      "hired",
      "accepted",
      "joined",
      "onboarded",
    ].includes(status)
  ) {
    return "hired";
  }

  if (
    [
      "offer",
      "offered",
      "offer_process",
      "offer_stage",
    ].includes(status)
  ) {
    return "offer";
  }

  if (
    [
      "interview",
      "interviewed",
      "interview_process",
      "interviewing",
    ].includes(status)
  ) {
    return "interview";
  }

  if (
    [
      "submitted",
      "submitted_to_client",
      "client_review",
      "shortlisted",
    ].includes(status)
  ) {
    return "submitted";
  }

  if (
    [
      "screening",
      "screened",
      "validated",
      "validation_in_progress",
      "ready_for_shortlist",
    ].includes(status)
  ) {
    return "screening";
  }

  if (
    [
      "rejected",
      "declined",
      "not_selected",
    ].includes(status)
  ) {
    return "rejected";
  }

  if (
    [
      "on_hold",
      "hold",
      "paused",
      "archived",
    ].includes(status)
  ) {
    return "on_hold";
  }

  return "sourced";
}

export function getDefaultNextAction(
  stage: CandidatePipelineStage,
): CandidateLifecycleAction {
  switch (stage) {
    case "sourced":
      return "review_profile";
    case "screening":
      return "complete_screening";
    case "submitted":
      return "follow_up_client";
    case "interview":
      return "collect_interview_feedback";
    case "offer":
      return "follow_up_offer";
    case "hired":
      return "complete_placement";
    case "rejected":
      return "review_rejection";
    case "on_hold":
      return "review_on_hold";
  }
}

export function buildCandidateLifecycleRecord(
  candidate: AnyRecord,
  workflowState?: AnyRecord,
): CandidateLifecycleRecord {
  const candidateId = clean(
    candidate.id ?? candidate.candidate_id,
  );

  const candidateName =
    clean(
      candidate.name ??
        candidate.display_name ??
        candidate.full_name ??
        candidate.candidate_name,
    ) || "Unnamed candidate";

  const rawStatus =
    workflowState?.stage ??
    workflowState?.currentStatus ??
    workflowState?.status ??
    candidate.pipeline_stage ??
    candidate.candidate_status ??
    candidate.stage ??
    candidate.status;

  const stage = mapLegacyStatusToPipelineStage(
    rawStatus,
  );

  const updatedAt =
    clean(
      workflowState?.updatedAt ??
        workflowState?.lastUpdated ??
        candidate.updated_at ??
        candidate.created_at,
    ) || new Date(0).toISOString();

  return {
    lifecycleId: `candidate-lifecycle:${candidateId}`,
    candidateId,
    candidateName,

    ownerId:
      clean(
        workflowState?.ownerId ??
          candidate.recruiter_id ??
          candidate.owner_id,
      ) || null,

    ownerName:
      clean(
        workflowState?.ownerName ??
          candidate.recruiter_name ??
          candidate.owner_name,
      ) || null,

    stage,
    previousStage: null,

    nextAction: getDefaultNextAction(stage),

    nextActionNote:
      clean(
        workflowState?.nextActionNote ??
          workflowState?.reason,
      ) || `Review candidate at ${stage} stage.`,

    nextActionDueAt:
      clean(
        workflowState?.nextActionDueAt ??
          workflowState?.dueDate,
      ) || null,

    priority:
      workflowState?.priority === "high" ||
      workflowState?.priority === "medium" ||
      workflowState?.priority === "low"
        ? workflowState.priority
        : "medium",

    source: "inferred",

    lastActivityAt:
      clean(
        workflowState?.lastActivityAt ??
          workflowState?.lastUpdated ??
          candidate.updated_at,
      ) || null,

    createdAt:
      clean(candidate.created_at) ||
      new Date(0).toISOString(),

    updatedAt,

    history: [],
  };
}