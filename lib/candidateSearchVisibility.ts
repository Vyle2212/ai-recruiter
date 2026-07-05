import { isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany } from "./talentSearchDisplay";

type AnyRecord = Record<string, any>;

export type CandidateSearchVisibility = {
  search_visibility: "RECRUITER_SEARCH" | "VALIDATION_QUEUE";
  validation_queue_reason: string;
  blocked_from_recruiter_search: boolean;
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}


function numeric(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function list(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  return [];
}

function rawName(candidate: AnyRecord) {
  if (candidate.raw_exact_display_name) return clean(candidate.raw_exact_display_name);
  if ("raw_candidate_name" in candidate) return clean(candidate.raw_candidate_name || candidate.source_name || candidate.full_name || candidate.candidate_name);
  return clean(candidate.source_name || candidate.full_name || candidate.candidate_name || candidate.displayName || candidate.display_name || candidate.name || candidate.__index?.display_name);
}

function rawTitle(candidate: AnyRecord) {
  if ("raw_current_title" in candidate || "raw_title" in candidate) return clean(candidate.raw_current_title || candidate.raw_title);
  return clean(candidate.current_title || candidate.title || candidate.headline || candidate.display_title || candidate.__index?.display_title);
}

function rawCompany(candidate: AnyRecord) {
  if ("raw_current_company" in candidate || "raw_company" in candidate) return clean(candidate.raw_current_company || candidate.raw_company);
  return clean(candidate.current_company || candidate.display_company || candidate.currentCompany || candidate.current_employer || candidate.company || candidate.employer || candidate.__index?.display_company);
}

function modules(candidate: AnyRecord) {
  const hasRawModuleFields = "raw_primary_module" in candidate || "raw_sap_modules" in candidate || "raw_secondary_modules" in candidate || "raw_skills" in candidate;
  if (hasRawModuleFields) {
    return [
      candidate.raw_primary_module,
      ...list(candidate.raw_sap_modules),
      ...list(candidate.raw_secondary_modules),
      ...list(candidate.raw_skills),
    ].map(clean).filter(Boolean);
  }
  return [
    candidate.primary_module,
    candidate.primaryModule,
    candidate.__index?.primary_module,
    ...list(candidate.sap_modules),
    ...list(candidate.secondary_modules),
    ...list(candidate.index_all_modules),
    ...list(candidate.__index?.all_modules),
    ...list(candidate.skills),
  ].map(clean).filter(Boolean);
}

export function isRecruiterSearchBadTitle(value: any) {
  const title = clean(value);
  if (!title) return true;
  return /^(personal particular|personal particulars|professional objective|professional synopsis|career objective|curriculum vitae|cv|resume|authorization concepts|relevant mast(?: ewm)?|date of birth|profile summary|career history|employment history)$/i.test(title) ||
    /\b(date of birth|subjectmatterex|mdmanalyst|from data acquisition|company profile|project section|education section|certification section|roles and|managed &|responsibilities|personal details)\b/i.test(title);
}

function isUnknownModule(value: string) {
  return /^(unknown|sap|general_sap|sap_general)$/i.test(value);
}


function validationStatus(candidate: AnyRecord) {
  return clean(candidate.validation_status || candidate.validationStatus || candidate.validation_badge || candidate.status || "Needs Review");
}

export function classifyCandidateSearchVisibility(candidate: AnyRecord): CandidateSearchVisibility {
  const name = rawName(candidate);
  const title = rawTitle(candidate);
  const company = rawCompany(candidate);
  const safeCompany = safeTalentSearchCompany(company);
  const candidateModules = modules(candidate);
  const years = numeric(candidate.years ?? candidate.years_experience ?? candidate.sap_years ?? candidate.__index?.years);
  const invalidName = isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name);
  const invalidTitle = isRecruiterSearchBadTitle(title);
  const invalidEmployer = Boolean(company && !/^(not disclosed|unknown|protected|n\/a|na)$/i.test(company) && safeCompany === "Not disclosed");
  const missingModules = candidateModules.length === 0 || candidateModules.every(isUnknownModule);
  const invalidYears = years < 0 || years > 45 || (!years && /\b(19|20)\d{2}\b/.test(clean(candidate.raw_text || candidate.resume_text || candidate.raw_cv || candidate.summary)));
  const qualityScore = numeric(candidate.raw_profile_quality_score ?? candidate.profile_quality_score ?? candidate.parser_quality_score ?? candidate.quality_score ?? candidate.index_quality_score ?? candidate.__index?.quality_score);
  const lowQuality = qualityScore > 0 && qualityScore < 55;
  const identityNotTrusted = invalidName || candidate.name_review_required === true;

  if (invalidName) return blocked("invalid-display-name");
  if (invalidTitle) return blocked("invalid-title");
  if (invalidEmployer) return blocked("invalid-employer-fragment");
  if (missingModules) return blocked("missing-sap-module");
  if (invalidYears) return blocked("invalid-years");
  if (lowQuality) return blocked("low-profile-quality");
  if (/missing information/i.test(validationStatus(candidate)) && identityNotTrusted) return blocked("missing-information-untrusted-identity");

  return {
    search_visibility: "RECRUITER_SEARCH",
    validation_queue_reason: "",
    blocked_from_recruiter_search: false,
  };
}

