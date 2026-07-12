import type { CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";
export function summarizeQuickFixSubsetApply(plan: CandidateApplyPlan) {
  return {
    subsetItemsLoaded: plan.stagedItemsLoaded,
    eligibleFieldUpdates: plan.fieldsEligibleForApply,
    blockedFieldUpdates: plan.fieldsBlocked,
    conflicts: plan.conflictsDetected,
    backupRequired: plan.backupRequired,
    rollbackReady: plan.rollbackReady,
    wouldUpdateCount: plan.wouldUpdateCount,
    wouldPreserveCount: plan.wouldPreserveCount,
  };
}
