import { buildBatchReviewPromotion, writeBatchReviewPromotionReport, writePromotedReviewFile } from "../lib/aiExtractionBatchReviewPromotion";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const writeReviewFile = process.argv.includes("--writeReviewFile");
  const reviewPath = argValue("reviewPath", "reports/ai-extraction-review.json");
  const report = buildBatchReviewPromotion({
    batchDryRunPath: argValue("batchDryRunPath", "reports/ai-extraction-batch-dry-run.json"),
    reviewPath,
    approvalsPath: argValue("approvalsPath", "reports/ai-extraction-approvals.json"),
    applyHistoryPath: argValue("applyHistoryPath", "reports/candidate-apply-history.json"),
    writeReviewFile,
  });
  const outputPath = writeBatchReviewPromotionReport(report, argValue("outputPath", "reports/ai-extraction-batch-review-promotion.json"));
  if (writeReviewFile) writePromotedReviewFile(report, reviewPath);
  console.log(writeReviewFile ? "Mode: review file write only; no candidate DB writes" : "Mode: preview only; no candidate DB writes; review file not changed");
  console.log(`Batch review items loaded: ${report.summary.batchReviewItems}`);
  console.log(`Existing review items loaded: ${report.summary.existingReviewItemsPreserved}`);
  console.log(`New review items: ${report.summary.newReviewItems}`);
  console.log(`Existing items preserved: ${report.summary.existingReviewItemsPreserved}`);
  console.log(`Duplicates skipped: ${report.summary.duplicateReviewItemsSkipped}`);
  console.log(`Invalid items blocked: ${report.summary.invalidReviewItemsBlocked}`);
  console.log(`Ready for recruiter review: ${report.summary.readyForRecruiterReview}`);
  console.log(`Existing approvals preserved: ${report.summary.existingApprovalsPreserved}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/promoteAiExtractionBatchToReview.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

