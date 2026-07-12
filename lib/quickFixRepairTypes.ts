export type QuickFixTargetField = "currentCompany" | "title" | "primarySapModule" | "location";
export type QuickFixReviewStatus = "safe_suggestion" | "needs_manual_review" | "blocked" | "already_verified" | "already_approved" | "duplicate_suggestion";
export type QuickFixApprovalReadiness = "ready_for_manual_approval" | "not_ready_missing_evidence" | "not_ready_conflict" | "not_ready_existing_approval" | "not_ready_already_verified";
export type QuickFixConfidenceBand = "high" | "medium" | "low";

export type QuickFixRepairPlanItem = {
  candidateId: string;
  candidateName: string;
  repairCategory: string;
  priority: string;
  targetFields: QuickFixTargetField[];
  missingFields: string[];
  evidenceAvailability: string;
  safetyNote: string;
};

export type QuickFixRepairPlan = {
  generatedAt: string;
  mode: string;
  batchSize: number;
  focus: string;
  quickFixCandidates: number;
  selectedCandidates: number;
  targetFields: QuickFixTargetField[];
  items: QuickFixRepairPlanItem[];
  warnings: string[];
  errors: string[];
  outputPath?: string;
};

export type QuickFixRepairSuggestion = {
  suggestionId: string;
  candidateId: string;
  candidateName: string;
  fieldName: QuickFixTargetField;
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  confidenceBand: QuickFixConfidenceBand;
  evidenceSource: string;
  evidenceSnippet: string;
  repairCategory: string;
  priority: string;
  validationStatus: QuickFixReviewStatus;
  approvalReadiness: QuickFixApprovalReadiness;
  validationReasons: string[];
  safetyNote: string;
};

export type QuickFixRepairSuggestionFile = {
  generatedAt: string;
  mode: string;
  candidatesProcessed: number;
  suggestions: QuickFixRepairSuggestion[];
  summary: QuickFixRepairSummary;
};

export type QuickFixRepairSummary = {
  quickFixCandidates: number;
  selectedBatch: number;
  suggestionsGenerated: number;
  safeSuggestions: number;
  needsManualReview: number;
  blockedSuggestions: number;
  missingCompanyFixes: number;
  missingTitleFixes: number;
  missingModuleFixes: number;
  missingLocationFixes: number;
  readyForApprovalPreview: number;
  existingApprovalsPreserved: number;
  missingEvidence: number;
};

export type QuickFixApprovalPreview = {
  generatedAt: string;
  mode: string;
  wouldCreateApprovalDecisions: number;
  wouldPreserveExistingApprovals: number;
  wouldBlockSuggestions: number;
  approvals: Array<{
    approvalId: string;
    candidateId: string;
    fieldName: string;
    currentValue: string;
    suggestedValue: string;
    parserValue: string;
    aiEvidence: string;
    aiConfidence: number;
    decision: "mark_for_review";
    riskLevel: "safe" | "risky" | "conflict";
    reviewerNote: string;
    overrideReason: string;
    createdAt: string;
    updatedAt: string;
    source: "quick_fix_repair";
    decisionMode: "manual_review_preview";
    safetyReasons: string[];
    evidenceSummary: string;
  }>;
  preserved: QuickFixRepairSuggestion[];
  blocked: QuickFixRepairSuggestion[];
  outputPath?: string;
};

export type QuickFixCandidate360Panel = {
  candidateId: string;
  candidateName: string;
  suggestions: QuickFixRepairSuggestion[];
  suggestedNextAction: string;
  safetyNote: string;
};
