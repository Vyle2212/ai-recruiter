export type BatchSummaryInput = {
  totalCandidates: number;
  candidatesNeedingAiReview: number;
  eligibleCandidates: number;
  excludedCandidates: number;
  selectedBatchSize: number;
  fieldsTargeted: string[];
  estimatedAiCalls: number;
  providerMode: string;
  safetyStatus: string;
  warnings?: string[];
  errors?: string[];
};

export type BatchProgressSummary = {
  plannedCandidates: number;
  aiCompleted: number;
  aiFailed: number;
  reviewPending: number;
  approved: number;
  staged: number;
  appliedVerified: number;
  blocked: number;
  conflicts: number;
};

export function buildBatchSummary(input: BatchSummaryInput) {
  return {
    totalCandidateRecords: input.totalCandidates,
    candidatesNeedingAiReview: input.candidatesNeedingAiReview,
    candidatesEligibleForBatch: input.eligibleCandidates,
    excludedCandidates: input.excludedCandidates,
    selectedBatchSize: input.selectedBatchSize,
    fieldsTargeted: input.fieldsTargeted,
    estimatedAiCalls: input.estimatedAiCalls,
    providerMode: input.providerMode,
    safetyStatus: input.safetyStatus,
    warnings: input.warnings || [],
    errors: input.errors || [],
  };
}

export function buildBatchProgressSummary(items: Array<{ aiStatus: string; reviewStatus: string; stagingStatus: string; applyPreviewStatus: string; currentStatus: string }>): BatchProgressSummary {
  return {
    plannedCandidates: items.length,
    aiCompleted: items.filter((item) => /available|completed|cached/i.test(item.aiStatus)).length,
    aiFailed: items.filter((item) => /failed/i.test(item.aiStatus)).length,
    reviewPending: items.filter((item) => /pending|needs review/i.test(item.reviewStatus)).length,
    approved: items.filter((item) => /approved/i.test(item.reviewStatus)).length,
    staged: items.filter((item) => /^staged$/i.test(item.stagingStatus.trim())).length,
    appliedVerified: items.filter((item) => /^applied verified$/i.test(item.applyPreviewStatus.trim())).length,
    blocked: items.filter((item) => /blocked/i.test(item.currentStatus)).length,
    conflicts: items.filter((item) => /conflict/i.test(item.currentStatus)).length,
  };
}