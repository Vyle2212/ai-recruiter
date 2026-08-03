import type { CandidateLifecycleRecord } from "./candidateLifecycleTypes";
import { actionForStatus } from "./recruiterWorkflowRules";
import type { RecruiterActionQueueItem, RecruiterWorkflowActionType, RecruiterWorkflowStatus, WorkflowPriority, WorkflowSummary } from "./recruiterWorkflowTypes";

export type PersistedWorkflowState = {
  candidateId: string;
  displayName: string;
  currentStatus: RecruiterWorkflowStatus;
  previousStatus?: RecruiterWorkflowStatus;
  priority: WorkflowPriority;
  recommendedNextAction: RecruiterWorkflowActionType;
  allowedActions: RecruiterWorkflowActionType[];
  blockedActions: RecruiterWorkflowActionType[];
  blockerReasons: string[];
  missingFields: string[];
  validationStatus: string;
  profileQualityStatus: string;
  aiReviewStatus: string;
  stagingStatus: string;
  applyHistoryStatus: string;
  readyForShortlist: boolean;
  clientSubmissionBlocked: boolean;
  lastInferredAt: string;
  lastUpdatedAt: string;
  source: "workflow_inference";
  auditNotes: string[];
  lifecycle?: CandidateLifecycleRecord;
  stale?: boolean;
};

export type PersistedWorkflowStateFile = {
  mode: string;
  generatedAt: string;
  totalCandidates: number;
  summary: PersistedWorkflowStateSummary;
  states: PersistedWorkflowState[];
};

export type PersistedWorkflowStateSummary = {
  generatedAt: string;
  totalCandidates: number;
  statusCounts: Record<RecruiterWorkflowStatus, number>;
  actionCounts: Record<string, number>;
  highPriorityActions: number;
  mediumPriorityActions: number;
  lowPriorityActions: number;
  blockedCandidates: number;
  readyForShortlist: number;
  needsRepair: number;
  needsValidation: number;
  aiReviewNeeded: number;
};

const ALL_ACTIONS: RecruiterWorkflowActionType[] = ["validate_profile", "review_ai_extraction", "repair_missing_data", "compare_candidate", "add_to_shortlist", "generate_submission", "submit_to_client", "schedule_interview", "update_client_feedback", "update_candidate_feedback", "move_to_offer", "mark_placed", "mark_rejected", "archive_candidate"];
const ALL_STATUSES: RecruiterWorkflowStatus[] = ["new_profile", "needs_validation", "validation_in_progress", "validated", "needs_repair", "ai_review_needed", "ready_for_shortlist", "shortlisted", "submitted_to_client", "client_review", "interview_process", "offer_process", "placed", "rejected", "archived"];

function counts<T extends string>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item, 0])) as Record<T, number>;
}

function queueFor(candidateId: string, actionQueue: RecruiterActionQueueItem[]) {
  return actionQueue.find((item) => item.candidateId === candidateId);
}

function allowedActionsFor(status: RecruiterWorkflowStatus, recommended: RecruiterWorkflowActionType): RecruiterWorkflowActionType[] {
  if (["placed", "rejected", "archived"].includes(status)) return [];
  return Array.from(new Set([recommended, "mark_rejected", "archive_candidate"]));
}

export function buildPersistedWorkflowStates(audit: { generatedAt: string; states: any[]; actionQueue: RecruiterActionQueueItem[] }, previous: PersistedWorkflowState[] = []): PersistedWorkflowState[] {
  const previousById = new Map(previous.map((state) => [state.candidateId, state]));
  return audit.states.map((state) => {
    const action = queueFor(state.candidateId, audit.actionQueue);
    const recommended = action?.recommendedNextAction || actionForStatus(state.status);
    const priority = action?.priority || "low";
    const allowedActions = allowedActionsFor(state.status, recommended);
    const blockerReasons = [...(state.validationBlockers || []), ...(state.reasons || []).filter((reason: string) => /missing|blocked|repair|validation|duplicate|reupload/i.test(reason))];
    const previousState = previousById.get(state.candidateId);
    return {
      candidateId: state.candidateId,
      displayName: state.candidateName,
      currentStatus: state.status,
      previousStatus: previousState?.currentStatus,
      priority,
      recommendedNextAction: recommended,
      allowedActions,
      blockedActions: ALL_ACTIONS.filter((item) => !allowedActions.includes(item)),
      blockerReasons,
      missingFields: state.missingData || [],
      validationStatus: state.validationBlockers?.length ? "blocked" : state.status === "needs_validation" ? "needs_validation" : "validated_or_pending_review",
      profileQualityStatus: state.missingData?.length ? `Missing ${state.missingData.join(", ")}` : "Profile quality usable",
      aiReviewStatus: state.status === "ai_review_needed" ? "ai_review_needed" : "no_ai_review_blocker",
      stagingStatus: "not_staged_by_workflow",
      applyHistoryStatus: "not_applied_by_workflow",
      readyForShortlist: state.status === "ready_for_shortlist",
      clientSubmissionBlocked: state.status !== "shortlisted" && state.status !== "ready_for_shortlist",
      lastInferredAt: audit.generatedAt,
      lastUpdatedAt: new Date().toISOString(),
      source: "workflow_inference" as const,
      auditNotes: state.reasons || [],
    };
  });
}

export function summarizePersistedWorkflowStates(states: PersistedWorkflowState[], generatedAt = new Date().toISOString()): PersistedWorkflowStateSummary {
  const statusCounts = counts(ALL_STATUSES);
  const actionCounts: Record<string, number> = {};
  for (const state of states) {
    statusCounts[state.currentStatus] += 1;
    actionCounts[state.recommendedNextAction] = (actionCounts[state.recommendedNextAction] || 0) + 1;
  }
  return {
    generatedAt,
    totalCandidates: states.length,
    statusCounts,
    actionCounts,
    highPriorityActions: states.filter((state) => state.priority === "high").length,
    mediumPriorityActions: states.filter((state) => state.priority === "medium").length,
    lowPriorityActions: states.filter((state) => state.priority === "low").length,
    blockedCandidates: states.filter((state) => state.blockerReasons.length || state.clientSubmissionBlocked).length,
    readyForShortlist: statusCounts.ready_for_shortlist,
    needsRepair: statusCounts.needs_repair,
    needsValidation: statusCounts.needs_validation,
    aiReviewNeeded: statusCounts.ai_review_needed,
  };
}

export function buildPersistedWorkflowStateFile(states: PersistedWorkflowState[], generatedAt = new Date().toISOString()): PersistedWorkflowStateFile {
  return {
    mode: "local workflow state only; no candidate DB writes; no delete; no OpenAI calls",
    generatedAt,
    totalCandidates: states.length,
    summary: summarizePersistedWorkflowStates(states, generatedAt),
    states,
  };
}

export { ALL_ACTIONS, ALL_STATUSES };
