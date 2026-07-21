import fs from "node:fs";
import path from "node:path";

const OPTIONAL_REPORTS = ["recruiter-workflow-audit.json", "repair-queue-audit.json", "quick-fix-post-apply-verification.json", "quick-fix-workflow-refresh-apply-audit.json", "quick-fix-apply-decisions.json", "ai-extraction-approvals.json"] as const;
type JsonObject = Record<string, unknown>;
export type ManualCleanupFreezeOptions = { reportsDir?: string; outputPath?: string; now?: () => Date };

function readJson(filePath: string, required = false): JsonObject | undefined {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonObject; }
  catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Unable to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Persisted workflow state is missing numeric ${label}`);
  return value;
}

export function buildManualCleanupFreezeReport(options: ManualCleanupFreezeOptions = {}) {
  const reportsDir = options.reportsDir ?? path.resolve(process.cwd(), "reports");
  const workflowState = readJson(path.join(reportsDir, "recruiter-workflow-state.json"), true)!;
  const statusCounts = object(object(workflowState.summary).statusCounts);
  const states = Array.isArray(workflowState.states) ? workflowState.states : [];
  const optionalReports: Record<string, { found: boolean; generatedAt: unknown }> = Object.fromEntries(OPTIONAL_REPORTS.map((fileName) => {
    const report = readJson(path.join(reportsDir, fileName));
    return [fileName, { found: Boolean(report), generatedAt: report?.generatedAt ?? report?.updatedAt ?? null }];
  }));
  const repairSummary = object(readJson(path.join(reportsDir, "repair-queue-audit.json"))?.summary);
  return {
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    mode: "read-only freeze report; no candidate DB writes",
    totalCandidates: number(workflowState.totalCandidates, "totalCandidates"),
    needsRepair: number(statusCounts.needs_repair, "summary.statusCounts.needs_repair"),
    readyForShortlist: number(statusCounts.ready_for_shortlist, "summary.statusCounts.ready_for_shortlist"),
    manualReview: typeof repairSummary.manualReview === "number" ? repairSummary.manualReview : 0,
    reuploadRequired: typeof repairSummary.reuploadRequired === "number" ? repairSummary.reuploadRequired : 0,
    lowEvidence: typeof repairSummary.lowEvidence === "number" ? repairSummary.lowEvidence : 0,
    aiExtractable: typeof repairSummary.aiExtractable === "number" ? repairSummary.aiExtractable : 0,
    totalMovedToReadyForShortlist: states.filter((state) => object(state).applyHistoryStatus === "quick_fix_verified_applied").length,
    currentKnownStatus: { manualCleanupV1: "frozen", productReadinessBaseline: "recorded", manualCleanupBlockingProductDevelopment: false },
    reasonForFreeze: "Safe quick-fix batches are complete. Remaining manual cleanup is no longer a blocking activity; product work will preserve the current candidate database and move new uploads through clean import staging and merge approval.",
    nextProductPhases: ["Candidate360 profile", "Candidate self-confirm profile", "Clean import/reupload staging", "Merge approval workflow"],
    policy: { doNotDeleteMainCandidateDb: true, doNotFullReuploadIntoMainDb: true, useImportStagingForNewUploads: true, preserveExistingCandidateIds: true, preserveApplyHistory: true, preserveApprovalsAndDecisions: true },
    sourceReports: { "recruiter-workflow-state.json": { found: true, generatedAt: workflowState.generatedAt ?? null }, ...optionalReports } as Record<string, { found: boolean; generatedAt: unknown }>,
  };
}

export function writeManualCleanupFreezeReport(options: ManualCleanupFreezeOptions = {}) {
  const reportsDir = options.reportsDir ?? path.resolve(process.cwd(), "reports");
  const outputPath = options.outputPath ?? path.join(reportsDir, "manual-cleanup-v1-freeze.json");
  const report = buildManualCleanupFreezeReport(options);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { outputPath, report };
}
function main() {
  const { report } = writeManualCleanupFreezeReport();
  console.log("Mode: read-only manual cleanup freeze; no candidate DB writes");
  console.log(`Total candidates: ${report.totalCandidates}`);
  console.log(`Needs repair: ${report.needsRepair}`);
  console.log(`Ready for shortlist: ${report.readyForShortlist}`);
  console.log("Manual cleanup v1 frozen: yes");
  console.log("Main DB deletion allowed: no");
  console.log("Full reupload into main DB allowed: no");
  console.log("Next phase: Candidate360 + self-confirm profile");
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/freezeManualCleanupV1.ts")) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
