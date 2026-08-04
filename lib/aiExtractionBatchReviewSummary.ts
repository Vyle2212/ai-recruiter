export type BatchReviewPromotionSummary = {
  batchReviewItems: number;
  newReviewItems: number;
  existingReviewItemsPreserved: number;
  duplicateReviewItemsSkipped: number;
  invalidReviewItemsBlocked: number;
  readyForRecruiterReview: number;
  existingApprovalsPreserved: number;
  promotedItems: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  staged: number;
  appliedVerified: number;
  blocked: number;
  duplicateSkipped: number;
};

export function emptyBatchReviewPromotionSummary(): BatchReviewPromotionSummary {
  return {
    batchReviewItems: 0,
    newReviewItems: 0,
    existingReviewItemsPreserved: 0,
    duplicateReviewItemsSkipped: 0,
    invalidReviewItemsBlocked: 0,
    readyForRecruiterReview: 0,
    existingApprovalsPreserved: 0,
    promotedItems: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    staged: 0,
    appliedVerified: 0,
    blocked: 0,
    duplicateSkipped: 0,
  };
}