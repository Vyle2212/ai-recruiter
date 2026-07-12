import { buildRepairQueueAudit } from "./repairQueueAudit";

export function buildRepairQueueCandidate360(candidateId: string) {
  const audit = buildRepairQueueAudit();
  const item = audit.items.find((entry) => entry.candidateId === candidateId);
  if (!item) return null;
  return {
    candidateId,
    repairCategory: item.repairCategory,
    priority: item.priority,
    missingFields: item.missingFields,
    recommendedRepairAction: item.recommendedRepairAction,
    evidenceAvailability: item.evidenceAvailability,
    blockedFromShortlistReason: item.blockerReason,
    suggestedNextStep: item.suggestedBatch,
    aiReviewStatus: audit.files.aiReview.found ? "AI review report available" : "No AI review report",
    applyHistoryStatus: audit.files.applyHistory.found ? "Apply history available" : "No apply history",
    safetyNote: item.safetyNote,
  };
}
