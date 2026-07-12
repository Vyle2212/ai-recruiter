import type { RecruiterWorkflowActionType, RecruiterWorkflowStatus } from "./recruiterWorkflowTypes";

const FINAL_STATUSES = new Set<RecruiterWorkflowStatus>(["placed", "rejected", "archived"]);

export const ALLOWED_WORKFLOW_TRANSITIONS: Record<RecruiterWorkflowStatus, RecruiterWorkflowStatus[]> = {
  new_profile: ["needs_validation", "rejected", "archived"],
  needs_validation: ["validation_in_progress", "rejected", "archived"],
  validation_in_progress: ["validated", "needs_repair", "rejected", "archived"],
  validated: ["ai_review_needed", "ready_for_shortlist", "rejected", "archived"],
  needs_repair: ["validation_in_progress", "rejected", "archived"],
  ai_review_needed: ["validated", "rejected", "archived"],
  ready_for_shortlist: ["shortlisted", "rejected", "archived"],
  shortlisted: ["submitted_to_client", "rejected", "archived"],
  submitted_to_client: ["client_review", "rejected", "archived"],
  client_review: ["interview_process", "rejected", "archived"],
  interview_process: ["offer_process", "rejected", "archived"],
  offer_process: ["placed", "rejected", "archived"],
  placed: [],
  rejected: [],
  archived: [],
};

export function canTransitionWorkflow(from: RecruiterWorkflowStatus, to: RecruiterWorkflowStatus, options: { override?: boolean; restore?: boolean; reopen?: boolean } = {}) {
  if (from === to) return { allowed: true, reasons: ["No status change"] };
  if (from === "placed") return options.override ? { allowed: true, reasons: ["Explicit override allows placed status change"] } : { allowed: false, reasons: ["Placed candidates cannot move backward without explicit override"] };
  if (from === "archived") return options.restore ? { allowed: true, reasons: ["Explicit restore allows archived status change"] } : { allowed: false, reasons: ["Archived candidates cannot move forward without explicit restore"] };
  if (from === "rejected") return options.reopen ? { allowed: true, reasons: ["Explicit reopen allows rejected status change"] } : { allowed: false, reasons: ["Rejected candidates cannot move forward without explicit reopen"] };
  if (FINAL_STATUSES.has(from) && !options.override && !options.restore && !options.reopen) return { allowed: false, reasons: ["Final status requires explicit override"] };
  const allowed = ALLOWED_WORKFLOW_TRANSITIONS[from]?.includes(to) || false;
  return { allowed, reasons: allowed ? ["Allowed workflow transition"] : [`Transition ${from} to ${to} is not allowed`] };
}

export function actionForStatus(status: RecruiterWorkflowStatus): RecruiterWorkflowActionType {
  if (status === "new_profile" || status === "needs_validation") return "validate_profile";
  if (status === "validation_in_progress") return "validate_profile";
  if (status === "needs_repair") return "repair_missing_data";
  if (status === "ai_review_needed") return "review_ai_extraction";
  if (status === "validated") return "compare_candidate";
  if (status === "ready_for_shortlist") return "add_to_shortlist";
  if (status === "shortlisted") return "generate_submission";
  if (status === "submitted_to_client") return "update_client_feedback";
  if (status === "client_review") return "schedule_interview";
  if (status === "interview_process") return "move_to_offer";
  if (status === "offer_process") return "mark_placed";
  return "validate_profile";
}
