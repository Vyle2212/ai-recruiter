import { buildQuickFixReviewPromotion, writeQuickFixReviewPromotionReport } from "../lib/quickFixReviewPromotion";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const writeReviewFile = hasFlag("writeReviewFile");
  const result = buildQuickFixReviewPromotion({
    suggestionsPath: argValue("suggestionsPath", "reports/quick-fix-repair-suggestions.json"),
    reviewPath: argValue("reviewPath", "reports/ai-extraction-review.json"),
    writeReviewFile,
  });
  const outputPath = writeQuickFixReviewPromotionReport(result);
  console.log(writeReviewFile ? "Mode: quick-fix review file write only; no candidate DB writes" : "Mode: quick-fix review promotion preview; review file not changed; no candidate DB writes");
  console.log(`Suggestions loaded: ${result.suggestionsLoaded}`);
  console.log(`Review items ready: ${result.reviewItemsReady}`);
  console.log(`Existing review items preserved: ${result.existingReviewItemsPreserved}`);
  console.log(`Duplicate review items skipped: ${result.duplicateReviewItemsSkipped}`);
  console.log(`Blocked suggestions skipped: ${result.blockedSuggestionsSkipped}`);
  console.log(`Would write review items: ${result.wouldWriteReviewItems}`);
  if (writeReviewFile) console.log(`Review items written: ${result.reviewItemsWritten}`);
  console.log(`Output path: ${outputPath}`);
  if (writeReviewFile) console.log(`Review file path: ${result.reviewFilePath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/promoteQuickFixRepairToReview.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
