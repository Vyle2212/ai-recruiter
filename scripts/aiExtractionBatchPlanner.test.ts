import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApplyHistorySummary } from "../lib/aiExtractionApplyHistorySummary";
import { buildAiExtractionBatchPlan, writeAiExtractionBatchPlan } from "../lib/aiExtractionBatchPlanner";
import { buildBatchDryRun } from "./runAiExtractionBatchDryRun";
import { buildBatchProgressSummary } from "../lib/aiExtractionBatchSummary";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "batch-plan-"));
const reviewPath = path.join(tmp, "review.json");
const stagingPath = path.join(tmp, "staging.json");
const aiResultsPath = path.join(tmp, "ai-results.json");
writeJson(reviewPath, { queueItems: [{ candidateId: "c1" }, { candidateId: "c2" }] });
writeJson(stagingPath, { items: [{ candidateId: "c4", fieldName: "currentCompany" }] });
writeJson(aiResultsPath, { items: [{ candidateId: "c1" }] });

const candidates = [
  { id: "c1", name: "Jane Fico", current_company: "", current_title: "", raw_text: "SAP FICO implementation ".repeat(30) },
  { id: "c2", name: "John ABAP", current_company: "", duplicate_status: "duplicate conflict unresolved", raw_text: "SAP ABAP ".repeat(40) },
  { id: "c3", name: "Mina MM", current_company: "", extraction_decision_action: "requires_original_file_reupload", raw_text: "SAP MM ".repeat(40) },
  { id: "c4", name: "Verified User", current_company: "Accenture", raw_text: "SAP SD ".repeat(40) },
  { id: "c5", name: "No Evidence", current_company: "" },
];
const applyHistory = {
  generatedAt: new Date().toISOString(),
  mode: "test",
  summary: buildApplyHistorySummary([], { backupFound: false, rollbackFound: false }),
  files: {} as any,
  items: [{ candidateId: "c4", fieldName: "currentCompany", status: "applied_verified" as const } as any],
};

const plan = buildAiExtractionBatchPlan(candidates, { batchSize: 10, targetFields: ["currentCompany"], reviewPath, stagingPath, aiResultsPath }, applyHistory);
assert.equal(plan.selectedCandidates.length, 1, "batch planner selects eligible candidates");
assert.equal(plan.selectedCandidates[0].candidateId, "c1", "eligible candidate selected");
assert.equal(plan.excludedCandidates.some((item) => item.candidateId === "c4" && item.exclusionReasons.join(" ").includes("already verified")), true, "already applied/verified candidates excluded");
assert.equal(plan.excludedCandidates.some((item) => item.candidateId === "c2" && item.exclusionReasons.join(" ").includes("duplicate conflict")), true, "duplicate conflict excluded");
assert.equal(plan.excludedCandidates.some((item) => item.candidateId === "c3" && item.exclusionReasons.join(" ").includes("reupload")), true, "requires original file reupload excluded");
assert.equal(plan.summary.providerMode, "mock", "default provider is mock");
assert.equal(plan.summary.estimatedAiCalls, 1, "estimated AI calls follow selected candidates");

const planPath = writeAiExtractionBatchPlan(plan, path.join(tmp, "plan.json"));
const dryRun = buildBatchDryRun(planPath, { provider: "mock" });
assert.equal(dryRun.completedCandidates, 1, "dry-run batch completes selected candidates");
assert.equal(dryRun.provider, "mock", "dry-run uses mock provider");
const progress = buildBatchProgressSummary([{ aiStatus: "completed", reviewStatus: "needs review", stagingStatus: "not staged", applyPreviewStatus: "not applied", currentStatus: "eligible_for_batch" }]);
assert.equal(progress.aiCompleted, 1, "progress audit summarizes planned/review/staged/applied states");
assert.equal(plan.summary.totalCandidateRecords, 5, "UI summary helper works");

const badPlan = buildAiExtractionBatchPlan(candidates, { targetFields: ["unsupportedField"] }, applyHistory);
assert.equal(badPlan.guardrails.ok, false, "unsupported target field blocked");

const source = fs.readFileSync(new URL("../lib/aiExtractionBatchPlanner.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../lib/aiExtractionBatchSelector.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("./runAiExtractionBatchDryRun.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("./auditAiExtractionBatchProgress.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "dry-run does not write candidate DB and no delete calls");
const realApplyPattern = new RegExp(["applyCandidateChanges", "FromStaging|candidate-", "staged-changes|confirm", "Apply"].join(""), "i");
assert.equal(realApplyPattern.test(source), false, "no real apply call");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "no OpenAI calls by default");

console.log("AI extraction batch planner tests passed");