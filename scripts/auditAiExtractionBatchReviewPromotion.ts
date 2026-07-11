import { buildBatchReviewPromotion, writeBatchReviewPromotionReport } from "../lib/aiExtractionBatchReviewPromotion";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const report = buildBatchReviewPromotion({
    batchDryRunPath: argValue("batchDryRunPath", "reports/ai-extraction-batch-dry-run.json"),
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    approvalsPath: argValue("approvalsPath", "reports/ai-extraction-approvals.json"),
    applyHistoryPath: argValue("applyHistoryPath", "reports/candidate-apply-history.json"),
  });
  const outputPath = writeBatchReviewPromotionReport(report, argValue("outputPath", "reports/ai-extraction-batch-review-promotion.json"));
  console.log("Mode: read-only promotion audit");
  console.log(`Promoted items: ${report.summary.promotedItems}`);
  console.log(`Pending review: ${report.summary.pendingReview}`);
  console.log(`Approved: ${report.summary.approved}`);
  console.log(`Rejected: ${report.summary.rejected}`);
  console.log(`Staged: ${report.summary.staged}`);
  console.log(`Applied verified: ${report.summary.appliedVerified}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Duplicate skipped: ${report.summary.duplicateSkipped}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiExtractionBatchReviewPromotion.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

