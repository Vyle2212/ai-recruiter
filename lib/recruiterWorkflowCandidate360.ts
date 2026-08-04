import { evaluateWorkflowAction } from "./recruiterWorkflowActions";
import { inferWorkflowStatus, workflowCandidateId, workflowCandidateName } from "./recruiterWorkflowState";
import type { Candidate360WorkflowPanel } from "./recruiterWorkflowTypes";

export function buildCandidate360WorkflowPanel(candidate: Record<string, any>, context: { auditIssues?: any[]; reviewReport?: any; applyHistory?: any; localState?: any; actionQueue?: any[] } = {}): Candidate360WorkflowPanel {
  const state = inferWorkflowStatus(candidate, context);
  const candidateId = workflowCandidateId(candidate);
  const recommended = (context.actionQueue || []).filter((item) => item.candidateId === candidateId);
  const actions = ["validate_profile", "review_ai_extraction", "repair_missing_data", "compare_candidate", "add_to_shortlist", "generate_submission", "submit_to_client", "schedule_interview", "update_client_feedback", "update_candidate_feedback", "move_to_offer", "mark_placed", "mark_rejected", "archive_candidate"].map((action) => evaluateWorkflowAction(candidate, state, action as any));
  return {
    candidateId,
    candidateName: workflowCandidateName(candidate),
    currentWorkflowStatus: state.status,
    profileQualityStatus: state.missingData.length ? `Missing ${state.missingData.join(", ")}` : "Profile quality is usable",
    validationStatus: state.validationBlockers.length ? "Validation blockers present" : state.status === "needs_validation" ? "Needs validation" : "Validated or ready for review",
    aiExtractionReviewStatus: state.status === "ai_review_needed" ? "AI extraction review needed" : "No AI review blocker",
    stagingApplyHistoryStatus: (context.applyHistory?.items || []).some((item: any) => item.candidateId === candidateId) ? "Apply history available" : "No staged apply history",
    recommendedNextActions: recommended,
    allowedActions: actions.filter((action) => action.allowed),
    blockedActions: actions.filter((action) => !action.allowed),
    timeline: [
      { at: state.lastUpdated, event: "workflow_status_inferred", note: state.reasons.join("; ") },
      ...(recommended.length ? [{ at: state.lastUpdated, event: "action_recommended", note: recommended.map((item) => item.recommendedNextAction).join(", ") }] : []),
    ],
    safetyNote: "Workflow panel is dry-run by default and does not update candidate records.",
  };
}
