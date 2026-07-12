import fs from "node:fs";
import path from "node:path";
import { loadQuickFixRepairSuggestions } from "./quickFixRepairReview";
import { mergeQuickFixReviewItems } from "./quickFixReviewMerge";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

export type QuickFixReviewPromotionResult = {
  generatedAt: string;
  mode: string;
  suggestionsLoaded: number;
  reviewItemsReady: number;
  existingReviewItemsPreserved: number;
  duplicateReviewItemsSkipped: number;
  blockedSuggestionsSkipped: number;
  wouldWriteReviewItems: number;
  reviewItemsWritten: number;
  reviewFilePath: string;
  outputPath: string;
  mergedReviewReport: any;
  ready: any[];
  duplicates: any[];
  blocked: any[];
};

export function buildQuickFixReviewPromotion(options: { suggestionsPath?: string; reviewPath?: string; writeReviewFile?: boolean; outputPath?: string } = {}): QuickFixReviewPromotionResult {
  const suggestionsFile = loadQuickFixRepairSuggestions(options.suggestionsPath);
  const reviewPath = options.reviewPath || path.join("reports", "ai-extraction-review.json");
  const reviewReport = readJson(reviewPath) || { exportedAt: new Date().toISOString(), mode: "read-only AI extraction review; no DB writes; no deletes; no apply", summary: {}, queueItems: [], fieldComparisons: [] };
  const merge = mergeQuickFixReviewItems(reviewReport, suggestionsFile.suggestions);
  const outputPath = options.outputPath || path.join("reports", options.writeReviewFile ? "quick-fix-repair-review-promotion-result.json" : "quick-fix-repair-review-promotion-preview.json");
  if (options.writeReviewFile) writeWorkflowJson(reviewPath, merge.merged);
  return {
    generatedAt: new Date().toISOString(),
    mode: options.writeReviewFile ? "quick-fix review file write only; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls" : "quick-fix review promotion preview; review file not changed; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls",
    suggestionsLoaded: suggestionsFile.suggestions.length,
    reviewItemsReady: merge.ready.length,
    existingReviewItemsPreserved: merge.existingPreserved,
    duplicateReviewItemsSkipped: merge.duplicates.length,
    blockedSuggestionsSkipped: merge.blocked.length,
    wouldWriteReviewItems: merge.ready.length,
    reviewItemsWritten: options.writeReviewFile ? merge.ready.length : 0,
    reviewFilePath: reviewPath,
    outputPath,
    mergedReviewReport: merge.merged,
    ready: merge.ready,
    duplicates: merge.duplicates,
    blocked: merge.blocked,
  };
}

export function writeQuickFixReviewPromotionReport(result: QuickFixReviewPromotionResult) {
  const { mergedReviewReport, ...report } = result;
  return writeWorkflowJson(result.outputPath, report);
}
