import path from "node:path";
import { loadQuickFixRepairSuggestions } from "./quickFixRepairReview";
import { buildQuickFixApprovalPreview } from "./quickFixRepairApprovalBridge";
import { summarizeQuickFixRepair } from "./quickFixRepairSummary";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export function buildQuickFixRepairAudit(options: { suggestionsPath?: string; approvalsPath?: string } = {}) {
  const suggestionsFile = loadQuickFixRepairSuggestions(options.suggestionsPath);
  const preview = buildQuickFixApprovalPreview(suggestionsFile, { approvalsPath: options.approvalsPath });
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only quick fix repair audit; no candidate DB writes; no approvals write; no staging; no apply; no delete; no OpenAI calls",
    suggestionsLoaded: suggestionsFile.suggestions.length,
    summary: summarizeQuickFixRepair(suggestionsFile.suggestions, suggestionsFile.candidatesProcessed, preview.wouldPreserveExistingApprovals),
    readyForApprovalPreview: preview.wouldCreateApprovalDecisions,
    existingApprovalsPreserved: preview.wouldPreserveExistingApprovals,
    blockedSuggestions: preview.wouldBlockSuggestions,
    suggestions: suggestionsFile.suggestions,
  };
}

export function writeQuickFixRepairAudit(audit: ReturnType<typeof buildQuickFixRepairAudit>, outputPath = path.join("reports", "quick-fix-repair-audit.json")) {
  return writeWorkflowJson(outputPath, audit);
}
