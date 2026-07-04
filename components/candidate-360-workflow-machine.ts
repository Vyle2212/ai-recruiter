export const CANDIDATE_WORKFLOW_STAGES = [
  "Research",
  "AI Assessment",
  "Recruiter Validation",
  "Ready for Client Submission",
  "Client Review",
  "Interview",
  "Offer",
  "Placement",
] as const;

export type CandidateWorkflowStage = (typeof CANDIDATE_WORKFLOW_STAGES)[number];
export type CandidateWorkflowStageStatus = "Locked" | "Active" | "Current" | "Blocked" | "Waiting" | "Completed";

export type CandidateWorkflowSnapshot = {
  candidateId: string;
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  criticalRemaining: number;
  importantRemaining: number;
  optionalRemaining: number;
  remainingEffort: number;
  allComplete: boolean;
  currentStage: CandidateWorkflowStage;
  stage: CandidateWorkflowStage;
  stageStatuses: Record<CandidateWorkflowStage, CandidateWorkflowStageStatus>;
  submissionStatus: string;
  statusReason: string;
  nextBestAction: string;
  nextActionId: string;
  nextActionLabel: string;
  blockers: string[];
  completedIds: string[];
  validationCompletedIds: string[];
  actionCompletedIds: string[];
};

type DeriveWorkflowInput = {
  candidateId: string;
  totalCount: number;
  validationCompletedIds: string[];
  actionCompletedIds: string[];
  pendingValidationIds: string[];
  remainingCount: number;
  criticalRemaining: number;
  importantRemaining: number;
  optionalRemaining: number;
  remainingEffort: number;
  initialStatus: string;
  blockers: string[];
  requestedStage?: string;
};

export function storageKey(candidateId: string) {
  return "candidate360-workflow-" + candidateId;
}

export function isCandidateWorkflowStage(value: string | undefined): value is CandidateWorkflowStage {
  return Boolean(value && (CANDIDATE_WORKFLOW_STAGES as readonly string[]).includes(value));
}

function stageIndex(stage: CandidateWorkflowStage) {
  return CANDIDATE_WORKFLOW_STAGES.indexOf(stage);
}

function normalizeRequestedStage(requestedStage: string | undefined, allComplete: boolean): CandidateWorkflowStage {
  if (!allComplete) return "Recruiter Validation";
  if (isCandidateWorkflowStage(requestedStage) && stageIndex(requestedStage) >= stageIndex("Ready for Client Submission")) {
    return requestedStage;
  }
  return "Ready for Client Submission";
}

function submissionStatusFor(stage: CandidateWorkflowStage, criticalRemaining: number, importantRemaining: number, initialStatus: string) {
  if (stage === "Client Review") return "Submitted to Client";
  if (stage === "Interview") return "Interview Scheduled";
  if (stage === "Offer") return "Offer in Progress";
  if (stage === "Placement") return "Placed";
  if (stage === "Ready for Client Submission") return "Ready for Client Submission";
  if (criticalRemaining > 0) return initialStatus || "Submission Blocked";
  if (importantRemaining > 0) return "Review Before Submission";
  return "Ready for Client Submission";
}

type NextRecommendation = { id: string; label: string };

const RECOMMENDATION_ORDER = [
  "contact",
  "availability",
  "notice",
  "implementation",
  "compensation",
  "client-intro",
  "btp-scope",
  "s4hana",
  "project-history",
  "delivery",
  "career-journey",
] as const;

function recommendationLabel(id: string) {
  if (id === "contact") return "Request Contact Access";
  if (id === "implementation") return "Validate Ownership";
  if (id === "career-journey") return "Review Career Journey";
  if (id === "client-intro") return "Prepare Client Intro";
  if (id === "btp-scope") return "Confirm BTP Scope";
  if (id === "availability") return "Confirm Availability";
  if (id === "notice") return "Confirm Notice";
  if (id === "s4hana") return "Confirm S/4HANA Scope";
  if (id === "project-history") return "Confirm Project History";
  if (id === "delivery") return "Confirm Delivery Experience";
  if (id === "compensation") return "Confirm Salary Notes";
  if (id === "ready-submission") return "Mark Ready for Client Submission";
  if (id === "submit-candidate") return "Prepare Client Summary";
  if (id === "prepare-interview") return "Record Client Feedback";
  if (id === "create-offer") return "Record Interview";
  if (id === "placement") return "Record Placement";
  return "Continue Recruiter Workflow";
}

