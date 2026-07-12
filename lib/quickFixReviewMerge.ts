import type { QuickFixRepairSuggestion } from "./quickFixRepairTypes";
import { validateQuickFixReviewPromotion, reviewFieldForQuickFix } from "./quickFixReviewValidator";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function key(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${reviewFieldForQuickFix(fieldName)}`;
}

function promotedField(suggestion: QuickFixRepairSuggestion) {
  return {
    field: reviewFieldForQuickFix(suggestion.fieldName),
    existingValue: clean(suggestion.currentValue),
    parserValue: clean(suggestion.suggestedValue),
    aiValue: clean(suggestion.suggestedValue),
    decision: "safe_accept",
    reason: suggestion.validationStatus === "needs_manual_review" ? "quick_fix_manual_review_ready" : "quick_fix_repair_safe_suggestion",
    evidence: clean(suggestion.evidenceSnippet || suggestion.evidenceSource),
    confidence: Number(suggestion.confidence || 0),
    source: "quick_fix_repair",
    repairCategory: clean(suggestion.repairCategory),
    priority: clean(suggestion.priority),
    riskLevel: suggestion.validationStatus === "safe_suggestion" ? "safe" : "risky",
    validationStatus: clean(suggestion.validationStatus),
    requiresManualReview: suggestion.validationStatus === "needs_manual_review",
    evidenceSource: clean(suggestion.evidenceSource),
    createdAt: new Date().toISOString(),
    sourceReport: "quick-fix-repair-suggestions",
  };
}

function promotedComparison(suggestion: QuickFixRepairSuggestion) {
  const field = promotedField(suggestion);
  return {
    candidateId: clean(suggestion.candidateId),
    source: "quick_fix_repair",
    repairCategory: clean(suggestion.repairCategory),
    priority: clean(suggestion.priority),
    existingScore: { score: 0, searchReady: false, reasons: ["quick_fix_repair"], missingFields: [], riskFlags: [] },
    parserScore: { score: 0, searchReady: false, reasons: ["quick_fix_repair"], missingFields: [], riskFlags: [] },
    aiAvailable: true,
    fieldComparisons: [field],
    safeChanges: suggestion.validationStatus === "safe_suggestion" ? [field] : [],
    riskyChanges: suggestion.validationStatus === "needs_manual_review" ? [field] : [],
    rejectedChanges: [],
    missingEvidence: [],
    manualReviewRequired: suggestion.validationStatus === "needs_manual_review",
    safeApplyCandidate: suggestion.validationStatus === "safe_suggestion",
    stillBlocked: false,
    searchReadyBefore: false,
    searchReadyAfterSafeChanges: false,
    searchReadyAfterManualApprovals: false,
  };
}

function promotedQueueItem(suggestion: QuickFixRepairSuggestion) {
  return {
    candidateId: clean(suggestion.candidateId),
    existingName: clean(suggestion.candidateName),
    reasonForAiQueue: "quick_fix_repair",
    conflicts: [],
    parserExtractedFields: { [reviewFieldForQuickFix(suggestion.fieldName)]: clean(suggestion.suggestedValue) },
    source: "quick_fix_repair",
    repairCategory: clean(suggestion.repairCategory),
    priority: clean(suggestion.priority),
  };
}

export function mergeQuickFixReviewItems(reviewReport: any, suggestions: QuickFixRepairSuggestion[]) {
  const merged = {
    exportedAt: reviewReport?.exportedAt || new Date().toISOString(),
    outputPath: reviewReport?.outputPath || "reports\\ai-extraction-review.json",
    mode: reviewReport?.mode || "read-only AI extraction review; no DB writes; no deletes; no apply",
    options: reviewReport?.options || {},
    summary: { ...(reviewReport?.summary || {}) },
    queueItems: Array.isArray(reviewReport?.queueItems) ? [...reviewReport.queueItems] : [],
    fieldComparisons: Array.isArray(reviewReport?.fieldComparisons) ? [...reviewReport.fieldComparisons] : [],
  };
  const existingKeys = new Set<string>();
  for (const item of merged.fieldComparisons) {
    for (const field of Array.isArray(item?.fieldComparisons) ? item.fieldComparisons : []) existingKeys.add(`${clean(item.candidateId)}:${clean(field.field)}`);
  }
  const queueIds = new Set(merged.queueItems.map((item: any) => clean(item.candidateId)));
  const ready: QuickFixRepairSuggestion[] = [];
  const blocked: Array<QuickFixRepairSuggestion & { blockReasons: string[] }> = [];
  const duplicates: QuickFixRepairSuggestion[] = [];

  for (const suggestion of suggestions) {
    const validation = validateQuickFixReviewPromotion(suggestion);
    if (!validation.ok) {
      blocked.push({ ...suggestion, blockReasons: validation.reasons });
      continue;
    }
    const itemKey = key(suggestion.candidateId, suggestion.fieldName);
    if (existingKeys.has(itemKey)) {
      duplicates.push(suggestion);
      continue;
    }
    existingKeys.add(itemKey);
    ready.push(suggestion);
    merged.fieldComparisons.push(promotedComparison(suggestion));
    if (!queueIds.has(clean(suggestion.candidateId))) {
      merged.queueItems.push(promotedQueueItem(suggestion));
      queueIds.add(clean(suggestion.candidateId));
    }
  }
  merged.summary.totalQueued = Number(merged.summary.totalQueued || 0) + ready.length;
  merged.summary.aiExtractionAvailable = Number(merged.summary.aiExtractionAvailable || 0) + ready.length;
  merged.summary.fieldsSafeToAccept = Number(merged.summary.fieldsSafeToAccept || 0) + ready.filter((item) => item.validationStatus === "safe_suggestion").length;
  merged.summary.fieldsRisky = Number(merged.summary.fieldsRisky || 0) + ready.filter((item) => item.validationStatus === "needs_manual_review").length;
  return { merged, ready, blocked, duplicates, existingPreserved: existingKeys.size - ready.length };
}

export function hasMatchingQuickFixReviewItem(reviewReport: any, candidateId: string, fieldName: string) {
  const wanted = key(candidateId, fieldName);
  return (Array.isArray(reviewReport?.fieldComparisons) ? reviewReport.fieldComparisons : []).some((item: any) =>
    (Array.isArray(item?.fieldComparisons) ? item.fieldComparisons : []).some((field: any) => `${clean(item.candidateId)}:${clean(field.field)}` === wanted && clean(field.source) === "quick_fix_repair"),
  );
}
