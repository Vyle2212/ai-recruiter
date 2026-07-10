import type { AiExtractionApproval } from "./aiExtractionApprovalStore";
import type { ReviewWorkspace, WorkspaceCandidate, WorkspaceField } from "./aiExtractionReviewUi";

export type StagingValidationStatus = "valid" | "warning" | "rejected";
export type StagingApplyReadiness = "staged_safe" | "staged_manual_review" | "blocked";

export type StagingValidationResult = {
  validationStatus: StagingValidationStatus;
  applyReadiness: StagingApplyReadiness;
  validationReasons: string[];
  candidate?: WorkspaceCandidate;
  field?: WorkspaceField;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase();
}

function dirtyEmployer(value: string) {
  return /@|gmail\.com|yahoo\.com|project|implementation|responsibilit|duration|role|present|employment history|professional experiences|sentence|client/i.test(value);
}

function fakeIdentity(value: string) {
  return /candidate profile pending validation|profile under review|unknown|placeholder|sap consultant|service now|jira|oracle|excel|manager developer/i.test(value) || clean(value).split(/\s+/).length > 6;
}

function isEmployerField(fieldName: string) {
  return /company|employer/i.test(fieldName);
}

function isIdentityField(fieldName: string) {
  return /displayName|fullName|name/i.test(fieldName);
}

function findCandidate(workspace: ReviewWorkspace, approval: Pick<AiExtractionApproval, "candidateId">) {
  return workspace.candidates.find((candidate) => candidate.candidateId === approval.candidateId);
}

function findField(candidate: WorkspaceCandidate | undefined, approval: Pick<AiExtractionApproval, "fieldName">) {
  return candidate?.fields.find((field) => field.field === approval.fieldName);
}

export function validateStagingApproval(approval: Partial<AiExtractionApproval>, workspace: ReviewWorkspace): StagingValidationResult {
  const validationReasons: string[] = [];
  const candidate = approval.candidateId ? findCandidate(workspace, approval as AiExtractionApproval) : undefined;
  const field = candidate ? findField(candidate, approval as AiExtractionApproval) : undefined;
  const decision = clean(approval.decision);
  const approvedValue = clean(approval.suggestedValue);
  const currentValue = clean(approval.currentValue);
  const overrideReason = clean(approval.overrideReason);
  const riskLevel = clean(approval.riskLevel);
  const fieldName = clean(approval.fieldName);
  const evidence = clean(approval.aiEvidence);
  const manualOverride = decision === "manual_override_approve";

  if (!clean(approval.approvalId)) validationReasons.push("source approval is missing");
  if (!clean(approval.candidateId)) validationReasons.push("candidateId missing");
  if (!fieldName) validationReasons.push("fieldName missing");
  if (decision !== "approve_suggestion" && decision !== "manual_override_approve") validationReasons.push("approval decision is not approved");
  if (!approvedValue) validationReasons.push("approved value is empty");
  if (currentValue && approvedValue && norm(currentValue) === norm(approvedValue)) validationReasons.push("current value and approved value are identical");
  if (!candidate) validationReasons.push("approval is stale or candidate is missing from review");
  if (!field) validationReasons.push("approval is stale or field is missing from review");
  if (candidate?.reuploadRequired || /requires_original_file_reupload/i.test(clean(candidate?.decisionAction))) validationReasons.push("candidate requires original file reupload");
  if (decision === "manual_override_approve" && !overrideReason) validationReasons.push("manual override requires reason");
  if (riskLevel === "rejected" && !manualOverride) validationReasons.push("rejected field requires manual override");
  if (isEmployerField(fieldName) && dirtyEmployer(approvedValue) && !(manualOverride && overrideReason)) validationReasons.push("dirty employer requires manual override");
  if (isIdentityField(fieldName) && fakeIdentity(approvedValue) && !(manualOverride && overrideReason)) validationReasons.push("fake identity requires manual override");
  if ((riskLevel === "conflict" || field?.decision === "conflict" || /module_conflicts/i.test(clean(field?.reason))) && !(manualOverride && overrideReason)) validationReasons.push("module conflict requires manual override");
  if ((!evidence || field?.decision === "missing_evidence") && !(manualOverride && overrideReason)) validationReasons.push("missing evidence requires manual override");
  if (field && !field.canApprove && !manualOverride) validationReasons.push("field is not safe for normal staging");
  if (field && currentValue && approvedValue && norm(currentValue) !== norm(approvedValue) && field.confidence < 90 && !manualOverride) validationReasons.push("field would downgrade existing data");

  const rejected = validationReasons.some((reason) => (
    /missing|requires|rejected|dirty|fake|conflict|downgrade|stale|malformed|identical|not approved|empty/i.test(reason)
  ));
  if (rejected) {
    return { validationStatus: "rejected", applyReadiness: "blocked", validationReasons, candidate, field };
  }
  if (manualOverride) {
    return { validationStatus: "warning", applyReadiness: "staged_manual_review", validationReasons: ["manual override requires final review"], candidate, field };
  }
  return { validationStatus: "valid", applyReadiness: "staged_safe", validationReasons, candidate, field };
}
