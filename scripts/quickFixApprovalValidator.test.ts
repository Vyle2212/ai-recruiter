import assert from "node:assert/strict";
import { validateQuickFixApprovalSuggestion } from "../lib/quickFixApprovalValidator";

const safe: any = { candidateId: "c1", fieldName: "currentCompany", currentValue: "", suggestedValue: "Acme Consulting", confidence: 92, evidenceSnippet: "Acme Consulting | SAP Consultant", evidenceSource: "structured", validationStatus: "safe_suggestion", approvalReadiness: "ready_for_manual_approval", repairCategory: "quick_fix_missing_company", priority: "P1", validationReasons: [] };
assert.equal(validateQuickFixApprovalSuggestion(safe).status, "blocked", "approval blocked without matching review item");
assert.equal(validateQuickFixApprovalSuggestion(safe, { hasMatchingReviewItem: true }).status, "ready", "safe suggestions converted to approval decisions");
assert.equal(validateQuickFixApprovalSuggestion({ ...safe, validationStatus: "needs_manual_review" }, { hasMatchingReviewItem: true }).status, "ready", "manual review ready suggestions converted correctly");
assert.equal(validateQuickFixApprovalSuggestion({ ...safe, validationStatus: "blocked" }, { hasMatchingReviewItem: true }).status, "blocked", "blocked suggestions not written");
assert.equal(validateQuickFixApprovalSuggestion({ ...safe, fieldName: "unknownField" }, { hasMatchingReviewItem: true }).status, "blocked", "unsupported field blocked");
assert.equal(validateQuickFixApprovalSuggestion({ ...safe, suggestedValue: "" }, { hasMatchingReviewItem: true }).status, "blocked", "empty approved value blocked");
const existing = new Map([["c1:currentCompany", safe]]);
assert.equal(validateQuickFixApprovalSuggestion(safe, { existingApprovals: existing, hasMatchingReviewItem: true }).status, "preserved", "existing approvals preserved");
const seen = new Set(["c1:currentCompany"]);
assert.equal(validateQuickFixApprovalSuggestion(safe, { seen, hasMatchingReviewItem: true }).status, "blocked", "duplicate candidate+field skipped");
console.log("Quick fix approval validator tests passed");

