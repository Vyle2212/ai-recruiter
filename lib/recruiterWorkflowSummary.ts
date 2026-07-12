import type { RecruiterActionQueueItem, RecruiterWorkflowState, WorkflowSummary } from "./recruiterWorkflowTypes";

export function summarizeWorkflow(states: RecruiterWorkflowState[], actionQueue: RecruiterActionQueueItem[]): WorkflowSummary {
  const count = (status: string) => states.filter((state) => state.status === status).length;
  return {
    newProfiles: count("new_profile"),
    needsValidation: count("needs_validation"),
    validationInProgress: count("validation_in_progress"),
    validated: count("validated"),
    needsRepair: count("needs_repair"),
    aiReviewNeeded: count("ai_review_needed"),
    readyForShortlist: count("ready_for_shortlist"),
    shortlisted: count("shortlisted"),
    submitted: count("submitted_to_client"),
    clientReview: count("client_review"),
    interviewProcess: count("interview_process"),
    offerProcess: count("offer_process"),
    placed: count("placed"),
    rejected: count("rejected"),
    archived: count("archived"),
    actionRequiredToday: actionQueue.length,
    highPriorityActions: actionQueue.filter((item) => item.priority === "high").length,
    mediumPriorityActions: actionQueue.filter((item) => item.priority === "medium").length,
    lowPriorityActions: actionQueue.filter((item) => item.priority === "low").length,
    blockedCandidates: states.filter((state) => state.validationBlockers.length || state.status === "needs_repair").length,
  };
}
