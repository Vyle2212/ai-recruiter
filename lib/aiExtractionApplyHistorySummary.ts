import type { ApplyHistoryStatus } from "./aiExtractionApplyHistoryValidator";

export type ApplyHistorySummary = {
  stagedFields: number;
  eligibleFields: number;
  alreadyAppliedPreservedFields: number;
  appliedFields: number;
  blockedFields: number;
  conflicts: number;
  backupAvailable: boolean;
  rollbackAvailable: boolean;
  postApplyVerified: number;
  postApplyMismatch: number;
  missingBackupOrRollback: number;
};

export type ApplyHistorySummaryItem = {
  status: ApplyHistoryStatus;
  backupAvailable: boolean;
  rollbackAvailable: boolean;
};

export function buildApplyHistorySummary(items: ApplyHistorySummaryItem[], files: { backupFound: boolean; rollbackFound: boolean }): ApplyHistorySummary {
  return {
    stagedFields: items.length,
    eligibleFields: items.filter((item) => item.status === "eligible_for_apply" || item.status === "staged_pending_apply").length,
    alreadyAppliedPreservedFields: items.filter((item) => item.status === "preserved_already_applied").length,
    appliedFields: items.filter((item) => item.status === "applied_verified").length,
    blockedFields: items.filter((item) => item.status === "blocked" || item.status === "missing_candidate" || item.status === "missing_report_file").length,
    conflicts: items.filter((item) => item.status === "conflict" || item.status === "post_apply_mismatch").length,
    backupAvailable: files.backupFound,
    rollbackAvailable: files.rollbackFound,
    postApplyVerified: items.filter((item) => item.status === "applied_verified").length,
    postApplyMismatch: items.filter((item) => item.status === "post_apply_mismatch").length,
    missingBackupOrRollback: items.filter((item) => !item.backupAvailable || !item.rollbackAvailable).length,
  };
}