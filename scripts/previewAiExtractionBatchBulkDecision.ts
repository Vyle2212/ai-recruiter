import { previewBatchBulkDecision, writeBatchBulkDecisionPreview } from "../lib/aiExtractionBatchDecisionStore";
import type { BatchDecisionAction } from "../lib/aiExtractionBatchDecisionGuardrails";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const decision = argValue("decision", "approve_safe") as BatchDecisionAction;
  const report = previewBatchBulkDecision({
    decision,
    source: argValue("source", "batch_promotion"),
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    approvalsPath: argValue("approvalsPath", "reports/ai-extraction-approvals.json"),
    applyHistoryPath: argValue("applyHistoryPath", "reports/candidate-apply-history.json"),
  });
  const outputPath = writeBatchBulkDecisionPreview(report, argValue("outputPath", "reports/ai-extraction-batch-bulk-decision-preview.json"));
  console.log("Mode: preview only; approvals file not changed; no candidate DB writes");
  console.log(`Candidate fields selected: ${report.summary.candidateFieldsSelected}`);
  console.log(`Candidate fields excluded: ${report.summary.candidateFieldsExcluded}`);
  console.log(`Would approve count: ${report.summary.wouldApproveCount}`);
  console.log(`Would reject count: ${report.summary.wouldRejectCount}`);
  console.log(`Would preserve existing approvals count: ${report.summary.wouldPreserveExistingApprovalsCount}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/previewAiExtractionBatchBulkDecision.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
