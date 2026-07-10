import type { AiExtractionStagingRecord } from "./aiExtractionStagingPreview";

export type CandidateApplyValidation = {
  eligible: boolean;
  blocked: boolean;
  reasons: string[];
  candidateField: string;
  currentDbValue: any;
};

export type CandidateFieldMapping = {
  stagingField: string;
  candidateField: string;
  aliases: string[];
};

const FIELD_MAPPINGS: CandidateFieldMapping[] = [
  { stagingField: "fullName", candidateField: "name", aliases: ["fullName", "displayName", "display_name", "name"] },
  { stagingField: "displayName", candidateField: "name", aliases: ["displayName", "fullName", "display_name", "name"] },
  { stagingField: "email", candidateField: "email", aliases: ["email"] },
  { stagingField: "phone", candidateField: "phone", aliases: ["phone", "mobile"] },
  { stagingField: "title", candidateField: "current_title", aliases: ["title", "currentTitle", "current_title"] },
  { stagingField: "currentTitle", candidateField: "current_title", aliases: ["currentTitle", "title", "current_title"] },
  { stagingField: "currentCompany", candidateField: "current_company", aliases: ["currentCompany", "currentEmployer", "current_company", "company"] },
  { stagingField: "currentEmployer", candidateField: "current_company", aliases: ["currentEmployer", "currentCompany", "current_company", "company"] },
  { stagingField: "previousCompany", candidateField: "previous_company", aliases: ["previousCompany", "previousEmployer", "previous_company"] },
  { stagingField: "previousEmployer", candidateField: "previous_company", aliases: ["previousEmployer", "previousCompany", "previous_company"] },
  { stagingField: "location", candidateField: "location", aliases: ["location", "locationCountry", "country"] },
  { stagingField: "locationCountry", candidateField: "location", aliases: ["locationCountry", "location", "country"] },
  { stagingField: "primarySapModule", candidateField: "primary_module", aliases: ["primarySapModule", "primary_module", "module"] },
  { stagingField: "sapModules", candidateField: "sap_modules", aliases: ["sapModules", "sap_modules", "secondary_modules"] },
  { stagingField: "sapSkills", candidateField: "skills", aliases: ["sapSkills", "skills", "sap_skills"] },
  { stagingField: "salary", candidateField: "salary", aliases: ["salary"] },
  { stagingField: "noticePeriod", candidateField: "notice_period", aliases: ["noticePeriod", "notice_period"] },
];

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase();
}

function validExisting(value: any) {
  const v = clean(value);
  return Boolean(v && !/candidate profile pending validation|profile under review|not disclosed|unknown|null|n\/a/i.test(v));
}

function dirtyEmployer(value: any) {
  return /@|gmail\.com|yahoo\.com|project|implementation|responsibilit|duration|role|present|employment history|professional experiences|sentence|client|domain/i.test(clean(value));
}

function fakeIdentity(value: any) {
  const v = clean(value);
  return /candidate profile pending validation|profile under review|placeholder|sap consultant|service now|jira|oracle|excel|tool/i.test(v) || v.split(/\s+/).length > 6;
}

function moduleFromTitle(title: any) {
  const value = clean(title);
  if (/FICO|FI\/CO/i.test(value)) return "FICO";
  if (/ABAP/i.test(value)) return "ABAP";
  if (/\bBW\b|BI/i.test(value)) return "BW";
  if (/\bMM\b/i.test(value)) return "MM";
  if (/\bSD\b/i.test(value)) return "SD";
  if (/EWM/i.test(value)) return "EWM";
  if (/BTP/i.test(value)) return "BTP";
  return "";
}

export function candidateId(candidate: Record<string, any>) {
  return clean(candidate.id || candidate.candidate_id);
}

export function fieldMappingFor(stagingField: string) {
  return FIELD_MAPPINGS.find((mapping) => mapping.stagingField === stagingField || mapping.aliases.includes(stagingField)) || null;
}

export function currentCandidateValue(candidate: Record<string, any>, mapping: CandidateFieldMapping | null) {
  if (!mapping) return "";
  for (const alias of mapping.aliases) {
    if (candidate[alias] !== undefined && candidate[alias] !== null) return candidate[alias];
  }
  return candidate[mapping.candidateField];
}

export function validateCandidateApplyItem(item: AiExtractionStagingRecord, candidate: Record<string, any> | undefined): CandidateApplyValidation {
  const mapping = fieldMappingFor(item.fieldName);
  const reasons: string[] = [];
  const currentDbValue = currentCandidateValue(candidate || {}, mapping);
  if (!candidate) reasons.push("current DB record is missing");
  if (!mapping) reasons.push("field is not in allowed mapping");
  if (item.validationStatus !== "valid") reasons.push("staged item is not valid");
  if (item.appliedToCandidate) reasons.push("staged item already applied to candidate");
  if (!clean(item.approvedValue)) reasons.push("approved value is empty");
  if (/requires_original_file_reupload|reupload/i.test(clean(candidate?.decisionAction || candidate?.extraction_decision_action || candidate?.review_action || candidate?.status_reason))) reasons.push("candidate requires original file reupload");
  if (/duplicate.*conflict|conflict.*duplicate/i.test(clean(candidate?.duplicate_status || candidate?.duplicateIdentityStatus || candidate?.validation_flags))) reasons.push("candidate duplicate conflict unresolved");
  if ((item.riskLevel === "rejected" || item.riskLevel === "conflict") && !clean(item.overrideReason)) reasons.push("rejected or conflict risk requires manual override");
  if (candidate && norm(currentDbValue) !== norm(item.currentValue)) reasons.push("current DB value differs from staging current value");
  if (validExisting(currentDbValue) && norm(currentDbValue) !== norm(item.approvedValue) && Number(item.aiConfidence || 0) < 90) reasons.push("field would downgrade existing valid data");
  if (/company|employer/i.test(item.fieldName) && dirtyEmployer(item.approvedValue)) reasons.push("employer looks like project/client/sentence/email/domain");
  if (/name|displayName|fullName/i.test(item.fieldName) && fakeIdentity(item.approvedValue)) reasons.push("identity looks fake/placeholder/sentence/tool list");
  if (/primarySapModule/i.test(item.fieldName)) {
    const titleModule = moduleFromTitle(candidate?.current_title || candidate?.title);
    if (titleModule && titleModule !== clean(item.approvedValue).toUpperCase()) reasons.push("module conflicts with title");
  }
  if (candidate && norm(currentDbValue) === norm(item.approvedValue)) reasons.push("current DB value already matches approved value");
  return {
    eligible: reasons.length === 0,
    blocked: reasons.length > 0,
    reasons,
    candidateField: mapping?.candidateField || "",
    currentDbValue,
  };
}

export { FIELD_MAPPINGS };
