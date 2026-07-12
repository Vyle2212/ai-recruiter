import fs from "node:fs";
import path from "node:path";
import { evaluateBatchDecisionItem, type BatchDecisionAction, type BatchDecisionItem, type BatchDecisionRiskLevel } from "./aiExtractionBatchDecisionGuardrails";
import { summarizeBatchDecisionItems, type BatchDecisionSummary } from "./aiExtractionBatchDecisionSummary";

export type BatchDecisionWorkflowOptions = {
  reviewPath?: string;
  approvalsPath?: string;
  promotionPath?: string;
  stagingPath?: string;
  applyHistoryPath?: string;
  source?: string;
};

export type BatchDecisionAudit = {
  generatedAt: string;
  mode: string;
  summary: BatchDecisionSummary;
  items: BatchDecisionItem[];
  files: Record<string, { path: string; found: boolean }>;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null };
  try {
    return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) };
  } catch {
    return { found: true, data: null };
  }
}

function defaultPath(fileName: string) {
  return path.join("reports", fileName);
}

function approvalKey(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

function approvalList(data: any) {
  return Array.isArray(data?.approvals) ? data.approvals : Array.isArray(data) ? data : [];
}

function applyHistoryStatus(history: any, candidateId: string, fieldName: string) {
  const item = (Array.isArray(history?.items) ? history.items : []).find((entry: any) => clean(entry.candidateId) === clean(candidateId) && clean(entry.fieldName) === clean(fieldName));
  return clean(item?.status);
}

function riskFromField(field: any): BatchDecisionRiskLevel {
  const decision = clean(field?.decision);
  if (decision === "safe_accept") return "safe";
  if (decision === "conflict") return "conflict";
  if (decision === "reject") return "rejected";
  if (/blocked/i.test(clean(field?.reason))) return "blocked";
  return "risky";
}

function candidateName(candidate: any, queueItem: any) {
  return clean(queueItem?.existingName) || clean(candidate?.candidateName) || clean(candidate?.candidateId);
}

function queueByCandidate(review: any) {
  return new Map((Array.isArray(review?.queueItems) ? review.queueItems : []).map((queue: any) => [clean(queue.candidateId), queue]));
}

export function extractBatchDecisionItems(review: any, approvals: any, applyHistory: any, source = "batch_promotion"): BatchDecisionItem[] {
  const approvalMap = new Map(approvalList(approvals).map((approval: any) => [approvalKey(approval.candidateId, approval.fieldName), approval]));
  const queues = queueByCandidate(review);
  const items: BatchDecisionItem[] = [];
  for (const candidate of Array.isArray(review?.fieldComparisons) ? review.fieldComparisons : []) {
    const queue: any = queues.get(clean(candidate.candidateId)) || {};
    const candidateSource = clean(candidate.source || queue.source);
    const candidateFlags = [queue.reasonForAiQueue, ...(queue.conflicts || []), candidate.decisionAction].map(clean).join(" ");
    for (const field of Array.isArray(candidate.fieldComparisons) ? candidate.fieldComparisons : []) {
      const fieldSource = clean(field.source || candidateSource);
      if (fieldSource !== source && candidateSource !== source) continue;
      const id = approvalKey(candidate.candidateId, field.field);
      items.push(evaluateBatchDecisionItem({
        decisionItemId: id,
        candidateId: clean(candidate.candidateId),
        candidateName: candidateName(candidate, queue),
        fieldName: clean(field.field),
        currentValue: clean(field.existingValue),
        suggestedValue: clean(field.aiValue),
        parserValue: clean(field.parserValue),
        evidence: clean(field.evidence),
        confidence: Number(field.confidence || 0),
        riskLevel: riskFromField(field),
        decisionStatus: clean(field.decision || "pending"),
        source: source,
        existingApproval: approvalMap.get(id),
        applyHistoryStatus: applyHistoryStatus(applyHistory, candidate.candidateId, field.field),
        candidateTitle: clean((candidate.fieldComparisons || []).find((entry: any) => clean(entry.field) === "title")?.existingValue || queue.parserExtractedFields?.title),
        candidateFlags,
      }));
    }
  }
  return items;
}

export function buildBatchDecisionAudit(options: BatchDecisionWorkflowOptions = {}): BatchDecisionAudit {
  const reviewPath = options.reviewPath || defaultPath("ai-extraction-review.json");
  const approvalsPath = options.approvalsPath || defaultPath("ai-extraction-approvals.json");
  const promotionPath = options.promotionPath || defaultPath("ai-extraction-batch-review-promotion.json");
  const stagingPath = options.stagingPath || defaultPath("ai-extraction-staging.json");
  const applyHistoryPath = options.applyHistoryPath || defaultPath("candidate-apply-history.json");
  const review = readJson(reviewPath);
  const approvals = readJson(approvalsPath);
  const promotion = readJson(promotionPath);
  const staging = readJson(stagingPath);
  const applyHistory = readJson(applyHistoryPath);
  const items = extractBatchDecisionItems(review.data, approvals.data, applyHistory.data, options.source || "batch_promotion");
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only decision audit; no candidate DB writes; no staging writes; no apply; no rollback; no delete; no OpenAI calls",
    summary: summarizeBatchDecisionItems(items),
    items,
    files: {
      review: { path: reviewPath, found: review.found },
      approvals: { path: approvalsPath, found: approvals.found },
      promotion: { path: promotionPath, found: promotion.found },
      staging: { path: stagingPath, found: staging.found },
      applyHistory: { path: applyHistoryPath, found: applyHistory.found },
    },
  };
}

export function selectBatchDecisionItems(items: BatchDecisionItem[], decision: BatchDecisionAction) {
  const selected = items.filter((item) => decision === "approve_safe" ? item.bulkApproveEligible : item.bulkRejectEligible);
  const excluded = items.filter((item) => !selected.includes(item)).map((item) => ({ ...item, exclusionReasons: item.reasons }));
  return { selected, excluded };
}

export function writeBatchDecisionAudit(report: BatchDecisionAudit, outputPath = defaultPath("ai-extraction-batch-decisions.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`);
  return fullPath;
}
