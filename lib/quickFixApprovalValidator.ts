import fs from "node:fs";
import path from "node:path";
import type { AiExtractionApproval, PersistedApprovalRiskLevel } from "./aiExtractionApprovalStore";
import type { QuickFixRepairSuggestion } from "./quickFixRepairTypes";
import { validateQuickFixSuggestion } from "./quickFixRepairValidator";

export type QuickFixApprovalValidationStatus = "ready" | "preserved" | "blocked";
export type QuickFixApprovalValidationResult = {
  status: QuickFixApprovalValidationStatus;
  reasons: string[];
};

const SUPPORTED_FIELDS = new Set(["currentCompany", "title", "primarySapModule", "location"]);

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

export function quickFixApprovalId(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

export function existingApprovalMap(approvalsPath = path.join("reports", "ai-extraction-approvals.json")) {
  const parsed = readJson(approvalsPath);
  const approvals = Array.isArray(parsed?.approvals) ? parsed.approvals : [];
  return new Map<string, any>(approvals.map((approval: any) => [clean(approval.approvalId) || quickFixApprovalId(approval.candidateId, approval.fieldName), approval]));
}

export function isAlreadyVerified(candidateId: string, fieldName: string, applyHistoryPath = path.join("reports", "candidate-apply-history.json")) {
  const parsed = readJson(applyHistoryPath);
  return (Array.isArray(parsed?.items) ? parsed.items : []).some((item: any) => clean(item.candidateId) === clean(candidateId) && clean(item.fieldName) === clean(fieldName) && /applied_verified|preserved_already_applied/i.test(clean(item.status)));
}

export function validateQuickFixApprovalSuggestion(
  suggestion: Partial<QuickFixRepairSuggestion>,
  options: { existingApprovals?: Map<string, any>; seen?: Set<string>; overwriteExistingApprovals?: boolean; applyHistoryPath?: string; hasMatchingReviewItem?: boolean } = {},
): QuickFixApprovalValidationResult {
  const reasons: string[] = [];
  const candidateId = clean(suggestion.candidateId);
  const fieldName = clean(suggestion.fieldName);
  const id = quickFixApprovalId(candidateId, fieldName);
  const reviewStatus = clean((suggestion as any).reviewStatus || suggestion.validationStatus);
  const readiness = clean(suggestion.approvalReadiness);

  if (!candidateId) reasons.push("missing candidateId");
  if (!SUPPORTED_FIELDS.has(fieldName)) reasons.push("unsupported field");
  if (!clean(suggestion.suggestedValue)) reasons.push("approved value is empty");
  if (reviewStatus === "blocked") reasons.push("blocked suggestion cannot be written");
  if (readiness !== "ready_for_manual_approval") reasons.push("approval readiness is not ready");
  if (!options.hasMatchingReviewItem) reasons.push("missing matching review item; promote quick-fix suggestion to review first");
  if (reviewStatus !== "safe_suggestion" && reviewStatus !== "needs_manual_review") reasons.push("review status is not approval-ready");
  if (options.seen?.has(id)) reasons.push("duplicate candidate field suggestion");
  if (isAlreadyVerified(candidateId, fieldName, options.applyHistoryPath)) reasons.push("already verified or applied");
  const fieldValidation = validateQuickFixSuggestion(suggestion as QuickFixRepairSuggestion);
  reasons.push(...fieldValidation.errors);

  const existing = options.existingApprovals?.get(id);
  if (existing && !options.overwriteExistingApprovals) return { status: "preserved", reasons: ["existing approval preserved"] };
  if (reasons.length) return { status: "blocked", reasons: Array.from(new Set(reasons)) };
  return { status: "ready", reasons: fieldValidation.warnings };
}

export type QuickFixApprovalDecision = AiExtractionApproval & {
  source: "quick_fix_repair";
  decisionMode: "quick_fix_approval";
  repairCategory: string;
  priority: string;
  evidenceSource: string;
  evidenceSnippet: string;
  confidence: number;
  safetyReasons: string[];
  decidedAt: string;
  approvedValue: string;
  originalValue: string;
  approvalDecision: "approved";
  requiresManualReview: boolean;
};

export function quickFixSuggestionToApproval(suggestion: QuickFixRepairSuggestion, safetyReasons: string[] = [], now = new Date().toISOString()): QuickFixApprovalDecision {
  const requiresManualReview = suggestion.validationStatus === "needs_manual_review";
  const riskLevel: PersistedApprovalRiskLevel = "safe";
  return {
    approvalId: quickFixApprovalId(suggestion.candidateId, suggestion.fieldName),
    candidateId: clean(suggestion.candidateId),
    fieldName: clean(suggestion.fieldName),
    currentValue: clean(suggestion.currentValue),
    suggestedValue: clean(suggestion.suggestedValue),
    parserValue: clean(suggestion.suggestedValue),
    aiEvidence: clean(suggestion.evidenceSnippet || suggestion.evidenceSource),
    aiConfidence: Number(suggestion.confidence || 0),
    decision: "approve_suggestion",
    riskLevel,
    reviewerNote: requiresManualReview ? "Quick fix repair approval. Manual review was required and captured before staging preview." : "Quick fix repair approval from deterministic existing candidate evidence.",
    overrideReason: "",
    createdAt: now,
    updatedAt: now,
    source: "quick_fix_repair",
    decisionMode: "quick_fix_approval",
    repairCategory: clean(suggestion.repairCategory),
    priority: clean(suggestion.priority),
    evidenceSource: clean(suggestion.evidenceSource),
    evidenceSnippet: clean(suggestion.evidenceSnippet),
    confidence: Number(suggestion.confidence || 0),
    safetyReasons,
    decidedAt: now,
    approvedValue: clean(suggestion.suggestedValue),
    originalValue: clean(suggestion.currentValue),
    approvalDecision: "approved",
    requiresManualReview,
  };
}


