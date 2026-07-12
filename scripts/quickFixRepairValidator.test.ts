import assert from "node:assert/strict";
import { statusForValidatedSuggestion, validateQuickFixSuggestion } from "../lib/quickFixRepairValidator";

const base: any = { candidateId: "c1", fieldName: "currentCompany", currentValue: "", suggestedValue: "Acme Consulting", confidence: 92, evidenceSnippet: "Acme Consulting | SAP Consultant" };
assert.equal(validateQuickFixSuggestion(base).ok, true, "company suggestion from structured currentCompany");
assert.equal(validateQuickFixSuggestion({ ...base, suggestedValue: "Client" }).ok, false, "bad company value blocked");
assert.equal(validateQuickFixSuggestion({ ...base, fieldName: "title", suggestedValue: "SAP MM Consultant" }).ok, true, "title suggestion from structured title");
assert.equal(validateQuickFixSuggestion({ ...base, fieldName: "title", suggestedValue: "Acme Pvt Ltd" }).ok, false, "bad title value blocked");
assert.equal(statusForValidatedSuggestion({ ...base, fieldName: "primarySapModule", suggestedValue: "MM", confidence: 86 }).validationStatus, "needs_manual_review", "module suggestion requires strong evidence");
assert.equal(validateQuickFixSuggestion({ ...base, fieldName: "primarySapModule", suggestedValue: "MM", validationReasons: ["module conflict"] }).ok, false, "module conflict blocked");
assert.equal(validateQuickFixSuggestion({ ...base, evidenceSnippet: "" }).ok, false, "missing evidence blocked");
console.log("Quick fix repair validator tests passed");
