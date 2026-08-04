import fs from "node:fs";
import path from "node:path";
import { buildApplyHistorySummary, type ApplyHistorySummary } from "./aiExtractionApplyHistorySummary";
import { validateApplyHistoryItem, type ApplyHistoryStatus } from "./aiExtractionApplyHistoryValidator";

export type ApplyHistoryFiles = {
  approvalsPath: string;
  applyPlanPath: string;
  stagingPath: string;
  backupPath: string;
  rollbackPath: string;
  resultPath: string;
  postAuditPath: string;
  approvalsFound: boolean;
  applyPlanFound: boolean;
  stagingFound: boolean;
  backupFound: boolean;
  rollbackFound: boolean;
  resultFound: boolean;
  postAuditFound: boolean;
  messages: string[];
};

export type ApplyHistoryItem = {
  historyId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  dbFieldName: string;
  beforeValue: any;
  stagingCurrentValue: any;
  approvedValue: any;
  currentDbValue: any;
  finalDbValue: any;
  status: ApplyHistoryStatus;
  source: string;
  riskLevel: string;
  backupAvailable: boolean;
  rollbackAvailable: boolean;
  backupStatus: "available" | "missing";
  rollbackStatus: "available" | "missing";
  backupOldValue: any;
  rollbackValue: any;
  validationMessages: string[];
  evidence: string;
  filePaths: string[];
  safetyNote: string;
  lastChecked: string;
};

export type ApplyHistoryReport = {
  generatedAt: string;
  mode: string;
  summary: ApplyHistorySummary;
  items: ApplyHistoryItem[];
  files: ApplyHistoryFiles;
};

export type ApplyHistoryOptions = Partial<Pick<ApplyHistoryFiles, "approvalsPath" | "applyPlanPath" | "stagingPath" | "backupPath" | "rollbackPath" | "resultPath" | "postAuditPath">>;

type ReadResult = { found: boolean; data: any; message?: string };

