import type { ApprovalState, ReviewWorkspace, WorkspaceField } from "./aiExtractionReviewUi";

export type FieldViewMode = "suggested" | "all" | "risk";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function fieldHasSuggestion(field: WorkspaceField) {
  return Boolean(clean(field.aiValue) || field.decision === "safe_accept" || field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict");
}

export function fieldNeedsDecision(field: WorkspaceField) {
  return field.decision === "safe_accept" || field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict";
}

export function sortFieldsForReview(fields: WorkspaceField[]) {
  const rank = (field: WorkspaceField) => {
    if (field.decision === "reject") return 0;
    if (field.decision === "conflict" || field.decision === "risky_needs_review") return 1;
    if (field.decision === "safe_accept") return 2;
    if (fieldHasSuggestion(field)) return 3;
    if (field.evidence) return 4;
    return 5;
  };
  return [...fields].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

export function filterFieldsForView(fields: WorkspaceField[], mode: FieldViewMode) {
  const sorted = sortFieldsForReview(fields);
  if (mode === "all") return sorted;
  if (mode === "risk") return sorted.filter((field) => field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict");
  const suggested = sorted.filter(fieldHasSuggestion);
  return suggested.length ? suggested : sorted.filter((field) => field.evidence || field.existingValue || field.parserValue).slice(0, 4);
}

export function getApprovalDisabledReason(field: WorkspaceField, overrideReason = "") {
  if (field.canApprove) return "";
  if (field.decision === "conflict") return "Conflict detected";
  if (!clean(field.evidence) && field.field !== "primarySapModule") return "No CV evidence";
  if (field.decision === "reject") return overrideReason.trim() ? "Rejected suggestion stays out of preview" : "Manual override reason required";
  if (clean(field.existingValue) && clean(field.aiValue) && clean(field.existingValue).toLowerCase() !== clean(field.aiValue).toLowerCase() && Number(field.confidence) < 90) return "Lower confidence than current data";
  if (field.requiresOverride && !overrideReason.trim()) return "Manual override reason required";
  return field.warning || "Needs review first";
}

export function buildLocalApprovalSummary(workspace: ReviewWorkspace, approvals: ApprovalState) {
  let approvedFields = 0;
  let rejectedFields = 0;
  let manualReviewFields = 0;
  const readyCandidateIds = new Set<string>();
  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) {
      const approval = approvals[`${candidate.candidateId}:${field.field}`];
      if (approval?.action === "approve" && field.canApprove && field.decision === "safe_accept") {
        approvedFields += 1;
        readyCandidateIds.add(candidate.candidateId);
      }
      if (approval?.action === "reject") rejectedFields += 1;
      if (approval?.action === "manual_review") manualReviewFields += 1;
    }
  }
  return { approvedFields, rejectedFields, manualReviewFields, readyForApplyPreview: readyCandidateIds.size };
}
