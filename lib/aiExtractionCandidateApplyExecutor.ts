import fs from "node:fs";
import path from "node:path";
import type { CandidateApplyBackup } from "./aiExtractionCandidateBackup";
import type { CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";
import type { CandidateRollbackPlan } from "./aiExtractionCandidateRollback";

export type CandidateApplyExecutionMode = "dry_run" | "confirmed_apply";

export type CandidateApplyExecutionResult = {
  mode: string;
  executionMode: CandidateApplyExecutionMode;
  dryRun: boolean;
  appliedCount: number;
  preservedCount: number;
  blockedCount: number;
  skippedCount: number;
  backupRequired: boolean;
  backupReady: boolean;
  rollbackReady: boolean;
  backupPath?: string;
  rollbackPath?: string;
  resultPath?: string;
  postAuditPath?: string;
  fieldAudit: Array<{ candidateId: string; fieldName: string; candidateField: string; from: any; to: any; applied: boolean; reason: string }>;
};

export type CandidateApplyPostAuditItem = {
  candidateId: string;
  fieldName: string;
  dbFieldName: string;
  approvedValue: any;
  finalDbValue: any;
  status: "verified_applied" | "not_applied" | "mismatch";
};

export type CandidateApplyPostAudit = {
  mode: string;
  executionMode: CandidateApplyExecutionMode;
  verifiedCount: number;
  mismatchCount: number;
  items: CandidateApplyPostAuditItem[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase();
}

export async function executeCandidateApplyPlan(
  plan: CandidateApplyPlan,
  options: {
    writeCandidateUpdates?: boolean;
    confirmApply?: boolean;
    backup?: CandidateApplyBackup | null;
    rollback?: CandidateRollbackPlan | null;
    updateCandidate?: (candidateId: string, update: Record<string, any>) => Promise<void>;
    backupPath?: string;
    rollbackPath?: string;
    resultPath?: string;
    postAuditPath?: string;
  } = {},
): Promise<CandidateApplyExecutionResult> {
  const confirmedApply = Boolean(options.writeCandidateUpdates && options.confirmApply);
  const resultPath = options.resultPath || path.resolve("reports", "candidate-apply-result.json");
  const backupReady = Boolean(options.backup?.entries?.length || !plan.eligibleItems.length);
  const rollbackReady = Boolean(options.rollback?.entries?.length || !plan.eligibleItems.length);
  if (!confirmedApply) {
    return {
      mode: "dry-run only; no candidate DB writes",
      executionMode: "dry_run",
      dryRun: true,
      appliedCount: 0,
      preservedCount: plan.preservedItems.length,
      blockedCount: plan.blockedItems.length,
      skippedCount: plan.items.length,
      backupRequired: plan.backupRequired,
      backupReady,
      rollbackReady,
      backupPath: options.backupPath,
      rollbackPath: options.rollbackPath,
      resultPath,
      postAuditPath: options.postAuditPath,
      fieldAudit: plan.items.map((item) => ({
        candidateId: item.candidateId,
        fieldName: item.fieldName,
        candidateField: item.candidateField,
        from: item.currentDbValue,
        to: item.approvedValue,
        applied: false,
        reason: item.eligible ? "dry-run only" : item.reasons.join("; "),
      })),
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
  for (const item of plan.preservedItems) {
    fieldAudit.push({ candidateId: item.candidateId, fieldName: item.fieldName, candidateField: item.candidateField, from: item.currentDbValue, to: item.approvedValue, applied: false, reason: item.reasons.join("; ") });
  }
  for (const item of plan.blockedItems) {
    fieldAudit.push({ candidateId: item.candidateId, fieldName: item.fieldName, candidateField: item.candidateField, from: item.currentDbValue, to: item.approvedValue, applied: false, reason: item.reasons.join("; ") });
  }
  return {
    mode: "CONFIRMED REAL APPLY; candidate DB field updates enabled",
    executionMode: "confirmed_apply",
    dryRun: false,
    appliedCount,
    preservedCount: plan.preservedItems.length,
    blockedCount: plan.blockedItems.length,
    skippedCount: plan.blockedItems.length + plan.preservedItems.length,
    backupRequired: plan.backupRequired,
    backupReady,
    rollbackReady,
    backupPath: options.backupPath,
    rollbackPath: options.rollbackPath,
    resultPath,
    postAuditPath: options.postAuditPath,
    fieldAudit,
  };
}

export function buildCandidateApplyPostAudit(result: CandidateApplyExecutionResult, candidates: Record<string, any>[]): CandidateApplyPostAudit {
  const candidatesById = new Map(candidates.map((candidate) => [clean(candidate.id || candidate.candidate_id), candidate]));
  const items = result.fieldAudit.filter((item) => item.applied).map((item) => {
    const candidate = candidatesById.get(clean(item.candidateId));
    const finalDbValue = candidate?.[item.candidateField];
    const status: CandidateApplyPostAuditItem["status"] = !candidate
      ? "not_applied"
      : norm(finalDbValue) === norm(item.to)
        ? "verified_applied"
        : "mismatch";
    return {
      candidateId: item.candidateId,
      fieldName: item.fieldName,
      dbFieldName: item.candidateField,
      approvedValue: item.to,
      finalDbValue,
      status,
    };
  });
  return {
    mode: "post-apply verification",
    executionMode: result.executionMode,
    verifiedCount: items.filter((item) => item.status === "verified_applied").length,
    mismatchCount: items.filter((item) => item.status === "mismatch" || item.status === "not_applied").length,
    items,
  };
}

export function writeCandidateApplyResult(result: CandidateApplyExecutionResult, outputPath = path.join("reports", "candidate-apply-result.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const resultWithPath = { ...result, resultPath: fullPath };
  fs.writeFileSync(fullPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), ...resultWithPath }, null, 2)}\n`);
  return fullPath;
}

export function writeCandidatePostAudit(audit: CandidateApplyPostAudit, outputPath = path.join("reports", "candidate-apply-post-audit.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({ exportedAt: new Date().toISOString(), ...audit, postAuditPath: fullPath }, null, 2)}\n`);
  return fullPath;
}