const DEFAULT_PATHS = {
  approvalsPath: path.join("reports", "ai-extraction-approvals.json"),
  applyPlanPath: path.join("reports", "ai-extraction-apply-plan.json"),
  stagingPath: path.join("reports", "ai-extraction-staging.json"),
  backupPath: path.join("reports", "candidate-apply-backup.json"),
  rollbackPath: path.join("reports", "candidate-apply-rollback.json"),
  resultPath: path.join("reports", "candidate-apply-result.json"),
  postAuditPath: path.join("reports", "candidate-apply-post-audit.json"),
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string): ReadResult {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null, message: `Missing report file: ${filePath}` };
  try {
    return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) };
  } catch (error) {
    return { found: false, data: null, message: `Malformed report file: ${filePath}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function key(candidateId: string, fieldName: string) {
  return `${candidateId}:${fieldName}`;
}

function byStagingIdOrField<T extends Record<string, any>>(entries: T[], valueName: "stagingId" | "sourceApprovalId" = "stagingId") {
  const byId = new Map<string, T>();
  const byField = new Map<string, T>();
  for (const entry of entries) {
    if (entry[valueName]) byId.set(clean(entry[valueName]), entry);
    if (entry.stagingId) byId.set(clean(entry.stagingId), entry);
    byField.set(key(clean(entry.candidateId), clean(entry.fieldName)), entry);
  }
  return { byId, byField };
}

function postAuditItems(data: any) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.fieldAudit)) {
    return data.fieldAudit.map((item: any) => ({
      candidateId: item.candidateId,
      fieldName: item.fieldName,
      dbFieldName: item.candidateField,
      approvedValue: item.to,
      finalDbValue: undefined,
      status: item.applied ? "verified_applied" : undefined,
    }));
  }
  return [];
}

function candidateId(candidate: Record<string, any>) {
  return clean(candidate.id || candidate.candidate_id);
}

export function buildApplyHistory(candidates: Record<string, any>[], options: ApplyHistoryOptions = {}): ApplyHistoryReport {
  const generatedAt = new Date().toISOString();
  const paths = { ...DEFAULT_PATHS, ...options };
  const approvals = readJson(paths.approvalsPath);
  const applyPlan = readJson(paths.applyPlanPath);
  const staging = readJson(paths.stagingPath);
  const backup = readJson(paths.backupPath);
  const rollback = readJson(paths.rollbackPath);
  const result = readJson(paths.resultPath);
  const postAudit = readJson(paths.postAuditPath);
  const messages = [approvals, applyPlan, staging, backup, rollback, result, postAudit].flatMap((read) => read.message ? [read.message] : []);

  const stagingItems = Array.isArray(staging.data?.items) ? staging.data.items : [];
  const backupIndex = byStagingIdOrField(Array.isArray(backup.data?.entries) ? backup.data.entries : []);
  const rollbackIndex = byStagingIdOrField(Array.isArray(rollback.data?.entries) ? rollback.data.entries : []);
  const resultIndex = byStagingIdOrField(Array.isArray(result.data?.fieldAudit) ? result.data.fieldAudit : []);
  const postAuditIndex = byStagingIdOrField(postAuditItems(postAudit.data));
  const candidatesById = new Map(candidates.map((candidate) => [candidateId(candidate), candidate]));
  const checkedAt = generatedAt;

  const items: ApplyHistoryItem[] = stagingItems.map((item: any) => {
    const rowKey = key(clean(item.candidateId), clean(item.fieldName));
    const backupEntry = backupIndex.byId.get(clean(item.stagingId)) || backupIndex.byField.get(rowKey);
    const rollbackEntry = rollbackIndex.byId.get(clean(item.stagingId)) || rollbackIndex.byField.get(rowKey);
    const resultAudit = resultIndex.byField.get(rowKey) || resultIndex.byId.get(clean(item.stagingId));
    const postItem = postAuditIndex.byField.get(rowKey) || postAuditIndex.byId.get(clean(item.stagingId));
    const candidate = candidatesById.get(clean(item.candidateId));
    const validation = validateApplyHistoryItem({
      candidateId: clean(item.candidateId),
      fieldName: clean(item.fieldName),
      approvedValue: item.approvedValue,
      stagingCurrentValue: item.currentValue,
      validationStatus: item.validationStatus,
      validationReasons: item.validationReasons,
      riskLevel: item.riskLevel,
      candidate,
      resultAudit,
      postAudit: postItem,
      backupEntry,
      rollbackEntry,
      hasStagingFile: staging.found,
    });
    const filePaths = [
      paths.stagingPath,
      backupEntry ? paths.backupPath : "",
      rollbackEntry ? paths.rollbackPath : "",
      resultAudit ? paths.resultPath : "",
      postItem ? paths.postAuditPath : "",
    ].filter(Boolean);
    return {
      historyId: clean(item.stagingId) || rowKey,
      candidateId: clean(item.candidateId),
      candidateName: clean(item.candidateName || candidate?.name || candidate?.fullName || candidate?.displayName || "Unknown candidate"),
      fieldName: clean(item.fieldName),
      dbFieldName: validation.dbFieldName,
      beforeValue: backupEntry && Object.prototype.hasOwnProperty.call(backupEntry, "previousValue") ? backupEntry.previousValue : item.currentValue,
      stagingCurrentValue: item.currentValue,
      approvedValue: item.approvedValue,
      currentDbValue: validation.finalDbValue,
      finalDbValue: validation.finalDbValue,
      status: validation.status,
      source: postItem ? "post-apply audit" : resultAudit?.applied ? "confirmed apply result" : item.stagedBy || "local-review",
      riskLevel: clean(item.riskLevel || "safe"),
      backupAvailable: validation.backupAvailable,
      rollbackAvailable: validation.rollbackAvailable,
      backupStatus: validation.backupAvailable ? "available" : "missing",
      rollbackStatus: validation.rollbackAvailable ? "available" : "missing",
      backupOldValue: backupEntry?.previousValue,
      rollbackValue: rollbackEntry?.restoreValue,
      validationMessages: validation.messages,
      evidence: clean(item.aiEvidence),
      filePaths,
      safetyNote: "READ-ONLY AUDIT VIEW. This row was built from report files and current candidate data only.",
      lastChecked: checkedAt,
    };
  });

  const files: ApplyHistoryFiles = {
    ...paths,
    approvalsFound: approvals.found,
    applyPlanFound: applyPlan.found,
    stagingFound: staging.found,
    backupFound: backup.found,
    rollbackFound: rollback.found,
    resultFound: result.found,
    postAuditFound: postAudit.found,
    messages,
  };

  return {
    generatedAt,
    mode: "read-only audit; no candidate DB writes; no apply; no rollback; no delete",
    summary: buildApplyHistorySummary(items, files),
    items,
    files,
  };
}

export function writeApplyHistoryReport(report: ApplyHistoryReport, outputPath = path.join("reports", "candidate-apply-history.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`);
  return fullPath;
}