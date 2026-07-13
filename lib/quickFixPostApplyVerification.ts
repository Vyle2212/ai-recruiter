import fs from "node:fs";
import path from "node:path";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) { return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim(); }
function norm(value: any) { return clean(value).toLowerCase(); }
function readJson(filePath: string) { const fullPath = path.resolve(filePath); if (!fs.existsSync(fullPath)) return { found: false, data: null }; try { return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) }; } catch { return { found: true, data: null }; } }

export type QuickFixVerificationStatus = "pending_apply" | "verified_applied" | "mismatch";
export type QuickFixPostApplyVerificationItem = {
  candidateId: string; candidateName: string; fieldName: string; approvedValue: string; finalDbValue: string; verificationStatus: QuickFixVerificationStatus; backupStatus: "backup_available" | "backup_missing"; rollbackStatus: "rollback_available" | "rollback_missing"; safetyNote: string;
};

export function buildQuickFixPostApplyVerification(options: { subsetPath?: string; resultPath?: string; postAuditPath?: string; backupPath?: string; rollbackPath?: string } = {}) {
  const subsetPath = options.subsetPath || path.join("reports", "quick-fix-apply-subset.json");
  const resultPath = options.resultPath || path.join("reports", "quick-fix-subset-apply-result.json");
  const postAuditPath = options.postAuditPath || path.join("reports", "quick-fix-subset-apply-post-audit.json");
  const backupPath = options.backupPath || path.join("reports", "quick-fix-subset-apply-backup.json");
  const rollbackPath = options.rollbackPath || path.join("reports", "quick-fix-subset-apply-rollback.json");
  const subset = readJson(subsetPath); const result = readJson(resultPath); const postAudit = readJson(postAuditPath); const backup = readJson(backupPath); const rollback = readJson(rollbackPath);
  const auditByKey = new Map((Array.isArray(postAudit.data?.items) ? postAudit.data.items : []).map((item: any) => [`${clean(item.candidateId)}:${clean(item.fieldName)}`, item]));
  const items: QuickFixPostApplyVerificationItem[] = (Array.isArray(subset.data?.subsetItems) ? subset.data.subsetItems : []).map((item: any) => {
    const key = `${clean(item.candidateId)}:${clean(item.fieldName)}`; const audit = auditByKey.get(key) as any;
    const finalDbValue = clean(audit?.finalDbValue);
    const status: QuickFixVerificationStatus = !result.found || !postAudit.found ? "pending_apply" : audit && norm(finalDbValue) === norm(item.approvedValue) ? "verified_applied" : "mismatch";
    return { candidateId: clean(item.candidateId), candidateName: clean(item.candidateName), fieldName: clean(item.fieldName), approvedValue: clean(item.approvedValue), finalDbValue, verificationStatus: status, backupStatus: backup.found ? "backup_available" : "backup_missing", rollbackStatus: rollback.found ? "rollback_available" : "rollback_missing", safetyNote: "Read-only verification. Candidate records are not updated." };
  });
  return { generatedAt: new Date().toISOString(), mode: "read-only post-apply verification; no candidate DB writes; no rollback; no delete; no OpenAI calls", subsetItems: items.length, appliedVerified: items.filter(i=>i.verificationStatus==="verified_applied").length, pendingApply: items.filter(i=>i.verificationStatus==="pending_apply").length, mismatch: items.filter(i=>i.verificationStatus==="mismatch").length, backupAvailable: backup.found, rollbackAvailable: rollback.found, items, files: { subset: { path: subsetPath, found: subset.found }, result: { path: resultPath, found: result.found }, postAudit: { path: postAuditPath, found: postAudit.found }, backup: { path: backupPath, found: backup.found }, rollback: { path: rollbackPath, found: rollback.found } } };
}
export function writeQuickFixPostApplyVerification(report: ReturnType<typeof buildQuickFixPostApplyVerification>, outputPath = path.join("reports", "quick-fix-post-apply-verification.json")) { return writeWorkflowJson(outputPath, report); }
