import fs from "node:fs";
import path from "node:path";
import { approvalStorePath } from "./aiExtractionApprovalStore";
import { existingApprovalMap, quickFixSuggestionToApproval, validateQuickFixApprovalSuggestion, type QuickFixApprovalDecision } from "./quickFixApprovalValidator";
import { summarizeQuickFixApprovalWrite, type QuickFixApprovalWriteSummary } from "./quickFixApprovalSummary";
import { loadQuickFixRepairSuggestions } from "./quickFixRepairReview";
import type { QuickFixRepairSuggestion } from "./quickFixRepairTypes";
import { buildQuickFixReviewPromotion, writeQuickFixReviewPromotionReport } from "./quickFixReviewPromotion";
import { hasMatchingQuickFixReviewItem } from "./quickFixReviewMerge";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export type QuickFixApprovalWriteResult = {
  generatedAt: string;
  mode: string;
  writeApprovalsFile: boolean;
  writeReviewFile: boolean;
  overwriteExistingApprovals: boolean;
  approvalFilePath: string;
  reviewFilePath: string;
  outputPath: string;
  summary: QuickFixApprovalWriteSummary;
  approvals: QuickFixApprovalDecision[];
  preserved: QuickFixRepairSuggestion[];
  blocked: Array<QuickFixRepairSuggestion & { blockReasons: string[] }>;
  errors: string[];
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

function ensureReportsDir(filePath: string) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function mergeApprovals(existing: any[], incoming: QuickFixApprovalDecision[], overwriteExistingApprovals: boolean) {
  const byId = new Map(existing.map((approval) => [clean(approval.approvalId) || `${clean(approval.candidateId)}:${clean(approval.fieldName)}`, approval]));
  for (const approval of incoming) {
    if (!overwriteExistingApprovals && byId.has(approval.approvalId)) continue;
    byId.set(approval.approvalId, approval);
  }
  return Array.from(byId.values());
}

export function buildQuickFixApprovalWriteResult(options: { suggestionsPath?: string; approvalsPath?: string; reviewPath?: string; writeApprovalsFile?: boolean; writeReviewFile?: boolean; overwriteExistingApprovals?: boolean; outputPath?: string } = {}): QuickFixApprovalWriteResult {
  const suggestionsFile = loadQuickFixRepairSuggestions(options.suggestionsPath);
  const approvalsPath = options.approvalsPath || approvalStorePath();
  const reviewPath = options.reviewPath || path.join("reports", "ai-extraction-review.json");
  const promotion = options.writeReviewFile ? buildQuickFixReviewPromotion({ suggestionsPath: options.suggestionsPath, reviewPath, writeReviewFile: true }) : null;
  if (promotion && options.writeReviewFile) writeQuickFixReviewPromotionReport(promotion);
  const reviewReport = promotion?.mergedReviewReport || readJson(reviewPath) || null;
  const existing = existingApprovalMap(approvalsPath);
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const approvals: QuickFixApprovalDecision[] = [];
  const preserved: QuickFixRepairSuggestion[] = [];
  const blocked: QuickFixApprovalWriteResult["blocked"] = [];
  const errors: string[] = [];

  for (const suggestion of suggestionsFile.suggestions || []) {
    const hasReview = hasMatchingQuickFixReviewItem(reviewReport, suggestion.candidateId, suggestion.fieldName);
    const validation = validateQuickFixApprovalSuggestion(suggestion, { existingApprovals: existing, seen, overwriteExistingApprovals: Boolean(options.overwriteExistingApprovals), hasMatchingReviewItem: hasReview });
    const id = `${clean(suggestion.candidateId)}:${clean(suggestion.fieldName)}`;
    seen.add(id);
    if (validation.status === "preserved") {
      preserved.push(suggestion);
      continue;
    }
    if (validation.status === "blocked") {
      blocked.push({ ...suggestion, blockReasons: validation.reasons });
      continue;
    }
    approvals.push(quickFixSuggestionToApproval(suggestion, validation.reasons, now));
  }

  let approvalsWritten = 0;
  if (options.writeApprovalsFile) {
    ensureReportsDir(approvalsPath);
    const parsed = fs.existsSync(path.resolve(approvalsPath)) ? JSON.parse(fs.readFileSync(path.resolve(approvalsPath), "utf8")) : { mode: "local approval store only; no DB writes; no apply; no delete; no OpenAI calls", approvals: [] };
    const merged = mergeApprovals(Array.isArray(parsed.approvals) ? parsed.approvals : [], approvals, Boolean(options.overwriteExistingApprovals));
    fs.writeFileSync(path.resolve(approvalsPath), `${JSON.stringify({ ...parsed, mode: "local approval store only; no DB writes; no apply; no delete; no OpenAI calls", updatedAt: now, approvals: merged }, null, 2)}\n`);
    approvalsWritten = approvals.length;
  }

  const outputPath = options.outputPath || path.join("reports", options.writeApprovalsFile ? "quick-fix-repair-approvals-result.json" : "quick-fix-repair-approvals-write-preview.json");
  const summary = summarizeQuickFixApprovalWrite({ suggestions: suggestionsFile.suggestions, approvals, preserved, blocked, approvalsWritten });
  return {
    generatedAt: now,
    mode: options.writeApprovalsFile ? "approvals file write only; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls" : "approval write preview only; approvals file not changed; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls",
    writeApprovalsFile: Boolean(options.writeApprovalsFile),
    writeReviewFile: Boolean(options.writeReviewFile),
    overwriteExistingApprovals: Boolean(options.overwriteExistingApprovals),
    approvalFilePath: approvalsPath,
    reviewFilePath: reviewPath,
    outputPath,
    summary,
    approvals,
    preserved,
    blocked,
    errors,
  };
}

export function writeQuickFixApprovalWriteReport(result: QuickFixApprovalWriteResult) {
  return writeWorkflowJson(result.outputPath, result);
}
