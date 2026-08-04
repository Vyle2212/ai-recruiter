import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  buildDisplayRepairApplySummary,
  buildDisplayRepairUpdatePlan,
  buildRollbackEntries,
  isRawTextEmployerCandidate,
  isSourceBackedEmployerRepair,
  isStructuredEmployerRepair,
  resolveSuggestedValidationStatus,
} from "../lib/candidateDisplayRepairApply";

const placeholderSuggestion = {
  candidate_id: "1",
  current_name: "Profile Under Review",
  suggested_name: "Candidate profile pending validation",
  current_role: "Employment SAP PS Solutions Consultant (",
  suggested_role: "SAP PS Consultant",
  current_employer: "Not disclosed",
  suggested_employer: "Not disclosed",
  current_validation_status: "Ready",
  suggested_validation_status: "Missing Information",
  confidence: 42,
  reason: "placeholder-name; invalid-name; employment-prefix; dangling-punctuation",
  source_field: "fallback | fallback | module fallback",
} as const;

const candidate = {
  id: "1",
  name: "Profile Under Review",
  current_title: "Employment SAP PS Solutions Consultant (",
  current_company: "Not disclosed",
  validation_status: "Ready",
  email: "person@example.com",
};

const previewSuggestions = [placeholderSuggestion];
const dryRunSummary = buildDisplayRepairApplySummary(previewSuggestions, new Map([["1", candidate]]));
assert.equal(dryRunSummary.totalSuggestions, previewSuggestions.length, "apply Total suggestions should match preview Repair suggestions");
assert.equal(dryRunSummary.totalSuggestions, 1, "dry run planner should count suggestions");
assert.equal(dryRunSummary.safeDisplayRepairs.length, 1, "placeholder/title cleanup should be safe display repair");
assert.equal(dryRunSummary.safeDisplayRepairs[0].update.name, "Candidate profile pending validation", "placeholder name repair should be planned");
assert.equal(dryRunSummary.safeDisplayRepairs[0].update.current_title, "SAP PS Consultant", "safe role cleanup should be planned");
assert.equal(dryRunSummary.safeDisplayRepairs[0].update.validation_status, "Missing Information", "placeholder cannot remain Ready");
assert.equal(Boolean(dryRunSummary.safeDisplayRepairs[0].update.current_company), false, "--write-safe-only category must not include employer updates");

const unsafeEmployerSuggestion = {
  ...placeholderSuggestion,
  candidate_id: "2",
  current_name: "Aina Rahman",
  suggested_name: "Aina Rahman",
  current_role: "SAP FICO Consultant",
  suggested_role: "SAP FICO Consultant",
  current_employer: "Not disclosed",
  suggested_employer: "SAP",
  current_validation_status: "Needs Review",
  confidence: 90,
  reason: "missing-current-employer",
  source_field: "name | current_company | role/title field",
};
assert.equal(isSourceBackedEmployerRepair(unsafeEmployerSuggestion), false, "SAP/module cannot be employer even with source field");
const unsafePlan = buildDisplayRepairUpdatePlan(unsafeEmployerSuggestion, { id: "2", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" });
assert.equal(Boolean(unsafePlan.update.current_company), false, "unsafe employer suggestion must be skipped");

const sourceBackedEmployerSuggestion = {
  ...placeholderSuggestion,
  candidate_id: "3",
  current_name: "Aina Rahman",
  suggested_name: "Aina Rahman",
  current_role: "SAP FICO Consultant",
  suggested_role: "SAP FICO Consultant",
  current_employer: "Not disclosed",
  suggested_employer: "Accenture Malaysia",
  current_validation_status: "Needs Review",
  confidence: 90,
  reason: "missing-current-employer",
  source_field: "name | currentCompany | role/title field",
};
assert.equal(isStructuredEmployerRepair(sourceBackedEmployerSuggestion), true, "structured currentCompany can be applied");
const employerPlan = buildDisplayRepairUpdatePlan(sourceBackedEmployerSuggestion, { id: "3", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" });
assert.equal(employerPlan.update.current_company, "Accenture Malaysia", "source-backed employer should be planned");
assert.equal(employerPlan.writeEligibility, "structured-employer-write", "structured employer confidence >=85 should be write eligible");
const structuredSummary = buildDisplayRepairApplySummary([sourceBackedEmployerSuggestion], new Map([["3", { id: "3", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" }]]));
assert.equal(structuredSummary.structuredEmployerRepairs.length, 1, "structured employer repairs should be separated");

const rawTextEmployerSuggestion = {
  ...sourceBackedEmployerSuggestion,
  candidate_id: "4",
  source_field: "name | raw resume text | role/title field",
};
assert.equal(isRawTextEmployerCandidate(rawTextEmployerSuggestion), true, "raw resume text employer should be categorized separately");
const rawSummary = buildDisplayRepairApplySummary([rawTextEmployerSuggestion], new Map([["4", { id: "4", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" }]]));
assert.equal(rawSummary.rawTextEmployerCandidates.length, 1, "raw text employer candidate should be reported");
assert.equal(rawSummary.structuredEmployerRepairs.length, 0, "raw text employer must not be auto-written");

const lowConfidenceStructured = { ...sourceBackedEmployerSuggestion, candidate_id: "5", confidence: 80 };
const lowSummary = buildDisplayRepairApplySummary([lowConfidenceStructured], new Map([["5", { id: "5", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" }]]));
assert.equal(lowSummary.structuredEmployerRepairs.length, 0, "structured employer below 85 confidence must not be auto-written");

const ambiguousEmployerSuggestion = { ...sourceBackedEmployerSuggestion, candidate_id: "6", suggested_employer: "DXC Technology (Hewlett" };
const ambiguousSummary = buildDisplayRepairApplySummary([ambiguousEmployerSuggestion], new Map([["6", { id: "6", name: "Aina Rahman", current_company: "Not disclosed", current_title: "SAP FICO Consultant", validation_status: "Needs Review", email: "a@example.com" }]]));
assert.equal(ambiguousSummary.structuredEmployerRepairs.length, 0, "ambiguous structured employer names must not be auto-written");

assert.equal(resolveSuggestedValidationStatus({ name: "Candidate profile pending validation", employer: "Accenture", role: "SAP FICO Consultant", hasContact: true, confidence: 90 }), "Missing Information", "placeholder name cannot become Ready");
assert.equal(resolveSuggestedValidationStatus({ name: "Aina Rahman", employer: "SAP", role: "SAP FICO Consultant", hasContact: true, confidence: 90 }), "Missing Information", "SAP/module employer cannot become Ready");
assert.equal(resolveSuggestedValidationStatus({ name: "Aina Rahman", employer: "Accenture", role: "SAP FICO Consultant", hasContact: true, confidence: 90 }), "Ready", "clean source-backed display can become Ready");

const rollback = buildRollbackEntries([employerPlan], "2026-07-05T00:00:00.000Z");
assert.equal(rollback.length, 1, "rollback file content should be generated for planned updates");
assert.deepEqual(rollback[0].fields_changed, employerPlan.changedFields, "rollback should capture changed fields");
assert.equal(rollback[0].old_values.current_company, "Not disclosed", "rollback should capture old values");
assert.equal(rollback[0].new_values.current_company, "Accenture Malaysia", "rollback should capture new values");

const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
const refusedWrite = spawnSync(npxBin, ["tsx", "scripts/applyCandidateDisplayRepairs.ts", "--write"], { encoding: "utf8" });
assert.notEqual(refusedWrite.status, 0, "--write without explicit safe flags must refuse to run");

console.log("Candidate display repair apply tests passed");
