import fs from "node:fs";
import path from "node:path";
import type { BatchDecisionAction, BatchDecisionItem } from "./aiExtractionBatchDecisionGuardrails";
import { buildBatchDecisionAudit, selectBatchDecisionItems } from "./aiExtractionBatchDecisionWorkflow";

export type BatchBulkDecisionPreview = {
  generatedAt: string;
  mode: string;
  decision: BatchDecisionAction;
  source: string;
  summary: {
    candidateFieldsSelected: number;
    candidateFieldsExcluded: number;
    wouldApproveCount: number;
    wouldRejectCount: number;
    wouldPreserveExistingApprovalsCount: number;
  };
  selected: BatchDecisionItem[];
  excluded: Array<BatchDecisionItem & { exclusionReasons: string[] }>;
  approvalRecords: any[];
  outputPath?: string;
};

export type BatchBulkDecisionOptions = {
  decision: BatchDecisionAction;
  source?: string;
  reviewPath?: string;
  approvalsPath?: string;
  applyHistoryPath?: string;
  writeApprovalsFile?: boolean;
  overwriteExistingApprovals?: boolean;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function defaultPath(fileName: string) {
  return path.join("reports", fileName);
}

function readApprovalStore(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { mode: "local approval store only; no DB writes; no apply; no delete; no OpenAI calls", updatedAt: "", approvals: [] as any[] };
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return { mode: parsed?.mode || "local approval store only; no DB writes; no apply; no delete; no OpenAI calls", updatedAt: parsed?.updatedAt || "", approvals: Array.isArray(parsed?.approvals) ? parsed.approvals : [] };
}

function approvalId(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

function approvalFor(item: BatchDecisionItem, decision: BatchDecisionAction) {
  const now = new Date().toISOString();
  const reject = decision === "reject_invalid";
  return {
    approvalId: approvalId(item.candidateId, item.fieldName),
    candidateId: item.candidateId,
    fieldName: item.fieldName,
    currentValue: item.currentValue,
    suggestedValue: item.suggestedValue,
    parserValue: item.parserValue,
    aiEvidence: item.evidence,
    aiConfidence: item.confidence,
    decision: reject ? "reject_suggestion" : "approve_suggestion",
    riskLevel: reject ? "rejected" : "safe",
    reviewerNote: reject ? "Bulk rejected by batch decision workflow" : "Bulk approved by batch decision workflow",
    overrideReason: "",
    createdAt: now,
    updatedAt: now,
    source: "batch_decision_workflow",
    decisionMode: reject ? "bulk_safe_reject" : "bulk_safe_approve",
    decidedAt: now,
    safetyReasons: item.reasons,
    evidenceSummary: item.evidence,
  };
}

export function previewBatchBulkDecision(options: BatchBulkDecisionOptions): BatchBulkDecisionPreview {
  const source = options.source || "batch_promotion";
  const audit = buildBatchDecisionAudit({ reviewPath: options.reviewPath, approvalsPath: options.approvalsPath, applyHistoryPath: options.applyHistoryPath, source });
  const { selected, excluded } = selectBatchDecisionItems(audit.items, options.decision);
  const approvalRecords = selected.map((item) => approvalFor(item, options.decision));
  return {
    generatedAt: new Date().toISOString(),
    mode: "preview only; approvals file not changed; no candidate DB writes; no staging writes; no apply; no rollback; no delete; no OpenAI calls",
    decision: options.decision,
    source,
    summary: {
      candidateFieldsSelected: selected.length,
      candidateFieldsExcluded: excluded.length,
      wouldApproveCount: options.decision === "approve_safe" ? selected.length : 0,
      wouldRejectCount: options.decision === "reject_invalid" ? selected.length : 0,
      wouldPreserveExistingApprovalsCount: audit.summary.existingApprovalsPreserved,
    },
    selected,
    excluded,
    approvalRecords,
  };
}

export function applyBatchBulkDecision(options: BatchBulkDecisionOptions) {
  const approvalsPath = options.approvalsPath || defaultPath("ai-extraction-approvals.json");
  const preview = previewBatchBulkDecision(options);
  if (!options.writeApprovalsFile) return { ...preview, mode: preview.mode };
  const store = readApprovalStore(approvalsPath);
  const byId = new Map(store.approvals.map((approval: any) => [clean(approval.approvalId), approval]));
  let written = 0;
  let preserved = 0;
  for (const approval of preview.approvalRecords) {
    if (byId.has(approval.approvalId) && !options.overwriteExistingApprovals) {
      preserved += 1;
      continue;
    }
    byId.set(approval.approvalId, approval);
    written += 1;
  }
  const fullPath = path.resolve(approvalsPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({ ...store, updatedAt: new Date().toISOString(), approvals: Array.from(byId.values()) }, null, 2)}\n`);
  return { ...preview, mode: "approvals file write only; no candidate DB writes; no staging writes; no apply; no rollback; no delete; no OpenAI calls", writtenCount: written, preservedCount: preserved, outputPath: fullPath };
}

export function writeBatchBulkDecisionPreview(report: BatchBulkDecisionPreview, outputPath = defaultPath("ai-extraction-batch-bulk-decision-preview.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`);
  return fullPath;
}
