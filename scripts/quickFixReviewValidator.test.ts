import assert from "node:assert/strict";
import { validateQuickFixReviewPromotion } from "../lib/quickFixReviewValidator";
const safe: any = { candidateId: "c1", fieldName: "currentCompany", suggestedValue: "Acme Consulting", evidenceSnippet: "Acme Consulting", validationStatus: "safe_suggestion", approvalReadiness: "ready_for_manual_approval" };
assert.equal(validateQuickFixReviewPromotion(safe).ok, true, "quick-fix suggestion promoted to review item");
assert.equal(validateQuickFixReviewPromotion({ ...safe, validationStatus: "blocked" }).ok, false, "blocked suggestion not promoted");
assert.equal(validateQuickFixReviewPromotion({ ...safe, suggestedValue: "" }).ok, false, "empty suggestion blocked");
assert.equal(validateQuickFixReviewPromotion({ ...safe, fieldName: "unknown" }).ok, false, "unsupported field blocked");
console.log("Quick fix review validator tests passed");
