import { fieldMappingFor } from "./aiExtractionCandidateApplyValidator";

export type BatchDecisionAction = "approve_safe" | "reject_invalid";
export type BatchDecisionRiskLevel = "safe" | "low" | "risky" | "conflict" | "rejected" | "blocked";

export type BatchDecisionItem = {
  decisionItemId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  parserValue: string;
  evidence: string;
  confidence: number;
  riskLevel: BatchDecisionRiskLevel;
  decisionStatus: string;
  source: string;
  safetyNote: string;
  reasons: string[];
  existingApproval?: any;
  applyHistoryStatus?: string;
  supported: boolean;
  bulkApproveEligible: boolean;
  bulkRejectEligible: boolean;
  manualReviewRequired: boolean;
  conflict: boolean;
  alreadyAppliedPreserved: boolean;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase();
}

function hasValidCurrent(value: any) {
  const text = clean(value);
  return Boolean(text && !/not available|not disclosed|unknown|null|n\/a|pending validation|under review/i.test(text));
}

function confidenceOk(confidence: number) {
  if (confidence <= 1) return confidence >= 0.8;
  return confidence >= 80;
}

function dirtyEmployer(value: any) {
  return /@|gmail\.com|yahoo\.com|project|implementation|responsibilit|duration|role|present|employment history|professional experiences|client|domain|\bhttp/i.test(clean(value));
}

function dirtyTitle(value: any) {
  const text = clean(value);
  return /@|gmail\.com|yahoo\.com|project|implementation|responsibilit|duration|employment history|professional experiences|excel|jira|oracle|service now/i.test(text) || text.split(/\s+/).length > 9;
}

function invalidEmail(value: any) {
  const text = clean(value);
  return Boolean(text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text));
}

function invalidPhone(value: any) {
  const digits = clean(value).replace(/\D/g, "");
  return Boolean(clean(value) && digits.length < 7);
}

function unclearSalary(value: any) {
  const text = clean(value);
  return Boolean(text && !/(\$|usd|sgd|eur|gbp|myr|inr|aud|cad|per|\/|month|year|annual|hour|day)/i.test(text));
}

function moduleFromTitle(value: any) {
  const text = clean(value);
  if (/FICO|FI\/CO/i.test(text)) return "FICO";
  if (/ABAP/i.test(text)) return "ABAP";
  if (/\bBW\b|BI/i.test(text)) return "BW";
  if (/\bMM\b/i.test(text)) return "MM";
  if (/\bSD\b/i.test(text)) return "SD";
  if (/EWM/i.test(text)) return "EWM";
  if (/BTP/i.test(text)) return "BTP";
  return "";
}

export function evaluateBatchDecisionItem(input: Omit<BatchDecisionItem, "supported" | "bulkApproveEligible" | "bulkRejectEligible" | "manualReviewRequired" | "conflict" | "alreadyAppliedPreserved" | "safetyNote" | "reasons"> & { candidateTitle?: string; candidateFlags?: string }): BatchDecisionItem {
  const reasons: string[] = [];
  const rejectReasons: string[] = [];
  const fieldName = clean(input.fieldName);
  const suggestedValue = clean(input.suggestedValue);
  const currentValue = clean(input.currentValue);
  const evidence = clean(input.evidence);
  const source = clean(input.source);
  const riskLevel = (clean(input.riskLevel) || "risky") as BatchDecisionRiskLevel;
  const supported = Boolean(fieldMappingFor(fieldName));
  const alreadyAppliedPreserved = /applied_verified|preserved_already_applied/i.test(clean(input.applyHistoryStatus));
  const hasExistingApproval = Boolean(input.existingApproval);
  const fieldConflict = riskLevel === "conflict" || /conflict/i.test(clean(input.decisionStatus) + " " + clean(input.candidateFlags));
  if (source !== "batch_promotion") reasons.push("not a promoted batch item");
  if (hasExistingApproval) reasons.push("existing approval preserved");
  if (!supported) {
    reasons.push("unsupported field");
    rejectReasons.push("unsupported field");
  }
  if (!suggestedValue) {
    reasons.push("missing suggested value");
    rejectReasons.push("suggested value is empty");
  }
  if (!evidence && fieldName !== "primarySapModule") reasons.push("missing evidence");
  if (!confidenceOk(Number(input.confidence || 0))) reasons.push("confidence below safe bulk threshold");
  if (!/safe|low/i.test(riskLevel)) reasons.push("risk level requires manual review");
  if (fieldConflict) reasons.push("conflict detected");
  if (alreadyAppliedPreserved) rejectReasons.push("already applied or preserved");
  if (/duplicate.*conflict|requires_original_file_reupload|reupload/i.test(clean(input.candidateFlags))) rejectReasons.push("candidate safety status blocks approval");
  if (/company|employer/i.test(fieldName) && dirtyEmployer(suggestedValue)) rejectReasons.push("employer looks like project/client/sentence/email/domain");
  if (/title/i.test(fieldName) && dirtyTitle(suggestedValue)) rejectReasons.push("title looks like company/sentence/tool list");
  if (/email/i.test(fieldName) && invalidEmail(suggestedValue)) rejectReasons.push("email format invalid");
  if (/phone/i.test(fieldName) && invalidPhone(suggestedValue)) rejectReasons.push("phone format invalid");
  if (/salary/i.test(fieldName) && unclearSalary(suggestedValue)) rejectReasons.push("salary currency or period unclear");
  if (/name|identity/i.test(fieldName)) rejectReasons.push("identity fields require manual review");
  if (/primarySapModule/i.test(fieldName)) {
    const titleModule = moduleFromTitle(input.candidateTitle);
    if (titleModule && titleModule !== suggestedValue.toUpperCase()) rejectReasons.push("module conflicts with title");
  }
  for (const reason of rejectReasons) if (!reasons.includes(reason)) reasons.push(reason);
  const currentMissingOrLower = !hasValidCurrent(currentValue) || norm(currentValue) === norm(input.parserValue);
  if (!currentMissingOrLower && suggestedValue && norm(currentValue) !== norm(suggestedValue)) reasons.push("current value is present and not clearly lower quality");
  const bulkApproveEligible = source === "batch_promotion" && !hasExistingApproval && supported && Boolean(suggestedValue) && Boolean(evidence || fieldName === "primarySapModule") && confidenceOk(Number(input.confidence || 0)) && /safe|low/i.test(riskLevel) && !fieldConflict && !alreadyAppliedPreserved && currentMissingOrLower && rejectReasons.length === 0;
  const bulkRejectEligible = source === "batch_promotion" && !hasExistingApproval && (rejectReasons.length > 0 || !suggestedValue || !supported || alreadyAppliedPreserved);
  const conflict = fieldConflict || rejectReasons.some((reason) => /conflict/i.test(reason));
  return {
    ...input,
    supported,
    bulkApproveEligible,
    bulkRejectEligible,
    manualReviewRequired: !bulkApproveEligible && !bulkRejectEligible,
    conflict,
    alreadyAppliedPreserved,
    safetyNote: bulkApproveEligible ? "Safe bulk approval eligible" : bulkRejectEligible ? "Bulk reject eligible" : "Manual review required",
    reasons: reasons.length ? reasons : ["safe criteria passed"],
  };
}