function blocked(reason: string): CandidateSearchVisibility {
  return {
    search_visibility: "VALIDATION_QUEUE",
    validation_queue_reason: reason,
    blocked_from_recruiter_search: true,
  };
}
export type ValidationQueueIssueKey =
  | "invalid-name"
  | "missing-contact"
  | "missing-sap-module"
  | "missing-location"
  | "invalid-title"
  | "invalid-company"
  | "low-quality"
  | "invalid-years"
  | "identity-review";

export type ValidationQueueIssue = {
  key: ValidationQueueIssueKey;
  label: string;
  evidence: string;
};

function hasContact(candidate: AnyRecord) {
  return Boolean(clean(candidate.email || candidate.phone || candidate.email_masked || candidate.phone_masked));
}

function locationValue(candidate: AnyRecord) {
  return clean(candidate.country || candidate.current_country || candidate.location_country || candidate.current_location || candidate.location || candidate.__index?.country || candidate.__index?.display_location);
}

function issue(key: ValidationQueueIssueKey, label: string, evidence: string): ValidationQueueIssue {
  return { key, label, evidence };
}

export function getCandidateValidationQueueIssues(candidate: AnyRecord): ValidationQueueIssue[] {  const name = rawName(candidate);
  const title = rawTitle(candidate);
  const company = rawCompany(candidate);
  const safeCompany = safeTalentSearchCompany(company);
  const candidateModules = modules(candidate);
  const years = numeric(candidate.years ?? candidate.years_experience ?? candidate.sap_years ?? candidate.__index?.years);
  const qualityScore = numeric(candidate.raw_profile_quality_score ?? candidate.profile_quality_score ?? candidate.parser_quality_score ?? candidate.quality_score ?? candidate.index_quality_score ?? candidate.__index?.quality_score);
  const validation = classifyCandidateSearchVisibility(candidate);
  const issues: ValidationQueueIssue[] = [];

  if (isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name)) issues.push(issue("invalid-name", "Invalid name", name || "No trusted display name"));
  if (!hasContact(candidate)) issues.push(issue("missing-contact", "Missing contact", "No email or phone available"));
  if (candidateModules.length === 0 || candidateModules.every(isUnknownModule)) issues.push(issue("missing-sap-module", "Missing SAP module", candidateModules.join(", ") || "No trusted SAP module"));
  if (!locationValue(candidate)) issues.push(issue("missing-location", "Missing location", "No country or location available"));
  if (isRecruiterSearchBadTitle(title)) issues.push(issue("invalid-title", "Invalid title", title || "No trusted title"));
  if (company && !/^(not disclosed|unknown|protected|n\/a|na)$/i.test(company) && safeCompany === "Not disclosed") issues.push(issue("invalid-company", "Invalid company", company));
  if (years < 0 || years > 45) issues.push(issue("invalid-years", "Invalid years", String(years)));
  if (qualityScore > 0 && qualityScore < 55) issues.push(issue("low-quality", "Low profile quality", String(qualityScore)));
  if (/missing information/i.test(validationStatus(candidate)) && validation.blocked_from_recruiter_search) issues.push(issue("identity-review", "Identity review", validation.validation_queue_reason));

  if (!issues.length && validation.blocked_from_recruiter_search) issues.push(issue("identity-review", "Identity review", validation.validation_queue_reason || "Blocked from recruiter search"));
  return issues;
}