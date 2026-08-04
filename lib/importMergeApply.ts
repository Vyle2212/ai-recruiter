import fs from "node:fs";
import path from "node:path";
import type { ImportMergeBackup, ImportMergePlan, ImportMergePostAudit, ImportMergeResult, ImportMergeRollback } from "./importMergeTypes";

export type ImportMergeApplyOptions = {
  writeCandidateUpdates?: boolean;
  confirmImportMerge?: boolean;
  outputDir?: string;
  updateCandidate?: (candidateId: string, update: Record<string, unknown>) => Promise<void>;
  readCandidates?: (candidateIds: string[]) => Promise<Record<string, Record<string, unknown>>>;
};
function write(outputDir: string, fileName: string, value: unknown) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  return outputPath;
}
export function validateImportMergeApplyMode(writeCandidateUpdates = false, confirmImportMerge = false) {
  if (writeCandidateUpdates !== confirmImportMerge) throw new Error("Real import merge apply requires both --writeCandidateUpdates and --confirmImportMerge.");
  return writeCandidateUpdates && confirmImportMerge ? "confirmed_apply" as const : "dry_run" as const;
}
export function buildImportMergeBackup(plan: ImportMergePlan): ImportMergeBackup {
  return { generatedAt: new Date().toISOString(), mode: "import merge backup; created before candidate DB writes", items: plan.items.map((item) => ({ proposalId: item.proposalId, candidateId: item.candidateId, fieldName: item.fieldName, dbFieldName: item.dbFieldName, oldValue: item.beforeValue, newValue: item.afterValue })) };
}
export function buildImportMergeRollback(backup: ImportMergeBackup): ImportMergeRollback {
  return { generatedAt: new Date().toISOString(), mode: "import merge rollback plan; no automatic rollback", safe: backup.items.every((item) => Boolean(item.candidateId && item.dbFieldName)), items: backup.items.map((item) => ({ proposalId: item.proposalId, candidateId: item.candidateId, dbFieldName: item.dbFieldName, rollbackValue: item.oldValue })) };
}
function validatePlan(plan: ImportMergePlan) {
  const blocked = plan.items.filter((item) => !item.candidateId || !item.dbFieldName || item.decision !== "approve_merge");
  if (blocked.length) throw new Error("Import merge plan contains blocked or invalid updates.");
  if (plan.excluded.some((item) => item.decision === "approve_merge" && ["candidate_confirmed", "recruiter_approved"].includes(item.existingTrustLevel))) throw new Error("Import merge plan attempts a trusted-field overwrite.");
}
export async function executeImportMergePlan(plan: ImportMergePlan, options: ImportMergeApplyOptions = {}) {
  validatePlan(plan);
  const mode = validateImportMergeApplyMode(Boolean(options.writeCandidateUpdates), Boolean(options.confirmImportMerge));
  const outputDir = path.resolve(options.outputDir || path.join("reports", "import"));
  const backup = buildImportMergeBackup(plan);
  const backupPath = write(outputDir, "import-merge-backup.json", backup);
  const rollback = buildImportMergeRollback(backup);
  const rollbackPath = write(outputDir, "import-merge-rollback.json", rollback);
  const resultItems: ImportMergeResult["items"] = [];
  if (mode === "confirmed_apply") {
    if (!options.updateCandidate) throw new Error("Confirmed import merge requires an updateCandidate implementation.");
    const grouped = new Map<string, Record<string, unknown>>();
    for (const item of plan.items) grouped.set(item.candidateId, { ...(grouped.get(item.candidateId) || {}), [item.dbFieldName]: item.afterValue });
    for (const [candidateId, update] of grouped) {
      try {
        await options.updateCandidate(candidateId, update);
        for (const item of plan.items.filter((entry) => entry.candidateId === candidateId)) resultItems.push({ proposalId: item.proposalId, candidateId, dbFieldName: item.dbFieldName, expectedValue: item.afterValue, status: "applied", error: "" });
      } catch (error) {
        for (const item of plan.items.filter((entry) => entry.candidateId === candidateId)) resultItems.push({ proposalId: item.proposalId, candidateId, dbFieldName: item.dbFieldName, expectedValue: item.afterValue, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
  } else {
    for (const item of plan.items) resultItems.push({ proposalId: item.proposalId, candidateId: item.candidateId, dbFieldName: item.dbFieldName, expectedValue: item.afterValue, status: "preview", error: "" });
  }
  const result: ImportMergeResult = {
    generatedAt: new Date().toISOString(), mode: mode === "confirmed_apply" ? "confirmed import merge apply" : "dry-run import merge; no candidate DB writes",
    dryRun: mode === "dry_run", expectedFieldUpdates: plan.items.length,
    appliedCount: resultItems.filter((item) => item.status === "applied").length,
    pendingCount: resultItems.filter((item) => item.status === "preview").length,
    failedCount: resultItems.filter((item) => item.status === "failed").length,
    backupPath, rollbackPath, items: resultItems,
  };
  const resultPath = write(outputDir, "import-merge-result.json", result);
  let actualById: Record<string, Record<string, unknown>> = {};
  if (mode === "confirmed_apply" && options.readCandidates) actualById = await options.readCandidates(Array.from(new Set(plan.items.map((item) => item.candidateId))));
  const auditItems: ImportMergePostAudit["items"] = resultItems.filter((item) => item.status === "applied").map((item) => {
    const actualValue = actualById[item.candidateId]?.[item.dbFieldName];
    const status = actualValue === undefined ? "pending" as const : JSON.stringify(actualValue) === JSON.stringify(item.expectedValue) ? "verified" as const : "mismatch" as const;
    return { proposalId: item.proposalId, candidateId: item.candidateId, dbFieldName: item.dbFieldName, expectedValue: item.expectedValue, actualValue, status };
  });
  const postAudit: ImportMergePostAudit = {
    generatedAt: new Date().toISOString(), mode: "read-only import merge post-audit; no candidate DB writes",
    expectedFieldUpdates: mode === "confirmed_apply" ? plan.items.length : 0,
    appliedVerified: auditItems.filter((item) => item.status === "verified").length,
    pending: auditItems.filter((item) => item.status === "pending").length,
    mismatch: auditItems.filter((item) => item.status === "mismatch").length,
    backupAvailable: fs.existsSync(backupPath), rollbackAvailable: fs.existsSync(rollbackPath), rollbackSafe: rollback.safe, items: auditItems,
  };
  const postAuditPath = write(outputDir, "import-merge-post-audit.json", postAudit);
  return { result, backup, rollback, postAudit, backupPath, rollbackPath, resultPath, postAuditPath };
}
