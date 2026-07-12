import { applyBatchBulkDecision, writeBatchBulkDecisionPreview } from "../lib/aiExtractionBatchDecisionStore";
import type { BatchDecisionAction } from "../lib/aiExtractionBatchDecisionGuardrails";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const writeApprovalsFile = process.argv.includes("--writeApprovalsFile");
  const report = applyBatchBulkDecision({
    decision: argValue("decision", "approve_safe") as BatchDecisionAction,
    source: argValue("source", "batch_promotion"),
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    approvalsPath: argValue("approvalsPath", "reports/ai-extraction-approvals.json"),
    applyHistoryPath: argValue("applyHistoryPath", "reports/candidate-apply-history.json"),
    writeApprovalsFile,
    overwriteExistingApprovals: process.argv.includes("--overwriteExistingApprovals"),
  }) as any;
  const outputPath = writeApprovalsFile ? (report.outputPath || "reports/ai-extraction-approvals.json") : writeBatchBulkDecisionPreview(report, argValue("outputPath", "reports/ai-extraction-batch-bulk-decision-result.json"));
  console.log(writeApprovalsFile ? "Mode: approvals file write only; no candidate DB writes" : "Mode: preview only; approvals file not changed; no candidate DB writes");
  console.log(`Approved decisions written: ${report.summary.wouldApproveCount || 0}`);
  console.log(`Rejected decisions written: ${report.summary.wouldRejectCount || 0}`);
  console.log(`Existing approvals preserved: ${report.summary.wouldPreserveExistingApprovalsCount || 0}`);
  console.log(`Conflicts skipped: ${report.excluded.filter((item: any) => item.conflict).length}`);
  console.log(`Manual review skipped: ${report.excluded.filter((item: any) => item.manualReviewRequired).length}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/applyAiExtractionBatchBulkDecision.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
