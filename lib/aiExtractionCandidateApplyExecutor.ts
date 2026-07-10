import fs from "node:fs";
import path from "node:path";
import type { CandidateApplyBackup } from "./aiExtractionCandidateBackup";
import type { CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";
import type { CandidateRollbackPlan } from "./aiExtractionCandidateRollback";

export type CandidateApplyExecutionResult = {
  mode: string;
  dryRun: boolean;
  appliedCount: number;
  skippedCount: number;
  backupRequired: boolean;
  backupReady: boolean;
  rollbackReady: boolean;
  fieldAudit: Array<{ candidateId: string; fieldName: string; candidateField: string; from: any; to: any; applied: boolean; reason: string }>;
};

export async function executeCandidateApplyPlan(
  plan: CandidateApplyPlan,
  options: {
    writeCandidateUpdates?: boolean;
    confirmApply?: boolean;
    backup?: CandidateApplyBackup | null;
    rollback?: CandidateRollbackPlan | null;
    updateCandidate?: (candidateId: string, update: Record<string, any>) => Promise<void>;
  } = {},
): Promise<CandidateApplyExecutionResult> {
  const dryRun = !(options.writeCandidateUpdates && options.confirmApply);
  const backupReady = Boolean(options.backup?.entries?.length || !plan.eligibleItems.length);
  const rollbackReady = Boolean(options.rollback?.entries?.length || !plan.eligibleItems.length);
  if (dryRun) {
    return {
      mode: "dry-run only; no candidate DB writes",
      dryRun: true,
      appliedCount: 0,
      skippedCount: plan.items.length,
      backupRequired: plan.backupRequired,
      backupReady,
      rollbackReady,
      fieldAudit: plan.items.map((item) => ({ candidateId: item.candidateId, fieldName: item.fieldName, candidateField: item.candidateField, from: item.currentDbValue, to: item.approvedValue, applied: false, reason: item.eligible ? "dry-run only" : item.reasons.join("; ") })),
    };
  }
  if (!backupReady) throw new Error("Apply refused: backup file is required before real candidate update.");
  if (!rollbackReady) throw new Error("Apply refused: rollback file is required before real candidate update.");
  if (!options.updateCandidate) throw new Error("Apply refused: updateCandidate implementation is required for real candidate update.");
  let appliedCount = 0;
  const fieldAudit: CandidateApplyExecutionResult["fieldAudit"] = [];
  for (const item of plan.eligibleItems) {
    await options.updateCandidate(item.candidateId, item.update);
    appliedCount += 1;
    fieldAudit.push({ candidateId: item.candidateId, fieldName: item.fieldName, candidateField: item.candidateField, from: item.currentDbValue, to: item.approvedValue, applied: true, reason: "confirmed field update" });
  }
  for (const item of plan.blockedItems) {
    fieldAudit.push({ candidateId: item.candidateId, fieldName: item.fieldName, candidateField: item.candidateField, from: item.currentDbValue, to: item.approvedValue, applied: false, reason: item.reasons.join("; ") });
  }
  return {
    mode: "confirmed candidate field updates applied; no deletes; no bulk overwrite",
    dryRun: false,
    appliedCount,
    skippedCount: plan.blockedItems.length,
    backupRequired: plan.backupRequired,
    backupReady,
    rollbackReady,
    fieldAudit,
  };
}

export function writeCandidateApplyResult(result: CandidateApplyExecutionResult, outputPath = path.join("reports", "candidate-apply-result.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), ...result }, null, 2)}\n`);
  return fullPath;
}

export function writeCandidatePostAudit(result: CandidateApplyExecutionResult, outputPath = path.join("reports", "candidate-apply-post-audit.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), mode: "post-apply audit summary", appliedCount: result.appliedCount, skippedCount: result.skippedCount, fieldAudit: result.fieldAudit }, null, 2)}\n`);
  return fullPath;
}
