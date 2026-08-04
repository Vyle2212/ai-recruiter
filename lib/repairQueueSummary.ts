import type { RepairQueueItem, RepairQueueSummary } from "./repairQueueTypes";

export function summarizeRepairQueue(items: RepairQueueItem[]): RepairQueueSummary {
  const category = (name: string) => items.filter((item) => item.categories.includes(name as any) || item.repairCategory === name).length;
  const priority = (name: string) => items.filter((item) => item.priority === name).length;
  return {
    needsRepair: items.length,
    quickFixes: items.filter((item) => item.priority === "P1").length,
    aiExtractable: category("ai_extractable"),
    manualReview: category("manual_review_required"),
    duplicateConflicts: category("duplicate_conflict"),
    reuploadRequired: category("requires_original_file_reupload"),
    lowEvidence: category("low_evidence_profile"),
    archiveReview: category("archive_candidate_review"),
    p0: priority("P0"),
    p1: priority("P1"),
    p2: priority("P2"),
    p3: priority("P3"),
    p4: priority("P4"),
    p5: priority("P5"),
  };
}