function nextRecommendationFor(
  stage: CandidateWorkflowStage,
  pendingValidationIds: string[],
  actionCompletedIds: string[],
): NextRecommendation {
  const completedActions = new Set(actionCompletedIds);
  const pendingValidations = new Set(pendingValidationIds);

  if (stage === "Recruiter Validation") {
    for (const id of RECOMMENDATION_ORDER) {
      if (pendingValidations.has(id)) return { id, label: recommendationLabel(id) };
      if ((id === "career-journey" || id === "client-intro") && !completedActions.has(id)) return { id, label: recommendationLabel(id) };
    }
  }

  if (stage === "Ready for Client Submission") return { id: "submit-candidate", label: recommendationLabel("submit-candidate") };
  if (stage === "Client Review") return { id: "prepare-interview", label: recommendationLabel("prepare-interview") };
  if (stage === "Interview") return { id: "create-offer", label: recommendationLabel("create-offer") };
  if (stage === "Offer") return { id: "placement", label: recommendationLabel("placement") };
  return { id: "placement", label: recommendationLabel("placement") };
}

function reasonFor(stage: CandidateWorkflowStage, criticalRemaining: number, importantRemaining: number) {
  if (stage === "Recruiter Validation" && criticalRemaining > 0) return "Waiting for recruiter review";
  if (stage === "Recruiter Validation" && importantRemaining > 0) return "Final recruiter checks remain";
  if (stage === "Ready for Client Submission") return "Ready for submission";
  if (stage === "Client Review") return "Waiting for client review";
  if (stage === "Interview") return "Record interview notes";
  if (stage === "Offer") return "Offer follow-up required";
  if (stage === "Placement") return "Candidate placed";
  return "Workflow in progress";
}

export function deriveCandidateWorkflow(input: DeriveWorkflowInput): CandidateWorkflowSnapshot {
  const requiredValidationComplete = input.criticalRemaining === 0 && input.importantRemaining === 0;
  const requiredActionsComplete = input.actionCompletedIds.includes("career-journey") && input.actionCompletedIds.includes("client-intro");
  const allComplete = requiredValidationComplete && requiredActionsComplete;
  const currentStage = normalizeRequestedStage(input.requestedStage, allComplete);
  const recommendation = nextRecommendationFor(currentStage, input.pendingValidationIds, input.actionCompletedIds);
  const currentIndex = stageIndex(currentStage);
  const stageStatuses = {} as Record<CandidateWorkflowStage, CandidateWorkflowStageStatus>;

  CANDIDATE_WORKFLOW_STAGES.forEach((stage, index) => {
    if (index < currentIndex) {
      stageStatuses[stage] = "Completed";
      return;
    }

    if (index === currentIndex) {
      if (stage === "Recruiter Validation" && input.criticalRemaining > 0) stageStatuses[stage] = "Blocked";
      else if (stage === "Recruiter Validation") stageStatuses[stage] = "Active";
      else stageStatuses[stage] = "Current";
      return;
    }

    if (index === currentIndex + 1 && allComplete) stageStatuses[stage] = "Waiting";
    else stageStatuses[stage] = "Locked";
  });

  const blockers = allComplete ? [] : input.blockers.slice(0, 4);

  return {
    candidateId: input.candidateId,
    completedCount: input.validationCompletedIds.length,
    totalCount: input.totalCount,
    remainingCount: input.remainingCount,
    criticalRemaining: input.criticalRemaining,
    importantRemaining: input.importantRemaining,
    optionalRemaining: input.optionalRemaining,
    remainingEffort: input.remainingEffort,
    allComplete,
    currentStage,
    stage: currentStage,
    stageStatuses,
    submissionStatus: submissionStatusFor(currentStage, input.criticalRemaining, input.importantRemaining, input.initialStatus),
    statusReason: reasonFor(currentStage, input.criticalRemaining, input.importantRemaining),
    nextBestAction: recommendation.label,
    nextActionId: recommendation.id,
    nextActionLabel: recommendation.label,
    blockers,
    completedIds: [...input.validationCompletedIds, ...input.actionCompletedIds],
    validationCompletedIds: input.validationCompletedIds,
    actionCompletedIds: input.actionCompletedIds,
  };
}

export function readStoredWorkflow(candidateId: string): Partial<CandidateWorkflowSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(storageKey(candidateId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
