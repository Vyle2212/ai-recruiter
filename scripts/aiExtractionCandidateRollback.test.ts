import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CandidateApplyBackup } from "../lib/aiExtractionCandidateBackup";
import { buildCandidateRollbackPlan, executeCandidateRollback, loadCandidateRollbackPlan, writeCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";

async function main() {
const backup: CandidateApplyBackup = {
  mode: "backup",
  createdAt: new Date().toISOString(),
  entries: [{ candidateId: "c1", fieldName: "currentCompany", candidateField: "current_company", previousValue: "Deloitte", approvedValue: "Accenture", stagingId: "s1" }],
};
const rollback = buildCandidateRollbackPlan(backup);
assert.equal(rollback.entries.length, 1, "rollback file generated before apply");
assert.equal(rollback.entries[0].restoreValue, "Deloitte", "rollback restores previous value");

const dryRun = await executeCandidateRollback(rollback);
assert.equal(dryRun.dryRun, true, "rollback dry-run does not write DB");
assert.equal(dryRun.restoredCount, 0, "rollback dry-run restores nothing");

await assert.rejects(
  () => executeCandidateRollback(rollback, { writeCandidateUpdates: true, confirmRollback: true }),
  /updateCandidate implementation is required/,
  "real rollback requires confirmRollback and update implementation",
);

let update: Record<string, any> = {};
const applied = await executeCandidateRollback(rollback, {
  writeCandidateUpdates: true,
  confirmRollback: true,
  updateCandidate: async (_candidateId, values) => { update = values; },
});
assert.equal(applied.restoredCount, 1, "confirmed rollback restores fields");
assert.deepEqual(update, { current_company: "Deloitte" }, "rollback restores only changed field");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-rollback-"));
const rollbackPath = path.join(tmp, "candidate-apply-rollback.json");
writeCandidateRollbackPlan(rollback, rollbackPath);
assert.equal(loadCandidateRollbackPlan(rollbackPath)?.entries.length, 1, "rollback file can be loaded");

const source = fs.readFileSync(new URL("../lib/aiExtractionCandidateRollback.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../scripts/rollbackCandidateChangesFromStaging.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(/i.test(source), false, "rollback must have no delete calls");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "rollback must not call OpenAI");

console.log("AI extraction candidate rollback tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



