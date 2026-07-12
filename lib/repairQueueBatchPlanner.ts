import type { RepairBatchPlan, RepairQueueCategory, RepairQueueItem } from "./repairQueueTypes";
import { prioritizeRepairQueue } from "./repairQueuePrioritizer";
import { summarizeRepairQueue } from "./repairQueueSummary";

const SUPPORTED_FOCUS = new Set(["quick_fix_missing_company", "quick_fix_missing_title", "quick_fix_missing_module", "quick_fix_missing_location", "ai_extractable", "manual_review_required", "duplicate_conflict", "requires_original_file_reupload", "low_evidence_profile", "archive_candidate_review"]);

export function validateRepairBatchSize(batchSize = 25) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (![10, 25, 50].includes(batchSize)) warnings.push("Batch size should normally be 10, 25, or 50; using requested size if <= 50.");
  if (batchSize > 50) errors.push("Batch size over 50 is rejected");
  if (batchSize === 50) warnings.push("Batch size 50 should be reviewed carefully.");
  return { ok: errors.length === 0, warnings, errors, batchSize: Math.min(batchSize || 25, 50) };
}

export function planRepairBatches(items: RepairQueueItem[], options: { batchSize?: number; focus?: string } = {}): RepairBatchPlan {
  const requestedSize = Number(options.batchSize || 25);
  const guard = validateRepairBatchSize(requestedSize);
  const focus = options.focus || "all";
  const errors = [...guard.errors];
  if (focus !== "all" && !SUPPORTED_FOCUS.has(focus)) errors.push(`Unsupported repair focus: ${focus}`);
  const filtered = focus === "all" ? items : items.filter((item) => item.repairCategory === focus || item.categories.includes(focus as RepairQueueCategory));
  const sorted = prioritizeRepairQueue(filtered);
  const batches: RepairBatchPlan["batches"] = [];
  if (!errors.length) {
    for (const item of sorted) {
      let batch = batches.find((entry) => entry.batchType === item.suggestedBatch && entry.priority === item.priority && entry.items.length < guard.batchSize);
      if (!batch) {
        batch = { batchId: `repair-batch-${batches.length + 1}`, batchType: item.suggestedBatch, priority: item.priority, category: item.repairCategory, items: [] };
        batches.push(batch);
      }
      batch.items.push(item);
    }
  }
  const summary = summarizeRepairQueue(sorted);
  return {
    generatedAt: new Date().toISOString(),
    mode: "repair batch planning only; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls",
    batchSize: guard.batchSize,
    focus,
    needsRepairCandidates: items.length,
    batchesGenerated: batches.length,
    warnings: guard.warnings,
    errors,
    batches,
    summary: {
      ...summary,
      p1QuickFixBatchCount: batches.filter((batch) => batch.priority === "P1").length,
      p2AiExtractionBatchCount: batches.filter((batch) => batch.batchType === "ai_extraction_batch").length,
      p3ManualReviewBatchCount: batches.filter((batch) => batch.batchType === "manual_review_batch").length,
      p4ReuploadBatchCount: batches.filter((batch) => batch.batchType === "reupload_required_batch").length,
    },
  };
}
