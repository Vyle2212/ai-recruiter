export type RecruiterWorkflowStatus =
  | "new_profile"
  | "needs_validation"
  | "validation_in_progress"
  | "validated"
  | "needs_repair"
  | "ai_review_needed"
  | "ready_for_shortlist"
  | "shortlisted"
  | "submitted_to_client"
  | "client_review"
  | "interview_process"
  | "offer_process"
  | "placed"
  | "rejected"
  | "archived";

export type RecruiterWorkflowActionType =
  | "validate_profile"
  | "review_ai_extraction"
  | "repair_missing_data"
  | "compare_candidate"
  | "add_to_shortlist"
  | "generate_submission"
  | "submit_to_client"
  | "schedule_interview"
  | "update_client_feedback"
  | "update_candidate_feedback"
  | "move_to_offer"
  | "mark_placed"
  | "mark_rejected"
  | "archive_candidate";

export type WorkflowPriority = "high" | "medium" | "low";

export type RecruiterWorkflowState = {
  workflowId: string;
  candidateId: string;
  candidateName: string;
  status: RecruiterWorkflowStatus;
  source: "inferred" | "local_state";
  reasons: string[];
  missingData: string[];
  validationBlockers: string[];
  lastUpdated: string;
};

export type RecruiterActionQueueItem = {
  actionId: string;
  candidateId: string;
  candidateName: string;
  currentStatus: RecruiterWorkflowStatus;
  recommendedNextAction: RecruiterWorkflowActionType;
  reason: string;
  priority: WorkflowPriority;
  missingData: string[];
  lastUpdated: string;
  safetyNote: string;
};

export type WorkflowActionDecision = {
  action: RecruiterWorkflowActionType;
  allowed: boolean;
  reasons: string[];
  previewOnly: boolean;
};

export type WorkflowAuditReport = {
  generatedAt: string;
  mode: string;
  totalCandidates: number;
  summary: WorkflowSummary;
  states: RecruiterWorkflowState[];
  actionQueue: RecruiterActionQueueItem[];
  blockedCandidates: RecruiterWorkflowState[];
  files: Record<string, { path: string; found: boolean }>;
};

export type WorkflowSummary = {
  newProfiles: number;
  needsValidation: number;
  validationInProgress: number;
  validated: number;
  needsRepair: number;
  aiReviewNeeded: number;
  readyForShortlist: number;
  shortlisted: number;
  submitted: number;
  clientReview: number;
  interviewProcess: number;
  offerProcess: number;
  placed: number;
  rejected: number;
  archived: number;
  actionRequiredToday: number;
  highPriorityActions: number;
  mediumPriorityActions: number;
  lowPriorityActions: number;
  blockedCandidates: number;
};

export type Candidate360WorkflowPanel = {
  candidateId: string;
  candidateName: string;
  currentWorkflowStatus: RecruiterWorkflowStatus;
  profileQualityStatus: string;
  validationStatus: string;
  aiExtractionReviewStatus: string;
  stagingApplyHistoryStatus: string;
  recommendedNextActions: RecruiterActionQueueItem[];
  allowedActions: WorkflowActionDecision[];
  blockedActions: WorkflowActionDecision[];
  timeline: Array<{ at: string; event: string; note: string }>;
  safetyNote: string;
};
