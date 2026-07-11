import assert from "node:assert/strict";
import { mergeBatchReviewItems, type BatchReviewPromotionItem } from "../lib/aiExtractionBatchReviewMerge";

function item(fieldName: string, candidateId = "c1"): BatchReviewPromotionItem {
  return {
    promotionId: `p-${candidateId}-${fieldName}`,
    candidateId,
    candidateName: "Jane Consultant",
    fieldName,
    existingValue: "",
    parserValue: "",
    aiValue: "Acme",
    evidence: "Worked at Acme",
    confidence: 92,
    decision: "safe_accept",
    reason: "test",
    source: "batch_promotion",
    batchId: "batch-1",
    batchPlanId: "plan-1",
    validationStatus: "valid",
    validationReasons: [],
  };
}

const existingReview = {
  queueItems: [{ candidateId: "c1", existingName: "Existing Jane", source: "existing_review" }],
  fieldComparisons: [{
    candidateId: "c1",
    aiAvailable: true,
    fieldComparisons: [{ field: "currentCompany", aiValue: "Existing" }],
    safeChanges: [],
    riskyChanges: [],
    rejectedChanges: [],
    manualReviewRequired: true,
  }],
};
const approvals = { approvals: [{ approvalId: "a1", candidateId: "c1", fieldName: "currentCompany", decision: "keep_existing" }] };
const merge = mergeBatchReviewItems(existingReview, [item("currentCompany"), item("title"), { ...item("badField"), fieldName: "badField", validationStatus: "blocked", validationReasons: ["unsupported"] }], approvals);
assert.equal(merge.summary.existingReviewItemsPreserved, 1, "existing review item preserved");
assert.equal(merge.summary.duplicateReviewItemsSkipped, 1, "duplicate incoming item skipped");
assert.equal(merge.summary.newReviewItems, 1, "new non-duplicate item promoted");
assert.equal(merge.summary.existingApprovalsPreserved, 1, "existing approval decision preserved");
assert.equal(merge.summary.invalidReviewItemsBlocked, 1, "blocked incoming item excluded");
assert.equal(merge.mergedReview.fieldComparisons[0].fieldComparisons.length, 2, "merge adds new field to existing candidate review");
assert.equal(merge.mergedReview.queueItems[0].source, "existing_review", "existing queue item source preserved");

console.log("AI extraction batch review merge tests passed");
