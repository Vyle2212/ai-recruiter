import { currentCandidateValue, fieldMappingFor } from "./aiExtractionCandidateApplyValidator";

export type ApplyHistoryStatus =
  | "staged_pending_apply"
  | "eligible_for_apply"
  | "applied_verified"
  | "preserved_already_applied"
  | "blocked"
  | "conflict"
  | "rollback_available"
  | "rollback_missing"
  | "post_apply_mismatch"
  | "missing_candidate"
  | "missing_report_file";

export type ApplyHistoryValidationInput = {
  candidateId: string;
  fieldName: string;
  approvedValue: any;
  stagingCurrentValue: any;
  validationStatus?: string;
  validationReasons?: string[];
  riskLevel?: string;
  candidate?: Record<string, any> | null;
  resultAudit?: { applied?: boolean; reason?: string; candidateField?: string; to?: any } | null;
  postAudit?: { status?: string; finalDbValue?: any; dbFieldName?: string; approvedValue?: any } | null;
  backupEntry?: unknown;
  rollbackEntry?: unknown;
  hasStagingFile: boolean;
};

export type ApplyHistoryValidation = {
  status: ApplyHistoryStatus;
  dbFieldName: string;
  finalDbValue: any;
  messages: string[];
  backupAvailable: boolean;
  rollbackAvailable: boolean;
  conflict: boolean;
  eligible: boolean;
  alreadyApplied: boolean;
  appliedVerified: boolean;
  mismatch: boolean;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase();
}

export function validateApplyHistoryItem(input: ApplyHistoryValidationInput): ApplyHistoryValidation {
  const mapping = fieldMappingFor(input.fieldName);
  const dbFieldName = input.postAudit?.dbFieldName || input.resultAudit?.candidateField || mapping?.candidateField || "";
  const finalDbValue = input.postAudit?.finalDbValue ?? currentCandidateValue(input.candidate || {}, mapping);
  const messages = [...(input.validationReasons || [])];
  const backupAvailable = Boolean(input.backupEntry);
  const rollbackAvailable = Boolean(input.rollbackEntry);

  if (!input.hasStagingFile) messages.push("missing staging report file");
  if (!mapping) messages.push("field is not in allowed mapping");
  if (!input.candidate) messages.push("current candidate record is missing");
  if (input.validationStatus && input.validationStatus !== "valid") messages.push("staged item is not valid");

  const postStatus = clean(input.postAudit?.status);
  const resultApplied = input.resultAudit?.applied === true;
  const approvedValue = input.postAudit?.approvedValue ?? input.resultAudit?.to ?? input.approvedValue;
  const matchesApproved = Boolean(input.candidate && clean(approvedValue) && norm(finalDbValue) === norm(approvedValue));
  const alreadyApplied = !resultApplied && matchesApproved;
  const mismatch = (resultApplied || postStatus === "mismatch" || postStatus === "not_applied") && !matchesApproved;
  const blocked = messages.length > 0 || /rejected|conflict/i.test(clean(input.riskLevel)) || input.validationStatus === "rejected";
  const conflict = !alreadyApplied && (/conflict/i.test(clean(input.riskLevel)) || /conflict|differs|downgrade|mismatch/i.test(messages.join(" ")) || mismatch);

  let status: ApplyHistoryStatus = "staged_pending_apply";
  if (!input.hasStagingFile) status = "missing_report_file";
  else if (!input.candidate) status = "missing_candidate";
  else if (mismatch) status = "post_apply_mismatch";
  else if (resultApplied && matchesApproved) status = "applied_verified";
  else if (postStatus === "verified_applied") status = "applied_verified";
  else if (alreadyApplied) status = "preserved_already_applied";
  else if (conflict) status = "conflict";
  else if (blocked) status = "blocked";
  else if (input.validationStatus === "valid" && mapping) status = "eligible_for_apply";

  return {
    status,
    dbFieldName,
    finalDbValue,
    messages,
    backupAvailable,
    rollbackAvailable,
    conflict: status === "conflict" || status === "post_apply_mismatch",
    eligible: status === "eligible_for_apply",
    alreadyApplied: status === "preserved_already_applied",
    appliedVerified: status === "applied_verified",
    mismatch: status === "post_apply_mismatch",
  };
}