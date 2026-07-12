import assert from "node:assert/strict";
import { extractBatchDecisionItems, selectBatchDecisionItems } from "../lib/aiExtractionBatchDecisionWorkflow";
import { summarizeBatchDecisionItems } from "../lib/aiExtractionBatchDecisionSummary";

const review = {
  queueItems: [{ candidateId: "c1", existingName: "Jane", source: "batch_promotion" }],
  fieldComparisons: [{
    candidateId: "c1",
    source: "batch_promotion",
    fieldComparisons: [
      { field: "currentCompany", existingValue: "", aiValue: "Acme", evidence: "Employer Acme", confidence: 95, decision: "safe_accept", source: "batch_promotion" },
      { field: "title", existingValue: "", aiValue: "", evidence: "", confidence: 0, decision: "risky_needs_review", source: "batch_promotion" },
    ],
  }],
};
const approvals = { approvals: [{ approvalId: "c1:title", candidateId: "c1", fieldName: "title", decision: "mark_for_review" }] };
const items = extractBatchDecisionItems(review, approvals, { items: [] });
assert.equal(items.length, 2, "audit decision summary loads promoted batch items");
assert.equal(items.find((item) => item.fieldName === "currentCompany")?.bulkApproveEligible, true, "safe item selected by workflow");
assert.equal(items.find((item) => item.fieldName === "title")?.existingApproval?.decision, "mark_for_review", "existing approval preserved");
const summary = summarizeBatchDecisionItems(items);
assert.equal(summary.promotedBatchItems, 2, "UI summary helper works");
assert.equal(summary.existingApprovalsPreserved, 1, "existing approvals counted");
assert.equal(selectBatchDecisionItems(items, "approve_safe").selected.length, 1, "bulk approve selects only safe eligible items");
assert.equal(selectBatchDecisionItems(items, "reject_invalid").selected.length, 0, "existing approval is not overwritten by reject selection");

console.log("AI extraction batch decision workflow tests passed");
