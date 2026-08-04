import type { QuickFixApprovalDecision } from "./quickFixApprovalValidator";
import type { QuickFixRepairSuggestion } from "./quickFixRepairTypes";

export type QuickFixApprovalWriteSummary = {
  suggestionsLoaded: number;
  approvalDecisionsReady: number;
  existingApprovalsPreserved: number;
  suggestionsBlocked: number;
  wouldWriteApprovals: number;
  approvalsWritten: number;
  approvedCurrentCompany: number;
  approvedTitle: number;
  approvedPrimarySapModule: number;
  approvedLocation: number;
};

export function summarizeQuickFixApprovalWrite(input: { suggestions: QuickFixRepairSuggestion[]; approvals: QuickFixApprovalDecision[]; preserved: QuickFixRepairSuggestion[]; blocked: QuickFixRepairSuggestion[]; approvalsWritten?: number }): QuickFixApprovalWriteSummary {
  const field = (name: string) => input.approvals.filter((approval) => approval.fieldName === name).length;
  return {
    suggestionsLoaded: input.suggestions.length,
    approvalDecisionsReady: input.approvals.length,
    existingApprovalsPreserved: input.preserved.length,
    suggestionsBlocked: input.blocked.length,
    wouldWriteApprovals: input.approvals.length,
    approvalsWritten: Number(input.approvalsWritten || 0),
    approvedCurrentCompany: field("currentCompany"),
    approvedTitle: field("title"),
    approvedPrimarySapModule: field("primarySapModule"),
    approvedLocation: field("location"),
  };
}
