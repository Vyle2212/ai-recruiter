import assert from "node:assert/strict";
import { generateQuickFixRepairSuggestions } from "../lib/quickFixRepairSuggestionEngine";
import type { QuickFixRepairPlan } from "../lib/quickFixRepairTypes";

const plan: QuickFixRepairPlan = { generatedAt: "", mode: "test", batchSize: 25, batchIndex: 0, offset: 0, focus: "quick_fix_missing_company", quickFixCandidates: 1, selectedCandidates: 1, selectedCandidateIds: ["033061ad-e84d-4f45-bb99-617a28ca2864"], excludedAlreadyAppliedCount: 0, excludedPreviouslyBlockedCount: 0, excludedExistingApprovalsCount: 0, skipPreviouslyBlocked: false, minSafeSuggestions: 0, estimatedSafeSuggestions: 0, targetFields: ["currentCompany"], warnings: [], errors: [], items: [{ candidateId: "033061ad-e84d-4f45-bb99-617a28ca2864", candidateName: "Ashok Kumar P", repairCategory: "quick_fix_missing_company", priority: "P1", targetFields: ["currentCompany", "title", "location"], missingFields: ["currentCompany"], evidenceAvailability: "good_evidence", safetyNote: "test" }] };
const file = generateQuickFixRepairSuggestions(plan);
const company = file.suggestions.find((item) => item.fieldName === "currentCompany");
assert.equal(Boolean(company?.suggestedValue), true, "company suggestion from structured currentCompany");
assert.equal(Boolean(company?.evidenceSnippet), true, "company suggestion has evidence");
assert.equal(Boolean(file.suggestions.find((item) => item.fieldName === "title")?.suggestedValue), true, "title suggestion from structured title");
assert.equal(Boolean(file.suggestions.find((item) => item.fieldName === "location")?.suggestedValue), true, "location suggestion from structured location");
console.log("Quick fix repair suggestion engine tests passed");
