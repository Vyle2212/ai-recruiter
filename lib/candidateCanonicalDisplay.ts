import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";
import { normalizeValidationStatus, type CandidateValidationStatus } from "./candidateValidation";
import { cleanTalentSearchModule, cleanTalentSearchTitle, displayTalentSearchValidationStatus, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany } from "./talentSearchDisplay";

type AnyRecord = Record<string, any>;

export type CanonicalDisplayResolution = {
  displayName: string;
  displayRole: string;
  currentEmployer: string;
  validationStatus: CandidateValidationStatus;
  displayWarnings: string[];
  hasSafePlaceholderName: boolean;
};

const SAFE_PLACEHOLDER = "Candidate profile pending validation";
const NOT_DISCLOSED = "Not disclosed";
const FORBIDDEN_EMPLOYER = /^(sap|fico|fi|co|mm|sd|pp|pm|ps|abap|basis|btp|ewm|wm|hana|s\/?4hana|s4hana|greenfield|brownfield|rollout|ams|implementation|migration|transformation)$/i;
const BAD_NAME_PHRASE = /^(extended star schema models|installation status|strictly confidential|for mechanical turnkey projects|willing to travel|each type|and need for resources|light mechanics roles|dxc technology|accenture|abeam consulting|personal particular|professional objective|authorization concepts|relevant mast ewm|professional synopsis)$/i;
const NAME_SECTION_OR_COMPANY = /\b(bachelor|master|degree|diploma|university|college|faculty|academic|certificate|certification|certified|professional certificate|training|competencies|responsibilities|employment history|career history|curriculum vitae|resume|personal particular|professional objective|professional synopsis|authorization concepts|relevant mast|date of birth|subjectmatterex|mdmanalyst|company profile|project section|education section|certification section|software|systems|solutions|technologies|technology|consulting|consultancy|group|sdn\s*bhd|pte\s*ltd|limited|ltd|inc|corp|corporation|berhad|plc|llc|gmbh)\b/i;
const GENERIC_NAME_START = /^(currently|experience|experienced|tools|responsibilities|responsibility|project|projects|for|from|with|and|each|installation|strictly|willing|light|extended|managed|roles?|curriculum|personal|professional|authorization|relevant)\b/i;
const displayResolutionCache = new WeakMap<AnyRecord, CanonicalDisplayResolution>();

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isDisplaySafeHumanName(value: any) {
  const name = clean(value).replace(/^['"]+|['"]+$/g, "");
  if (!name || /^candidate profile pending validation$/i.test(name) || name.length < 4 || name.length > 80) return false;
  if (isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name)) return false;
  if (/profile under review|name requires validation|identity under review|current location|technology consulting|academic background|nationality|gender|father'?s name/i.test(name)) return false;
  if (BAD_NAME_PHRASE.test(name) || NAME_SECTION_OR_COMPANY.test(name) || GENERIC_NAME_START.test(name)) return false;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return false;
  return parts.every((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
}

function savedStatus(raw: AnyRecord): CandidateValidationStatus {
  const source = raw.validation_state || raw.validationState || raw.recruiter_validation || raw.recruiterValidation || {};
  let parsed = source;
  if (typeof source === "string") {
    try { parsed = JSON.parse(source); } catch { parsed = {}; }
  }
  return normalizeValidationStatus(raw.validation_status || parsed?.status, "Needs Review");
}

function isAmbiguousEmployer(value: any) {
  const employer = clean(value);
  if (!employer) return true;
  const openParens = (employer.match(/\(/g) || []).length;
  const closeParens = (employer.match(/\)/g) || []).length;
  if (openParens !== closeParens) return true;
  if (/[-|,;:]\s*$/.test(employer)) return true;
  if (/\.\s*(he|she|they|it|is|was|leads?|has|sap)\b/i.test(employer)) return true;
  if (/\b(strictly confidential|innovation|capital market|authorization matrix|authorization concepts|preferred working location|manufacturing domain|business process|based in|towards improving|from date to date|passionate in|employment history|curriculum vitae|personal particular|professional objective|professional synopsis|achievement artifacts available for viewing|managed demand|managed &|roles and|in the world|where as my goal|pallet positions|jalan|wilayah|menara)\b/i.test(employer)) return true;
  if (/\b(consultant|manager|developer|analyst|lead|senior|role|responsibilities|tools|platforms|module)\b/i.test(employer)) return true;
  return false;
}

function isForbiddenEmployer(value: any) {
  const employer = clean(value);
  if (!employer) return true;
  const normalized = employer.toLowerCase().replace(/[().,_/\\|&+-]+/g, " ").replace(/\s+/g, " ").trim();
  return safeTalentSearchCompany(employer) === NOT_DISCLOSED || FORBIDDEN_EMPLOYER.test(normalized) || isAmbiguousEmployer(employer);
}

function parseJsonMaybe(value: any): any {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^[\[{]/.test(trimmed)) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function list(value: any): any[] {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") return [parsed];
  return [];
}

function structuredRecords(raw: AnyRecord) {
  const sources = [raw.currentExperience, raw.current_experience, raw.latestExperience, raw.latest_experience, raw.workExperience, raw.work_experience, raw.experience, raw.experiences, raw.employmentHistory, raw.employment_history, raw.positions, raw.jobs, raw.parsedProfile?.experience, raw.parsedResume?.experience, raw.resume?.experience];
  return sources.flatMap(list).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function companyFromRecord(record: AnyRecord) {
  return clean(record.company || record.companyName || record.company_name || record.currentCompany || record.current_company || record.employer || record.organization || record.organisation || record.client || record.account);
}

function trustedEmployer(raw: AnyRecord, canonicalEmployer: string) {
  const direct = [canonicalEmployer, raw.canonicalCurrentCompany, raw.currentCompany, raw.currentEmployer, raw.current_company, raw.current_employer, raw.company, raw.employer]
    .map(clean)
    .find((company) => company && company !== NOT_DISCLOSED && !isForbiddenEmployer(company));
  if (direct) return direct;
  const structured = structuredRecords(raw).map(companyFromRecord).find((company) => company && !isForbiddenEmployer(company));
  return structured || NOT_DISCLOSED;
}

function moduleFromCandidate(raw: AnyRecord) {
  const values = [raw.primary_module, raw.module, raw.sap_module, raw.selected_modules, raw.secondary_modules, raw.all_modules, raw.sap_modules];
  for (const value of values) {
    const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;|/]+/) : [value];
    for (const item of items) {
      const module = cleanTalentSearchModule(item);
      if (module) return module;
    }
  }
  return "";
}

function roleFromCandidate(raw: AnyRecord) {
  const module = moduleFromCandidate(raw);
  return cleanTalentSearchTitle(raw.display_title || raw.current_title || raw.currentTitle || raw.title || raw.role || raw.position || raw.designation || raw.job_title || raw.headline, module || "SAP");
}

export function resolveCanonicalCandidateDisplay(raw: AnyRecord): CanonicalDisplayResolution {
  const source = (raw || {}) as AnyRecord;
  const cached = displayResolutionCache.get(source);
  if (cached) return cached;
  const profile = buildCanonicalCandidateProfile(source);
  const warnings = [...profile.auditWarnings];
  const canonicalName = clean(profile.displayName);
  const displayName = isDisplaySafeHumanName(canonicalName) ? canonicalName : SAFE_PLACEHOLDER;
  const hasSafePlaceholderName = displayName === SAFE_PLACEHOLDER;
  const currentEmployer = trustedEmployer(source, profile.currentCompany);
  const displayRole = roleFromCandidate(source);
  if (hasSafePlaceholderName) warnings.push("Safe placeholder display name");
  if (currentEmployer === NOT_DISCLOSED) warnings.push("Missing trusted current employer");
  if (/UNKNOWN|\bSAP\s+SAP\b|^Employment\b|[([{]\s*$|[-|]\s*$/i.test(displayRole)) warnings.push("Role display artifact");

  const inferredStatus = displayTalentSearchValidationStatus({
    status: savedStatus(source),
    score: profile.parserQualityScore,
    displayName,
    currentEmployer,
    title: displayRole,
  }) as CandidateValidationStatus;
  const validationStatus = displayName === SAFE_PLACEHOLDER || currentEmployer === NOT_DISCLOSED
    ? "Missing Information"
    : inferredStatus === "Ready" && (profile.identityReviewRequired || !profile.allowedForExecutiveExport)
      ? "Needs Review"
      : normalizeValidationStatus(inferredStatus, "Needs Review");

  const result = { displayName, displayRole, currentEmployer, validationStatus, displayWarnings: warnings, hasSafePlaceholderName };
  displayResolutionCache.set(source, result);
  return result;
}
