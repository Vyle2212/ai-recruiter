import type { BatchDecisionItem } from "./aiExtractionBatchDecisionGuardrails";

export type BatchDecisionSummary = {
  promotedBatchItems: number;
  pendingDecisions: number;
  safeToApprove: number;
  needsManualReview: number;
  conflicts: number;
  alreadyAppliedPreserved: number;
  existingApprovalsPreserved: number;
  bulkApprovalEligible: number;
  bulkRejectionEligible: number;
  blockedFromBulkAction: number;
};

export function emptyBatchDecisionSummary(): BatchDecisionSummary {
  return { promotedBatchItems: 0, pendingDecisions: 0, safeToApprove: 0, needsManualReview: 0, conflicts: 0, alreadyAppliedPreserved: 0, existingApprovalsPreserved: 0, bulkApprovalEligible: 0, bulkRejectionEligible: 0, blockedFromBulkAction: 0 };
}

export function summarizeBatchDecisionItems(items: BatchDecisionItem[]): BatchDecisionSummary {
  const summary = emptyBatchDecisionSummary();
  summary.promotedBatchItems = items.length;
  summary.pendingDecisions = items.filter((item) => !item.existingApproval).length;
  summary.safeToApprove = items.filter((item) => item.bulkApproveEligible).length;
  summary.needsManualReview = items.filter((item) => item.manualReviewRequired).length;
  summary.conflicts = items.filter((item) => item.conflict).length;
  summary.alreadyAppliedPreserved = items.filter((item) => item.alreadyAppliedPreserved).length;
  summary.existingApprovalsPreserved = items.filter((item) => item.existingApproval).length;
  summary.bulkApprovalEligible = summary.safeToApprove;
  summary.bulkRejectionEligible = items.filter((item) => item.bulkRejectEligible).length;
  summary.blockedFromBulkAction = items.filter((item) => !item.bulkApproveEligible && !item.bulkRejectEligible).length;
  return summary;
}
