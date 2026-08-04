import fs from "node:fs";
import path from "node:path";
import { buildCandidateApplyPlan, type CandidateApplyPlan } from "./aiExtractionCandidateApplyPlan";
import { buildCandidateApplyPostAudit, executeCandidateApplyPlan, writeCandidateApplyResult, writeCandidatePostAudit } from "./aiExtractionCandidateApplyExecutor";
import { loadRealTalentPoolCandidates } from "./candidateAudit";
import { buildQuickFixSubsetBackup, buildQuickFixSubsetRollback, writeQuickFixSubsetBackup, writeQuickFixSubsetRollback } from "./quickFixApplySubsetBackup";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export function loadQuickFixSubsetItems(subsetPath = path.join("reports", "quick-fix-apply-subset.json")) {
  const parsed = readJson(subsetPath);
  return Array.isArray(parsed?.subsetItems) ? parsed.subsetItems : [];
}

export async function buildQuickFixSubsetApplyPlan(subsetPath = path.join("reports", "quick-fix-apply-subset.json")): Promise<CandidateApplyPlan> {
  const subsetItems = loadQuickFixSubsetItems(subsetPath);
  const { candidates } = await loadRealTalentPoolCandidates();
  const plan = buildCandidateApplyPlan(subsetItems as any, candidates);
  const items = plan.items.map((item) => {
    if (item.fieldName !== "currentCompany") {
      return { ...item, eligible: false, blocked: true, preserved: false, applyStatus: "blocked" as const, reasons: [...item.reasons, "field not enabled for quick-fix subset apply v1"], update: {} };
    }
    return item;
  });
  const eligibleItems = items.filter((item) => item.eligible);
  const blockedItems = items.filter((item) => item.blocked);
  const preservedItems = items.filter((item) => item.preserved);
  const conflicts = items.filter((item) => item.conflict);
  return { ...plan, items, eligibleItems, blockedItems, preservedItems, conflicts, fieldsEligibleForApply: eligibleItems.length, fieldsBlocked: blockedItems.length, conflictsDetected: conflicts.length, fieldsAlreadyAppliedPreserved: preservedItems.length, backupRequired: eligibleItems.length > 0, rollbackReady: eligibleItems.length > 0, wouldUpdateCount: eligibleItems.length, wouldPreserveCount: preservedItems.length };
}

export async function previewQuickFixSubsetApply(subsetPath?: string) {
  const plan = await buildQuickFixSubsetApplyPlan(subsetPath);
  const result = await executeCandidateApplyPlan(plan, { resultPath: path.resolve("reports", "quick-fix-subset-apply-preview.json") });
  writeCandidateApplyResult(result, "reports/quick-fix-subset-apply-preview.json");
  return { plan, result };
}

export async function executeQuickFixSubsetApply(options: { subsetPath?: string; writeCandidateUpdates?: boolean; confirmApplySubset?: boolean; updateCandidate?: (candidateId: string, update: Record<string, any>) => Promise<void> } = {}) {
  const plan = await buildQuickFixSubsetApplyPlan(options.subsetPath);
  const realApply = Boolean(options.writeCandidateUpdates && options.confirmApplySubset);
  if (!realApply) {
    const result = await executeCandidateApplyPlan(plan, { resultPath: path.resolve("reports", "quick-fix-subset-apply-preview.json") });
    writeCandidateApplyResult(result, "reports/quick-fix-subset-apply-preview.json");
    return { plan, result, backupPath: "", rollbackPath: "", postAuditPath: "" };
  }
  const backup = buildQuickFixSubsetBackup(plan);
  const backupPath = writeQuickFixSubsetBackup(backup);
  const rollback = buildQuickFixSubsetRollback(backup);
  const rollbackPath = writeQuickFixSubsetRollback(rollback);
  const result = await executeCandidateApplyPlan(plan, { writeCandidateUpdates: true, confirmApply: true, backup, rollback, backupPath, rollbackPath, resultPath: path.resolve("reports", "quick-fix-subset-apply-result.json"), updateCandidate: options.updateCandidate });
  const { candidates } = await loadRealTalentPoolCandidates();
  const postAudit = buildCandidateApplyPostAudit(result, candidates);
  const postAuditPath = writeCandidatePostAudit(postAudit, "reports/quick-fix-subset-apply-post-audit.json");
  writeCandidateApplyResult({ ...result, postAuditPath }, "reports/quick-fix-subset-apply-result.json");
  return { plan, result, backupPath, rollbackPath, postAuditPath };
}
