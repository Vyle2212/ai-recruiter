import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildManualCleanupFreezeReport, writeManualCleanupFreezeReport } from "./freezeManualCleanupV1";

const reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-cleanup-freeze-"));
const outputPath = path.join(reportsDir, "manual-cleanup-v1-freeze.json");
const workflowPath = path.join(reportsDir, "recruiter-workflow-state.json");
const candidateDbSentinel = path.join(reportsDir, "candidate-db-sentinel.json");
const workflow = {
  generatedAt: "2026-07-21T00:00:00.000Z",
  totalCandidates: 5,
  summary: { statusCounts: { needs_repair: 2, ready_for_shortlist: 3 } },
  states: [
    { candidateId: "c1", applyHistoryStatus: "quick_fix_verified_applied" },
    { candidateId: "c2", applyHistoryStatus: "quick_fix_verified_applied" },
    { candidateId: "c3", applyHistoryStatus: "not_applied_by_workflow" },
  ],
};
fs.writeFileSync(workflowPath, JSON.stringify(workflow));
fs.writeFileSync(candidateDbSentinel, "candidate DB must remain unchanged");
fs.writeFileSync(path.join(reportsDir, "repair-queue-audit.json"), JSON.stringify({
  summary: { manualReview: 8, reuploadRequired: 4, lowEvidence: 3, aiExtractable: 0 },
}));

const inputsBefore = new Map(fs.readdirSync(reportsDir).map((name) => [name, fs.readFileSync(path.join(reportsDir, name), "utf8")]));
const report = buildManualCleanupFreezeReport({ reportsDir, now: () => new Date("2026-07-21T01:00:00.000Z") });
assert.equal(report.totalCandidates, 5, "freeze report reads persisted workflow state");
assert.equal(report.needsRepair, 2);
assert.equal(report.readyForShortlist, 3);
assert.equal(report.totalMovedToReadyForShortlist, 2, "persisted quick-fix markers determine moved total");
assert.equal(report.manualReview, 8);
assert.deepEqual(report.nextProductPhases, ["Candidate360 profile", "Candidate self-confirm profile", "Clean import/reupload staging", "Merge approval workflow"], "next phases included");
assert.equal(report.policy.doNotDeleteMainCandidateDb, true, "policy blocks full delete");
assert.equal(report.policy.doNotFullReuploadIntoMainDb, true, "policy blocks full reupload");
assert.equal(report.mode, "read-only freeze report; no candidate DB writes", "no candidate DB writes");

writeManualCleanupFreezeReport({ reportsDir, outputPath, now: () => new Date("2026-07-21T01:00:00.000Z") });
for (const [name, contents] of inputsBefore) {
  assert.equal(fs.readFileSync(path.join(reportsDir, name), "utf8"), contents, `${name} was not mutated`);
}
assert.deepEqual(fs.readdirSync(reportsDir).sort(), [...inputsBefore.keys(), path.basename(outputPath)].sort(), "only the output report is added");
assert.equal(fs.readFileSync(candidateDbSentinel, "utf8"), "candidate DB must remain unchanged", "no candidate DB writes");

const missingOptionalDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-cleanup-freeze-optional-"));
fs.writeFileSync(path.join(missingOptionalDir, "recruiter-workflow-state.json"), JSON.stringify(workflow));
const withoutOptional = buildManualCleanupFreezeReport({ reportsDir: missingOptionalDir });
assert.equal(withoutOptional.manualReview, 0, "handles missing optional reports gracefully");
assert.equal(withoutOptional.sourceReports["repair-queue-audit.json"].found, false);

const implementation = fs.readFileSync(path.join(process.cwd(), "scripts", "freezeManualCleanupV1.ts"), "utf8");
assert.equal(/from ["']openai["']|new OpenAI|\.responses\.create|\.chat\.completions/.test(implementation), false, "no OpenAI calls");
assert.equal(/\b(?:unlink|rmSync|rmdir|truncate)\b/.test(implementation), false, "no delete");
console.log("Manual cleanup freeze tests passed");
