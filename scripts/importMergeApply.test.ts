import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeImportMergePlan, validateImportMergeApplyMode } from "../lib/importMergeApply";
import { auditImportMergeApply } from "./auditImportMergeApply";
import type { ImportMergePlan } from "../lib/importMergeTypes";

const plan: ImportMergePlan = {
  generatedAt: "2026-07-22T00:00:00.000Z", mode: "import merge plan preview only; no candidate DB writes",
  decisionsLoaded: 1, approvedMerges: 1, excludedDecisions: 0, candidateRecordsAffected: 1,
  fieldUpdatesPlanned: 1, conflicts: 0, backupRequired: true, rollbackReady: true,
  items: [{ proposalId: "p1", candidateId: "c1", fieldName: "currentCompany", dbFieldName: "current_company", beforeValue: "", afterValue: "Safe Company", decision: "approve_merge", eligible: true }],
  excluded: [],
};
assert.equal(validateImportMergeApplyMode(false, false), "dry_run");
assert.throws(() => validateImportMergeApplyMode(true, false), /requires both/, "real apply requires both flags");
assert.throws(() => validateImportMergeApplyMode(false, true), /requires both/, "confirmation alone cannot apply");

async function main() {
const dryDir = fs.mkdtempSync(path.join(os.tmpdir(), "import-merge-dry-"));
let updates = 0;
const dry = await executeImportMergePlan(plan, { outputDir: dryDir, updateCandidate: async () => { updates += 1; } });
assert.equal(updates, 0, "dry-run does not write DB");
assert.equal(dry.result.dryRun, true);
assert.equal(fs.existsSync(dry.backupPath), true);
assert.equal(fs.existsSync(dry.rollbackPath), true);

const realDir = fs.mkdtempSync(path.join(os.tmpdir(), "import-merge-real-"));
const stored: Record<string, Record<string, unknown>> = { c1: { current_company: "" } };
const events: string[] = [];
const real = await executeImportMergePlan(plan, {
  outputDir: realDir, writeCandidateUpdates: true, confirmImportMerge: true,
  updateCandidate: async (candidateId, update) => {
    assert.equal(fs.existsSync(path.join(realDir, "import-merge-backup.json")), true, "backup created before write");
    assert.equal(fs.existsSync(path.join(realDir, "import-merge-rollback.json")), true, "rollback created before write");
    events.push("write"); stored[candidateId] = { ...stored[candidateId], ...update };
  },
  readCandidates: async () => stored,
});
assert.deepEqual(events, ["write"]);
assert.equal(real.postAudit.appliedVerified, 1, "post audit verifies applied value");
assert.equal(real.postAudit.pending, 0);
assert.equal(real.postAudit.mismatch, 0);
const audit = auditImportMergeApply(realDir);
assert.equal(audit.appliedVerified, 1, "audit verifies applied values");
assert.equal(audit.backupAvailable, true);
assert.equal(audit.rollbackAvailable, true);
assert.equal(audit.rollbackSafe, true);

const source = fs.readFileSync(new URL("../lib/importMergeApply.ts", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("./applyImportMergePlan.ts", import.meta.url), "utf8");
assert.equal(/\b(?:unlink|rmSync|rmdir)\b/.test(source + script), false, "no delete");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create/.test(source + script), false, "no OpenAI calls");
console.log("Import merge apply tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
