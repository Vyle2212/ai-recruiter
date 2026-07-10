import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidateApplyBackup } from "../lib/aiExtractionCandidateBackup";
import { executeCandidateApplyPlan } from "../lib/aiExtractionCandidateApplyExecutor";
import { buildCandidateApplyPlan } from "../lib/aiExtractionCandidateApplyPlan";
import { buildCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";
import type { AiExtractionStagingRecord } from "../lib/aiExtractionStagingPreview";

async function main() {
const staged: AiExtractionStagingRecord = {
  stagingId: "s1",
  candidateId: "c1",
  candidateName: "Jane Fico",
  fieldName: "currentCompany",
  currentValue: "",
  approvedValue: "Accenture",
  parserValue: "Not disclosed",
  aiEvidence: "Accenture Jan 2024 - Present",
  aiConfidence: 96,
  approvalDecision: "approve_suggestion",
  reviewerNote: "",
  overrideReason: "",
  riskLevel: "safe",
  applyReadiness: "staged_safe",
  validationStatus: "valid",
  validationReasons: [],
  sourceApprovalId: "a1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stagedBy: "local-review",
  appliedToCandidate: false,
};

const plan = buildCandidateApplyPlan([staged, { ...staged, stagingId: "s2", fieldName: "unknownField" }], [{ id: "c1", current_company: "", current_title: "SAP FICO Consultant" }]);
assert.equal(plan.stagedItemsLoaded, 2, "load staging file items into plan");
assert.equal(plan.fieldsEligibleForApply, 1, "valid staged field creates apply candidate");
assert.equal(plan.fieldsBlocked, 1, "unknown field mapping blocked");
assert.equal(plan.eligibleItems[0].update.current_company, "Accenture", "only allowed mapped field is updated");
assert.equal(plan.backupRequired, true, "backup required before apply");
assert.equal(plan.rollbackReady, true, "rollback can be generated before apply");

const dryRun = await executeCandidateApplyPlan(plan);
assert.equal(dryRun.dryRun, true, "dry-run does not write DB");
assert.equal(dryRun.appliedCount, 0, "dry-run applies nothing");

await assert.rejects(
  () => executeCandidateApplyPlan(plan, { writeCandidateUpdates: true, confirmApply: true }),
  /backup file is required|rollback file is required|updateCandidate implementation is required/,
  "real apply requires writeCandidateUpdates, confirmApply, backup, rollback, and updater",
);

const backup = buildCandidateApplyBackup(plan);
const rollback = buildCandidateRollbackPlan(backup);
let updated: Record<string, any> = {};
const applied = await executeCandidateApplyPlan(plan, {
  writeCandidateUpdates: true,
  confirmApply: true,
  backup,
  rollback,
  updateCandidate: async (_candidateId, update) => { updated = update; },
});
assert.equal(applied.appliedCount, 1, "confirmed apply updates eligible fields");
assert.deepEqual(updated, { current_company: "Accenture" }, "real apply only updates allowed field");

const source = fs.readFileSync(new URL("../lib/aiExtractionCandidateApplyPlan.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../lib/aiExtractionCandidateApplyExecutor.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(/i.test(source), false, "candidate apply must have no delete calls");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "candidate apply must not call OpenAI");

console.log("AI extraction candidate apply plan tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



