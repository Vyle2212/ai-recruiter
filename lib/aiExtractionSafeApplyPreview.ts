import type { AiExtractionApproval } from "./aiExtractionApprovalStore";
import type { ReviewWorkspace, WorkspaceField } from "./aiExtractionReviewUi";

export type SafeApplyPreviewChange = {
  approvalId: string;
  candidateId: string;
  field: string;
  fieldName: string;
  label: string;
  beforeValue: string;
  afterValue: string;
  evidence: string;
  riskLevel: string;
  approvalStatus: string;
};

export type SafeApplyPreview = {
  mode: string;
  approvedFieldsCount: number;
  candidatesReadyForApply: number;
  candidatesStillRequiringManualReview: number;
  rejectedFields: number;
  existingFieldsPreserved: number;
  unsafeDowngradePrevented: number;
  changes: SafeApplyPreviewChange[];
  preserved: Array<{ candidateId: string; fieldName: string; reason: string }>;
  warnings: string[];
};

function key(candidateId: string, fieldName: string) {
  return `${candidateId}:${fieldName}`;
}

function findField(workspace: ReviewWorkspace, approval: AiExtractionApproval): WorkspaceField | null {
  return workspace.candidates.find((candidate) => candidate.candidateId === approval.candidateId)?.fields.find((field) => field.field === approval.fieldName) || null;
}

function isSafeNormalApproval(approval: AiExtractionApproval, field: WorkspaceField | null) {
  return approval.decision === "approve_suggestion" && approval.riskLevel === "safe" && Boolean(approval.aiEvidence) && field?.decision === "safe_accept" && field.canApprove;
}

export function buildSafeApplyPreview(workspace: ReviewWorkspace, approvals: AiExtractionApproval[]): SafeApplyPreview {
  const changes: SafeApplyPreviewChange[] = [];
  const preserved: SafeApplyPreview["preserved"] = [];
  const warnings: string[] = [];
  const approvalsByField = new Map(approvals.map((approval) => [key(approval.candidateId, approval.fieldName), approval]));
  let rejectedFields = 0;
  let unsafeDowngradePrevented = 0;

  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) {
      const approval = approvalsByField.get(key(candidate.candidateId, field.field));
      if (!approval) {
        preserved.push({ candidateId: candidate.candidateId, fieldName: field.field, reason: "No saved approval" });
        continue;
      }
      if (approval.decision === "reject_suggestion") rejectedFields += 1;
      if (isSafeNormalApproval(approval, field)) {
        changes.push({
          approvalId: approval.approvalId,
          candidateId: approval.candidateId,
          field: approval.fieldName,
          fieldName: approval.fieldName,
          label: field.label,
          beforeValue: approval.currentValue,
          afterValue: approval.suggestedValue,
          evidence: approval.aiEvidence,
          riskLevel: approval.riskLevel,
          approvalStatus: "Approved for dry-run preview",
        });
        continue;
      }
      if (approval.decision === "approve_suggestion" || approval.decision === "manual_override_approve") {
        unsafeDowngradePrevented += 1;
        warnings.push(`${candidate.candidateName}: ${field.label} was preserved because it is not a normal safe approval.`);
      }
      preserved.push({
        candidateId: candidate.candidateId,
        fieldName: field.field,
        reason: approval.decision === "keep_existing" ? "Keep current value" : approval.decision === "mark_for_review" ? "Marked for review" : "Not safe for apply preview",
      });
    }
  }

  const readyCandidates = new Set(changes.map((change) => change.candidateId));
  return {
    mode: "dry-run only; local approval store only; no DB writes; no apply; no delete; no OpenAI calls",
    approvedFieldsCount: changes.length,
    candidatesReadyForApply: readyCandidates.size,
    candidatesStillRequiringManualReview: workspace.candidates.filter((candidate) => candidate.riskyCount > 0 || candidate.rejectedCount > 0 || candidate.stillBlocked).length,
    rejectedFields,
    existingFieldsPreserved: preserved.length,
    unsafeDowngradePrevented,
    changes,
    preserved,
    warnings,
  };
}

export function buildSafeApplyPreviewFromSaved(workspace: ReviewWorkspace, approvals: AiExtractionApproval[]) {
  return buildSafeApplyPreview(workspace, approvals);
}

