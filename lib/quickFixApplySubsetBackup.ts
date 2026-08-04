import type { CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";
import { buildCandidateApplyBackup, writeCandidateApplyBackup } from "./aiExtractionCandidateBackup";
import { buildCandidateRollbackPlan, writeCandidateRollbackPlan } from "./aiExtractionCandidateRollback";

export function buildQuickFixSubsetBackup(plan: CandidateApplyPlan) {
  return buildCandidateApplyBackup(plan);
}
export function writeQuickFixSubsetBackup(backup: ReturnType<typeof buildCandidateApplyBackup>, outputPath = "reports/quick-fix-subset-apply-backup.json") {
  return writeCandidateApplyBackup(backup, outputPath);
}
export function buildQuickFixSubsetRollback(backup: ReturnType<typeof buildCandidateApplyBackup>) {
  return buildCandidateRollbackPlan(backup);
}
export function writeQuickFixSubsetRollback(rollback: ReturnType<typeof buildCandidateRollbackPlan>, outputPath = "reports/quick-fix-subset-apply-rollback.json") {
  return writeCandidateRollbackPlan(rollback, outputPath);
}
