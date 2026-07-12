import type { QuickFixRepairSuggestion, QuickFixRepairSummary } from "./quickFixRepairTypes";

export function summarizeQuickFixRepair(suggestions: QuickFixRepairSuggestion[] = [], selectedBatch = 0, existingApprovalsPreserved?: number): QuickFixRepairSummary {
  const field = (name: string) => suggestions.filter((item) => item.fieldName === name).length;
  const status = (name: string) => suggestions.filter((item) => item.validationStatus === name).length;
  return {
    quickFixCandidates: selectedBatch,
    selectedBatch,
    suggestionsGenerated: suggestions.length,
    safeSuggestions: status("safe_suggestion"),
    needsManualReview: status("needs_manual_review"),
    blockedSuggestions: status("blocked"),
    missingCompanyFixes: field("currentCompany"),
    missingTitleFixes: field("title"),
    missingModuleFixes: field("primarySapModule"),
    missingLocationFixes: field("location"),
    readyForApprovalPreview: suggestions.filter((item) => item.approvalReadiness === "ready_for_manual_approval").length,
    existingApprovalsPreserved: existingApprovalsPreserved ?? status("already_approved"),
    missingEvidence: suggestions.filter((item) => item.approvalReadiness === "not_ready_missing_evidence").length,
  };
}
