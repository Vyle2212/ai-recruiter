import fs from "node:fs";
import path from "node:path";
import type { QuickFixApprovalPreview, QuickFixRepairSuggestion, QuickFixRepairSuggestionFile } from "./quickFixRepairTypes";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

function approvalId(candidateId: string, fieldName: string) {
  return `${clean(candidateId)}:${clean(fieldName)}`;
}

function existingApprovalIds(approvalsPath = path.join("reports", "ai-extraction-approvals.json")) {
  const parsed = readJson(approvalsPath);
  return new Set((Array.isArray(parsed?.approvals) ? parsed.approvals : []).map((approval: any) => clean(approval.approvalId) || approvalId(approval.candidateId, approval.fieldName)));
}

export function buildQuickFixApprovalPreview(suggestionsFile: QuickFixRepairSuggestionFile, options: { approvalsPath?: string } = {}): QuickFixApprovalPreview {
  const existing = existingApprovalIds(options.approvalsPath);
  const now = new Date().toISOString();
  const approvals: QuickFixApprovalPreview["approvals"] = [];
  const preserved: QuickFixRepairSuggestion[] = [];
  const blocked: QuickFixRepairSuggestion[] = [];

  for (const suggestion of suggestionsFile.suggestions || []) {
    const id = approvalId(suggestion.candidateId, suggestion.fieldName);
    if (existing.has(id) || suggestion.validationStatus === "already_approved") {
      preserved.push(suggestion);
      continue;
    }
    if (suggestion.approvalReadiness !== "ready_for_manual_approval" || suggestion.validationStatus === "blocked" || suggestion.validationStatus === "already_verified") {
      blocked.push(suggestion);
      continue;
    }
    approvals.push({
      approvalId: id,
      candidateId: suggestion.candidateId,
      fieldName: suggestion.fieldName,
      currentValue: suggestion.currentValue,
      suggestedValue: suggestion.suggestedValue,
      parserValue: suggestion.suggestedValue,
      aiEvidence: suggestion.evidenceSnippet,
      aiConfidence: suggestion.confidence,
      decision: "mark_for_review",
      riskLevel: suggestion.validationStatus === "safe_suggestion" ? "safe" : "risky",
      reviewerNote: "Quick fix repair suggestion generated for recruiter review. Not auto-approved.",
      overrideReason: "",
      createdAt: now,
      updatedAt: now,
      source: "quick_fix_repair",
      decisionMode: "manual_review_preview",
      safetyReasons: suggestion.validationReasons,
      evidenceSummary: suggestion.evidenceSnippet,
    });
  }

  return {
    generatedAt: now,
    mode: "approval preview only; approvals file not changed; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls",
    wouldCreateApprovalDecisions: approvals.length,
    wouldPreserveExistingApprovals: preserved.length,
    wouldBlockSuggestions: blocked.length,
    approvals,
    preserved,
    blocked,
  };
}

export function writeQuickFixApprovalPreview(preview: QuickFixApprovalPreview, outputPath = path.join("reports", "quick-fix-repair-approvals-preview.json")) {
  return writeWorkflowJson(outputPath, { ...preview, outputPath });
}
