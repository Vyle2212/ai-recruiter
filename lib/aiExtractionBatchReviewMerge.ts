import { emptyBatchReviewPromotionSummary, type BatchReviewPromotionSummary } from "./aiExtractionBatchReviewSummary";

export type BatchReviewPromotionItem = {
  promotionId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  existingValue: string;
  parserValue: string;
  aiValue: string;
  evidence: string;
  confidence: number;
  decision: string;
  reason: string;
  source: "batch_promotion";
  batchId: string;
  batchPlanId: string;
  validationStatus: "valid" | "needs_manual_review" | "blocked" | "preserved_already_applied";
  validationReasons: string[];
};

export type BatchReviewMergeResult = {
  mergedReview: any;
  promotedItems: BatchReviewPromotionItem[];
  duplicateItems: BatchReviewPromotionItem[];
  blockedItems: BatchReviewPromotionItem[];
  summary: BatchReviewPromotionSummary;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function keyFor(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

function approvalCount(approvals: any) {
  const list = Array.isArray(approvals?.approvals) ? approvals.approvals : Array.isArray(approvals) ? approvals : [];
  return list.length;
}

function existingFieldKeys(review: any) {
  const keys = new Set<string>();
  for (const candidate of Array.isArray(review?.fieldComparisons) ? review.fieldComparisons : []) {
    for (const field of Array.isArray(candidate?.fieldComparisons) ? candidate.fieldComparisons : []) {
      keys.add(keyFor(candidate.candidateId, field.field));
    }
  }
  return keys;
}

function countExistingFields(review: any) {
  return (Array.isArray(review?.fieldComparisons) ? review.fieldComparisons : []).reduce((total: number, candidate: any) => total + (Array.isArray(candidate?.fieldComparisons) ? candidate.fieldComparisons.length : 0), 0);
}

function ensureQueueItem(review: any, item: BatchReviewPromotionItem) {
  const queueItems = Array.isArray(review.queueItems) ? review.queueItems : [];
  const existing = queueItems.find((queue: any) => clean(queue.candidateId) === item.candidateId);
  if (existing) {
    existing.source = existing.source || "batch_promotion";
    existing.batchId = existing.batchId || item.batchId;
    existing.batchPlanId = existing.batchPlanId || item.batchPlanId;
    return;
  }
  queueItems.push({
    candidateId: item.candidateId,
    existingName: item.candidateName || item.candidateId,
    reasonForAiQueue: "batch_promotion_needs_manual_review",
    conflicts: [],
    parserExtractedFields: {},
    source: "batch_promotion",
    batchId: item.batchId,
    batchPlanId: item.batchPlanId,
  });
  review.queueItems = queueItems;
}

function ensureCandidateComparison(review: any, item: BatchReviewPromotionItem) {
  const comparisons = Array.isArray(review.fieldComparisons) ? review.fieldComparisons : [];
  let candidate = comparisons.find((entry: any) => clean(entry.candidateId) === item.candidateId);
  if (!candidate) {
    candidate = {
      candidateId: item.candidateId,
      source: "batch_promotion",
      batchId: item.batchId,
      batchPlanId: item.batchPlanId,
      existingScore: { score: 0, searchReady: false, missingFields: [item.fieldName] },
      parserScore: { score: 0, searchReady: false, missingFields: [item.fieldName] },
      aiAvailable: true,
      fieldComparisons: [],
      safeChanges: [],
      riskyChanges: [],
      rejectedChanges: [],
      missingEvidence: [],
      manualReviewRequired: true,
      safeApplyCandidate: false,
      stillBlocked: true,
      searchReadyBefore: false,
      searchReadyAfterManualApprovals: false,
    };
    comparisons.push(candidate);
    review.fieldComparisons = comparisons;
  }
  candidate.source = candidate.source || "batch_promotion";
  candidate.batchId = candidate.batchId || item.batchId;
  candidate.batchPlanId = candidate.batchPlanId || item.batchPlanId;
  candidate.aiAvailable = true;
  candidate.manualReviewRequired = true;
  candidate.stillBlocked = true;
  candidate.fieldComparisons = Array.isArray(candidate.fieldComparisons) ? candidate.fieldComparisons : [];
  candidate.fieldComparisons.push({
    field: item.fieldName,
    existingValue: item.existingValue,
    parserValue: item.parserValue,
    aiValue: item.aiValue,
    decision: item.decision,
    reason: item.reason,
    evidence: item.evidence,
    confidence: item.confidence,
    source: item.source,
    batchId: item.batchId,
    batchPlanId: item.batchPlanId,
  });
  candidate.riskyChanges = Array.isArray(candidate.riskyChanges) ? candidate.riskyChanges : [];
  candidate.riskyChanges.push({ field: item.fieldName, reason: item.reason });
  candidate.missingEvidence = Array.isArray(candidate.missingEvidence) ? candidate.missingEvidence : [];
  if (!item.evidence) candidate.missingEvidence.push({ field: item.fieldName, reason: "missing evidence" });
  return candidate;
}

function updateSummary(review: any) {
  const comparisons = Array.isArray(review.fieldComparisons) ? review.fieldComparisons : [];
  const existing = review.summary || {};
  review.summary = {
    ...existing,
    totalQueued: comparisons.length,
    aiExtractionAvailable: comparisons.filter((item: any) => item.aiAvailable).length,
    fieldsSafeToAccept: comparisons.reduce((total: number, item: any) => total + (Array.isArray(item.safeChanges) ? item.safeChanges.length : 0), 0),
    fieldsRisky: comparisons.reduce((total: number, item: any) => total + (Array.isArray(item.riskyChanges) ? item.riskyChanges.length : 0), 0),
    fieldsRejected: comparisons.reduce((total: number, item: any) => total + (Array.isArray(item.rejectedChanges) ? item.rejectedChanges.length : 0), 0),
    candidatesRequiringManualReview: comparisons.filter((item: any) => item.manualReviewRequired).length,
    searchReadyAfterManualApprovals: comparisons.filter((item: any) => item.searchReadyAfterManualApprovals).length,
    aiExtractionMissing: comparisons.filter((item: any) => !item.aiAvailable).length,
  };
}

export function mergeBatchReviewItems(existingReview: any, incomingItems: BatchReviewPromotionItem[], approvals: any = null): BatchReviewMergeResult {
  const mergedReview = existingReview ? JSON.parse(JSON.stringify(existingReview)) : {};
  mergedReview.exportedAt = clean(mergedReview.exportedAt) || new Date().toISOString();
  mergedReview.mode = mergedReview.mode || "AI extraction review file. Recruiter review required before staging or apply.";
  const summary = emptyBatchReviewPromotionSummary();
  summary.batchReviewItems = incomingItems.length;
  summary.existingReviewItemsPreserved = countExistingFields(mergedReview);
  summary.existingApprovalsPreserved = approvalCount(approvals);

  const keys = existingFieldKeys(mergedReview);
  const promotedItems: BatchReviewPromotionItem[] = [];
  const duplicateItems: BatchReviewPromotionItem[] = [];
  const blockedItems: BatchReviewPromotionItem[] = [];

  for (const item of incomingItems) {
    if (item.validationStatus === "blocked" || item.validationStatus === "preserved_already_applied") {
      blockedItems.push(item);
      continue;
    }
    const key = keyFor(item.candidateId, item.fieldName);
    if (keys.has(key)) {
      duplicateItems.push(item);
      continue;
    }
    keys.add(key);
    ensureQueueItem(mergedReview, item);
    ensureCandidateComparison(mergedReview, item);
    promotedItems.push(item);
  }

  updateSummary(mergedReview);
  summary.newReviewItems = promotedItems.length;
  summary.promotedItems = promotedItems.length;
  summary.readyForRecruiterReview = promotedItems.length;
  summary.pendingReview = promotedItems.length;
  summary.duplicateReviewItemsSkipped = duplicateItems.length;
  summary.duplicateSkipped = duplicateItems.length;
  summary.invalidReviewItemsBlocked = blockedItems.length;
  summary.blocked = blockedItems.length;
  return { mergedReview, promotedItems, duplicateItems, blockedItems, summary };
}

