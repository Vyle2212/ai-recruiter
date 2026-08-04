import fs from "node:fs";
import path from "node:path";
import { mergeBatchReviewItems, type BatchReviewPromotionItem } from "./aiExtractionBatchReviewMerge";
import { validateBatchReviewItem } from "./aiExtractionBatchReviewValidator";

export type BatchReviewPromotionOptions = {
  batchDryRunPath?: string;
  reviewPath?: string;
  approvalsPath?: string;
  applyHistoryPath?: string;
  outputPath?: string;
  writeReviewFile?: boolean;
};

export type BatchReviewPromotionReport = {
  generatedAt: string;
  mode: string;
  files: Record<string, { path: string; found: boolean; written?: boolean }>;
  summary: ReturnType<typeof mergeBatchReviewItems>["summary"];
  promotedItems: BatchReviewPromotionItem[];
  duplicateItems: BatchReviewPromotionItem[];
  blockedItems: BatchReviewPromotionItem[];
  mergedReview?: any;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) };
}

function defaultPath(fileName: string) {
  return path.join("reports", fileName);
}

function promotionId(candidateId: string, fieldName: string) {
  return `batch-review-${candidateId}-${fieldName}`.replace(/[^a-z0-9_-]+/gi, "-");
}

export function convertBatchDryRunToReviewItems(batchDryRun: any, applyHistory: any = null): BatchReviewPromotionItem[] {
  const batchId = clean(batchDryRun?.batchId || batchDryRun?.generatedAt || "batch-dry-run");
  const batchPlanId = clean(batchDryRun?.batchPlanId || batchDryRun?.guardrails?.batchPlanId || "ai-extraction-batch-plan");
  return (Array.isArray(batchDryRun?.items) ? batchDryRun.items : []).flatMap((item: any) => {
    const candidateId = clean(item.candidateId);
    const candidateName = clean(item.candidateName) || candidateId;
    const targetFields = Array.isArray(item.targetFields) ? item.targetFields : [];
    return targetFields.map((fieldNameRaw: any) => {
      const fieldName = clean(fieldNameRaw);
      const evidence = clean(item.evidence || item.aiEvidence);
      const aiValue = clean(item.aiValue || item.suggestedValue);
      const validation = validateBatchReviewItem({ candidateId, fieldName, evidence, aiValue }, applyHistory);
      return {
        promotionId: promotionId(candidateId, fieldName),
        candidateId,
        candidateName,
        fieldName,
        existingValue: clean(item.currentValue || item.existingValue),
        parserValue: clean(item.parserValue),
        aiValue,
        evidence,
        confidence: Number(item.confidence || item.aiConfidence || 0),
        decision: validation.needsManualReview ? "risky_needs_review" : "safe_accept",
        reason: validation.reasons.join("; ") || "batch_promotion_review_item",
        source: "batch_promotion" as const,
        batchId,
        batchPlanId,
        validationStatus: validation.status,
        validationReasons: validation.reasons,
      };
    });
  });
}

export function buildBatchReviewPromotion(options: BatchReviewPromotionOptions = {}): BatchReviewPromotionReport {
  const batchDryRunPath = options.batchDryRunPath || defaultPath("ai-extraction-batch-dry-run.json");
  const reviewPath = options.reviewPath || defaultPath("ai-extraction-review.json");
  const approvalsPath = options.approvalsPath || defaultPath("ai-extraction-approvals.json");
  const applyHistoryPath = options.applyHistoryPath || defaultPath("candidate-apply-history.json");
  const batchDryRun = readJson(batchDryRunPath);
  const review = readJson(reviewPath);
  const approvals = readJson(approvalsPath);
  const applyHistory = readJson(applyHistoryPath);
  const incomingItems = convertBatchDryRunToReviewItems(batchDryRun.data, applyHistory.data);
  const merge = mergeBatchReviewItems(review.data || {}, incomingItems, approvals.data);
  const mode = options.writeReviewFile ? "review file write only; no candidate DB writes; no apply; no delete; no OpenAI calls" : "preview only; no candidate DB writes; review file not changed; no apply; no delete; no OpenAI calls";
  return {
    generatedAt: new Date().toISOString(),
    mode,
    files: {
      batchDryRun: { path: batchDryRunPath, found: batchDryRun.found },
      review: { path: reviewPath, found: review.found, written: Boolean(options.writeReviewFile) },
      approvals: { path: approvalsPath, found: approvals.found, written: false },
      applyHistory: { path: applyHistoryPath, found: applyHistory.found },
    },
    summary: merge.summary,
    promotedItems: merge.promotedItems,
    duplicateItems: merge.duplicateItems,
    blockedItems: merge.blockedItems,
    mergedReview: merge.mergedReview,
  };
}

export function writeBatchReviewPromotionReport(report: BatchReviewPromotionReport, outputPath = defaultPath("ai-extraction-batch-review-promotion.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const reportForDisk = { ...report, mergedReview: undefined };
  fs.writeFileSync(fullPath, `${JSON.stringify(reportForDisk, null, 2)}\n`);
  return fullPath;
}

export function writePromotedReviewFile(report: BatchReviewPromotionReport, reviewPath = defaultPath("ai-extraction-review.json")) {
  const fullPath = path.resolve(reviewPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report.mergedReview || {}, null, 2)}\n`);
  return fullPath;
}

