export type QuickFixApplyDecision = "approve_for_apply" | "hold_for_review" | "reject_from_apply" | "keep_existing";
export type QuickFixApplyReviewRecommendation = QuickFixApplyDecision;

export type QuickFixApplyReviewItem = {
  reviewId: string;
  stagingId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  dbFieldName: string;
  currentDbValue: string;
  suggestedValue: string;
  evidenceSource: string;
  evidenceSnippet: string;
  confidence: number;
  riskLevel: string;
  applyStatus: string;
  eligible: boolean;
  preserved: boolean;
  blocked: boolean;
  suspicious: boolean;
  cleanCompanyFix: boolean;
  reviewRecommendation: QuickFixApplyReviewRecommendation;
  decision: QuickFixApplyDecision;
  safetyReasons: string[];
  safetyNote: string;
  stagingItem: any;
  applyPreviewItem: any;
};

export type QuickFixApplyReviewSummary = {
  stagedItems: number;
  eligibleForApply: number;
  alreadyAppliedPreserved: number;
  needsRecruiterReview: number;
  approvedForApply: number;
  heldForReview: number;
  rejectedFromApply: number;
  keepExisting: number;
  suspiciousValues: number;
  cleanCompanyFixes: number;
  applySubsetSize: number;
};

export type QuickFixApplyReviewBoard = {
  generatedAt: string;
  mode: string;
  summary: QuickFixApplyReviewSummary;
  items: QuickFixApplyReviewItem[];
  files: Record<string, { path: string; found: boolean }>;
};

export type QuickFixApplyDecisionRecord = {
  decisionId: string;
  stagingId: string;
  candidateId: string;
  fieldName: string;
  dbFieldName: string;
  suggestedValue: string;
  decision: QuickFixApplyDecision;
  reviewerNote: string;
  safetyReasons: string[];
  source: "quick_fix_apply_review";
  decisionMode: "suggested" | "manual";
  createdAt: string;
  updatedAt: string;
};

export type QuickFixApplyDecisionFile = {
  mode: string;
  updatedAt: string;
  decisions: QuickFixApplyDecisionRecord[];
};

export type QuickFixApplySubsetPreview = {
  generatedAt: string;
  mode: string;
  reviewBoardItems: number;
  decisionsLoaded: number;
  approvedForApply: number;
  heldForReview: number;
  rejected: number;
  preservedExisting: number;
  wouldIncludeInApplySubset: number;
  wouldExcludeFromApplySubset: number;
  subsetItems: Array<any>;
  excludedItems: Array<{ stagingId: string; candidateId: string; fieldName: string; decision: QuickFixApplyDecision; reasons: string[] }>;
  outputPath?: string;
};
