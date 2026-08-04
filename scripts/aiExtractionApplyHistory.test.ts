import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApplyHistory, writeApplyHistoryReport } from "../lib/aiExtractionApplyHistory";
import { buildApplyHistorySummary } from "../lib/aiExtractionApplyHistorySummary";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apply-history-"));
const paths = {
  approvalsPath: path.join(tmp, "approvals.json"),
  applyPlanPath: path.join(tmp, "apply-plan.json"),
  stagingPath: path.join(tmp, "staging.json"),
  backupPath: path.join(tmp, "backup.json"),
  rollbackPath: path.join(tmp, "rollback.json"),
  resultPath: path.join(tmp, "result.json"),
  postAuditPath: path.join(tmp, "post-audit.json"),
};
const stagingItem = {
  stagingId: "s1",
  candidateId: "c1",
  candidateName: "Jane Fico",
  fieldName: "currentCompany",
  currentValue: "",
  approvedValue: "Accenture",
  aiEvidence: "Accenture Jan 2024 - Present",
  riskLevel: "safe",
  validationStatus: "valid",
  validationReasons: [],
  stagedBy: "local-review",
};
writeJson(paths.approvalsPath, { approvals: [] });
writeJson(paths.applyPlanPath, { items: [] });
writeJson(paths.stagingPath, { items: [stagingItem, { ...stagingItem, stagingId: "s2", candidateId: "c2", approvedValue: "Deloitte" }, { ...stagingItem, stagingId: "s3", candidateId: "c3", fieldName: "unknownField" }] });
writeJson(paths.backupPath, { entries: [{ stagingId: "s1", candidateId: "c1", fieldName: "currentCompany", candidateField: "current_company", previousValue: null, approvedValue: "Accenture" }] });
writeJson(paths.rollbackPath, { entries: [{ stagingId: "s1", candidateId: "c1", fieldName: "currentCompany", candidateField: "current_company", restoreValue: null, appliedValue: "Accenture" }] });
writeJson(paths.resultPath, { fieldAudit: [{ candidateId: "c1", fieldName: "currentCompany", candidateField: "current_company", to: "Accenture", applied: true }, { candidateId: "c2", fieldName: "currentCompany", candidateField: "current_company", to: "Deloitte", applied: true }] });
writeJson(paths.postAuditPath, { items: [{ candidateId: "c1", fieldName: "currentCompany", dbFieldName: "current_company", approvedValue: "Accenture", finalDbValue: "Accenture", status: "verified_applied" }, { candidateId: "c2", fieldName: "currentCompany", dbFieldName: "current_company", approvedValue: "Deloitte", finalDbValue: "IBM", status: "mismatch" }] });

const report = buildApplyHistory([{ id: "c1", current_company: "Accenture" }, { id: "c2", current_company: "IBM" }, { id: "c3" }], paths);
assert.equal(report.items.length, 3, "load complete history from staging + backup + rollback + result");
assert.equal(report.items.find((item) => item.candidateId === "c1")?.status, "applied_verified", "applied field with final DB value matching approvedValue classified as applied_verified");
assert.equal(report.items.find((item) => item.candidateId === "c2")?.status, "post_apply_mismatch", "mismatch classified as post_apply_mismatch");
assert.equal(report.items.find((item) => item.candidateId === "c3")?.status, "blocked", "unknown field blocked");
assert.equal(report.items.find((item) => item.candidateId === "c1")?.rollbackAvailable, true, "rollback file exists for applied field");
assert.equal(report.summary.postApplyVerified, 1, "summary counts verified apply");
assert.equal(report.summary.postApplyMismatch, 1, "summary counts mismatch");

const noBackup = buildApplyHistory([{ id: "c1", current_company: "Accenture" }], { ...paths, backupPath: path.join(tmp, "missing-backup.json") });
assert.equal(noBackup.files.backupFound, false, "missing backup file handled gracefully");
assert.equal(noBackup.items[0].backupAvailable, false, "backup availability false when file missing");
const noRollback = buildApplyHistory([{ id: "c1", current_company: "Accenture" }], { ...paths, rollbackPath: path.join(tmp, "missing-rollback.json") });
assert.equal(noRollback.files.rollbackFound, false, "missing rollback file handled gracefully");
const noPostAudit = buildApplyHistory([{ id: "c1", current_company: "Accenture" }], { ...paths, postAuditPath: path.join(tmp, "missing-post-audit.json") });
assert.equal(noPostAudit.files.postAuditFound, false, "missing post-audit file handled gracefully");
assert.equal(noPostAudit.items[0].status, "applied_verified", "result + current DB can still verify without post-audit file");
const preserved = buildApplyHistory([{ id: "c1", current_company: "Accenture" }], { ...paths, resultPath: path.join(tmp, "missing-result.json"), postAuditPath: path.join(tmp, "missing-post-audit.json") });
assert.equal(preserved.items[0].status, "preserved_already_applied", "already applied classified as preserved_already_applied");

const summary = buildApplyHistorySummary(report.items, report.files);
assert.equal(summary.stagedFields, 3, "UI helper summary works");
const outputPath = writeApplyHistoryReport(report, path.join(tmp, "candidate-apply-history.json"));
assert.equal(fs.existsSync(outputPath), true, "history report can be written by audit script helper");

const source = fs.readFileSync(new URL("../lib/aiExtractionApplyHistory.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../lib/aiExtractionApplyHistoryValidator.ts", import.meta.url), "utf8") +
  fs.readFileSync(new URL("../app/api/recruiter/ai-extraction-review/apply-history/route.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "no DB writes in apply history code");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "no OpenAI calls in apply history code");
assert.equal(/export async function GET/.test(source), true, "API returns summary and items through GET route source");
assert.equal(/buildApplyHistory/.test(source), true, "API route uses history builder");

console.log("AI extraction apply history tests passed");