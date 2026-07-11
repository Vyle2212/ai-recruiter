import assert from "node:assert/strict";
import { validateApplyHistoryItem } from "../lib/aiExtractionApplyHistoryValidator";

const base = {
  candidateId: "c1",
  fieldName: "currentCompany",
  approvedValue: "Accenture",
  stagingCurrentValue: "",
  validationStatus: "valid",
  validationReasons: [] as string[],
  riskLevel: "safe",
  candidate: { id: "c1", current_company: "Accenture" },
  hasStagingFile: true,
};

assert.equal(validateApplyHistoryItem(base).status, "preserved_already_applied", "already applied classified as preserved_already_applied");
assert.equal(validateApplyHistoryItem({ ...base, resultAudit: { applied: true, candidateField: "current_company", to: "Accenture" } }).status, "applied_verified", "applied matching DB value is verified");
assert.equal(validateApplyHistoryItem({ ...base, candidate: { id: "c1", current_company: "Deloitte" }, resultAudit: { applied: true, candidateField: "current_company", to: "Accenture" } }).status, "post_apply_mismatch", "mismatch classified as post_apply_mismatch");
assert.equal(validateApplyHistoryItem({ ...base, validationStatus: "warning", candidate: { id: "c1", current_company: "" } }).status, "blocked", "blocked field stays blocked");
assert.equal(validateApplyHistoryItem({ ...base, fieldName: "unknownField", candidate: { id: "c1" } }).status, "blocked", "unknown field blocked");
assert.equal(validateApplyHistoryItem({ ...base, candidate: null }).status, "missing_candidate", "missing candidate classified safely");
assert.equal(validateApplyHistoryItem({ ...base, hasStagingFile: false }).status, "missing_report_file", "missing staging file classified safely");

console.log("AI extraction apply history validator tests passed");