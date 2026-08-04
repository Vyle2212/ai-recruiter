import assert from "node:assert/strict";
import { evaluateBatchDecisionItem } from "../lib/aiExtractionBatchDecisionGuardrails";

function base(overrides: any = {}) {
  return evaluateBatchDecisionItem({
    decisionItemId: "c1:currentCompany",
    candidateId: "c1",
    candidateName: "Jane",
    fieldName: "currentCompany",
    currentValue: "",
    suggestedValue: "Acme Ltd",
    parserValue: "",
    evidence: "Current employer Acme Ltd",
    confidence: 0.92,
    riskLevel: "safe",
    decisionStatus: "safe_accept",
    source: "batch_promotion",
    ...overrides,
  });
}

assert.equal(base().bulkApproveEligible, true, "safe item eligible for bulk approve");
assert.equal(base({ evidence: "" }).bulkApproveEligible, false, "missing evidence blocked from bulk approve");
assert.equal(base({ riskLevel: "conflict", decisionStatus: "conflict" }).bulkApproveEligible, false, "conflict blocked from bulk approve");
assert.equal(base({ applyHistoryStatus: "applied_verified" }).bulkApproveEligible, false, "already applied blocked from approve");
assert.equal(base({ fieldName: "unsupportedField" }).bulkRejectEligible, true, "invalid unsupported field eligible for reject");
assert.equal(base({ fieldName: "currentCompany", suggestedValue: "project implementation role" }).bulkRejectEligible, true, "dirty employer eligible for reject");
assert.equal(base({ fieldName: "email", suggestedValue: "not an email" }).bulkApproveEligible, false, "invalid email blocked");
assert.equal(base({ fieldName: "salary", suggestedValue: "120000" }).bulkApproveEligible, false, "unclear salary blocked");

console.log("AI extraction batch decision guardrails tests passed");
