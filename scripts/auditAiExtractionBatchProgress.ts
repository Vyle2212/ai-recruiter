import fs from "node:fs";
import path from "node:path";
import { buildBatchProgressSummary } from "../lib/aiExtractionBatchSummary";
import { buildApplyHistory } from "../lib/aiExtractionApplyHistory";
import { loadAiExtractionBatchPlan } from "../lib/aiExtractionBatchPlanner";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export async function buildBatchProgress() {
  const plan = loadAiExtractionBatchPlan();
  const dryRun = readJson(path.join("reports", "ai-extraction-batch-dry-run.json"));
  const { candidates } = await loadRealTalentPoolCandidates();
  const history = buildApplyHistory(candidates);
  const verifiedIds = new Set(history.items.filter((item) => item.status === "applied_verified" || item.status === "preserved_already_applied").map((item) => `${item.candidateId}:${item.fieldName}`));
  const items = (plan?.selectedCandidates || []).map((candidate) => ({
    candidateName: candidate.candidateName,
    candidateId: candidate.candidateId,
    missingFields: candidate.missingFields,
    selectedTargetFields: candidate.selectedTargetFields,
    currentStatus: candidate.currentStatus,
    aiStatus: dryRun?.items?.some((item: any) => item.candidateId === candidate.candidateId) ? "completed" : candidate.aiStatus,
    reviewStatus: candidate.reviewStatus,
    stagingStatus: candidate.stagingStatus,
    applyPreviewStatus: candidate.selectedTargetFields.some((field) => verifiedIds.has(`${candidate.candidateId}:${field}`)) ? "applied verified" : candidate.applyPreviewStatus,
    lastUpdated: new Date().toISOString(),
    safetyNote: candidate.safetyNote,
  }));
  const summary = buildBatchProgressSummary(items);
  return { generatedAt: new Date().toISOString(), mode: "read-only batch progress audit", summary, items, files: { planFound: Boolean(plan), dryRunFound: Boolean(dryRun), historyItems: history.items.length } };
}

export function writeBatchProgress(report: Awaited<ReturnType<typeof buildBatchProgress>>, outputPath = path.join("reports", "ai-extraction-batch-progress.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`);
  return fullPath;
}

async function main() {
  const report = await buildBatchProgress();
  const outputPath = writeBatchProgress(report);
  console.log("Mode: read-only batch progress audit");
  console.log(`Planned candidates: ${report.summary.plannedCandidates}`);
  console.log(`AI completed: ${report.summary.aiCompleted}`);
  console.log(`AI failed: ${report.summary.aiFailed}`);
  console.log(`Review pending: ${report.summary.reviewPending}`);
  console.log(`Approved: ${report.summary.approved}`);
  console.log(`Staged: ${report.summary.staged}`);
  console.log(`Applied verified: ${report.summary.appliedVerified}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Conflicts: ${report.summary.conflicts}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiExtractionBatchProgress.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}