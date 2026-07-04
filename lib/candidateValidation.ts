import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";

export const VALIDATION_STATUSES = [
  "Ready",
  "Needs Review",
  "Missing Information",
  "Duplicate Suspected",
  "Parsing Issue",
  "Hidden",
  "Archived",
] as const;

export type CandidateValidationStatus = (typeof VALIDATION_STATUSES)[number];
export type CandidateValidationAction =
  | "approve-name"
  | "correct-name"
  | "approve-employer"
  | "correct-employer"
  | "approve-sap-years"
  | "merge-duplicate"
  | "hide-candidate"
  | "archive-candidate"
  | "mark-ready"
  | "mark-needs-review";

export type CandidateValidationHistoryEntry = {
  timestamp: string;
  user: string;
  action: CandidateValidationAction | "system";
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
};

export type CandidateValidationState = {
  status: CandidateValidationStatus;
  score: number;
  threshold: number;
  checks: {
    identity: {
      name: boolean;
      email: boolean;
      phone: boolean;
      linkedIn: boolean;
    };
    employment: {
      currentCompany: boolean;
      previousCompanies: boolean;
    };
    sap: {
      modules: boolean;
      sapYears: boolean;
      s4: boolean;
      industry: boolean;
      consultingBackground: boolean;
    };
  };
  flags: {
    duplicateSuspected: boolean;
    employerMissing: boolean;
    invalidName: boolean;
    lowParserConfidence: boolean;
    parsingIssue: boolean;
  };
  approved: {
    name: boolean;
    employer: boolean;
    sapYears: boolean;
  };
  corrections: {
    name?: string;
    employer?: string;
    sapYears?: number;
    duplicateOf?: string;
  };
  history: CandidateValidationHistoryEntry[];
  exportEligible: boolean;
  blockingReasons: string[];
};

type AnyRecord = Record<string, any>;

export const DEFAULT_VALIDATION_THRESHOLD = 80;

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function bool(value: any) {
  return value === true || /^(true|1|yes|approved)$/i.test(clean(value));
}

function numberValue(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function list(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return list(parsed);
    } catch {}
    return value.split(/[,;|\n]+/).map(clean).filter(Boolean);
  }
  if (typeof value === "object") return Object.values(value).flatMap(list);
  return [];
}

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function savedState(raw: AnyRecord): Partial<CandidateValidationState> {
  const source = raw.validation_state || raw.validationState || raw.recruiter_validation || raw.recruiterValidation || {};
  if (typeof source === "string") {
    try {
      return JSON.parse(source);
    } catch {
      return {};
    }
  }
  return source && typeof source === "object" ? source : {};
}

export function normalizeValidationStatus(value: any, fallback: CandidateValidationStatus = "Needs Review"): CandidateValidationStatus {
  const text = clean(value);
  return (VALIDATION_STATUSES as readonly string[]).includes(text) ? (text as CandidateValidationStatus) : fallback;
}

export function buildCandidateValidationState(raw: AnyRecord, threshold = DEFAULT_VALIDATION_THRESHOLD): CandidateValidationState {
  const canonical = buildCanonicalCandidateProfile(raw);
  const saved = savedState(raw);
  const corrections = { ...(saved.corrections || {}) } as CandidateValidationState["corrections"];
  const approved = {
    name: bool(saved.approved?.name || raw.validation_name_approved),
    employer: bool(saved.approved?.employer || raw.validation_employer_approved),
    sapYears: bool(saved.approved?.sapYears || raw.validation_sap_years_approved),
  };
  const displayName = clean(corrections.name || canonical.displayName);
  const currentCompany = clean(corrections.employer || canonical.currentCompany);
  const sapYears = numberValue(corrections.sapYears, canonical.sapYears, raw.years, raw.years_experience);
  const modules = list([raw.primary_module, raw.module, raw.modules, raw.secondary_modules, raw.all_modules]).filter((item) => !/^unknown$/i.test(item));
  const blob = textOf([raw.raw_text, raw.resume_text, raw.summary, raw.industry, raw.industries, raw.current_company, raw.company]).toLowerCase();
  const history = Array.isArray(saved.history) ? saved.history.slice(-100) : [];

  const identity = {
    name: Boolean(displayName && (!canonical.identityReviewRequired || corrections.name)),
    email: clean(raw.email || raw.contact_email).includes("@"),
    phone: clean(raw.phone || raw.mobile || raw.contact_phone).replace(/\D/g, "").length >= 8,
    linkedIn: /linkedin/i.test(clean(raw.linkedin || raw.linkedin_url || raw.profile_url)),
  };
  const employment = {
    currentCompany: Boolean(currentCompany && currentCompany !== "Not disclosed"),
    previousCompanies: list([raw.previous_company, raw.previousCompany, raw.employer_history, raw.employment_history, raw.workExperience, raw.experience]).length > 0,
  };
  const sap = {
    modules: modules.length > 0,
    sapYears: sapYears > 0 && sapYears <= 45,
    s4: canonical.deliveryMetrics.s4 > 0 || /s\/?4hana|s4hana/.test(blob),
    industry: Boolean(clean(raw.industry || raw.display_industry || raw.industries) || /bank|retail|manufacturing|oil|gas|telecom|healthcare|public sector|fmcg/.test(blob)),
    consultingBackground: canonical.backgroundExperience !== "Not disclosed",
  };
  const flags = {
    duplicateSuspected: bool(saved.flags?.duplicateSuspected || raw.duplicate_suspected || raw.duplicate_count),
    employerMissing: !employment.currentCompany,
    invalidName: !identity.name,
    lowParserConfidence: numberValue(raw.parser_quality_score, raw.profile_quality_score, canonical.parserQualityScore) < 75,
    parsingIssue: canonical.needsManualReview || canonical.auditWarnings.length > 0,
  };

  const missingCriticalIdentity = !identity.email && !identity.phone && !identity.linkedIn;

  let score = 0;
  if (identity.name) score += 20;
  if (identity.email) score += 8;
  if (identity.phone) score += 7;
  if (identity.linkedIn) score += 5;
  if (employment.currentCompany) score += approved.employer ? 18 : 12;
  if (employment.previousCompanies) score += 5;
  if (sap.modules) score += 10;
  if (sap.sapYears) score += approved.sapYears ? 10 : 7;
  if (sap.s4) score += 5;
  if (sap.industry) score += 5;
  if (sap.consultingBackground) score += 5;
  if (approved.name) score += 5;
  if (!flags.duplicateSuspected) score += 5;
  if (!flags.parsingIssue) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let inferredStatus: CandidateValidationStatus = "Needs Review";
  if (bool((saved as AnyRecord).hidden || raw.hidden)) inferredStatus = "Hidden";
  else if (bool((saved as AnyRecord).archived || raw.archived)) inferredStatus = "Archived";
  else if (flags.duplicateSuspected) inferredStatus = "Duplicate Suspected";
  else if (flags.invalidName || flags.parsingIssue) inferredStatus = "Parsing Issue";
  else if (flags.employerMissing || missingCriticalIdentity || !sap.sapYears) inferredStatus = "Missing Information";
  else if (score >= threshold) inferredStatus = "Ready";
  const status = normalizeValidationStatus(raw.validation_status || saved.status, inferredStatus);

  const blockingReasons: string[] = [];
  if (status !== "Ready") blockingReasons.push(`Validation Status = ${status}`);
  if (score < threshold) blockingReasons.push(`Validation Score ${score} < ${threshold}`);
  if (flags.duplicateSuspected) blockingReasons.push("Duplicate suspected");
  if (flags.parsingIssue) blockingReasons.push("Parsing issue");
  if (flags.invalidName) blockingReasons.push("Invalid name");
  if (flags.employerMissing) blockingReasons.push("Missing employer");
  if (!sap.sapYears) blockingReasons.push("Invalid SAP years");
  if (missingCriticalIdentity) blockingReasons.push("Missing critical identity");
  if (flags.lowParserConfidence) blockingReasons.push("Low parser confidence");
  if (status === "Hidden" || status === "Archived") blockingReasons.push(status);

  return {
    status,
    score,
    threshold,
    checks: { identity, employment, sap },
    flags,
    approved,
    corrections,
    history,
    exportEligible: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function applyCandidateValidationAction(
  current: CandidateValidationState,
  action: CandidateValidationAction,
  input: { value?: any; reason?: string; user?: string; timestamp?: string } = {},
): CandidateValidationState {
  const next: CandidateValidationState = JSON.parse(JSON.stringify(current));
  const timestamp = input.timestamp || new Date().toISOString();
  const user = clean(input.user) || "recruiter";
  const reason = clean(input.reason) || action;
  let field = "status";
  let oldValue: unknown = current.status;
  let newValue: unknown = current.status;

  if (action === "approve-name") { field = "approved.name"; oldValue = current.approved.name; next.approved.name = true; newValue = true; }
  if (action === "correct-name") { field = "corrections.name"; oldValue = current.corrections.name || ""; next.corrections.name = clean(input.value); next.approved.name = Boolean(next.corrections.name); newValue = next.corrections.name || ""; }
  if (action === "approve-employer") { field = "approved.employer"; oldValue = current.approved.employer; next.approved.employer = true; newValue = true; }
  if (action === "correct-employer") { field = "corrections.employer"; oldValue = current.corrections.employer || ""; next.corrections.employer = clean(input.value); next.approved.employer = Boolean(next.corrections.employer); newValue = next.corrections.employer || ""; }
  if (action === "approve-sap-years") { field = "approved.sapYears"; oldValue = current.approved.sapYears; next.approved.sapYears = true; newValue = true; }
  if (action === "merge-duplicate") { field = "corrections.duplicateOf"; oldValue = current.corrections.duplicateOf || ""; next.corrections.duplicateOf = clean(input.value); next.flags.duplicateSuspected = false; newValue = next.corrections.duplicateOf || "merged"; }
  if (action === "hide-candidate") { field = "status"; next.status = "Hidden"; newValue = next.status; }
  if (action === "archive-candidate") { field = "status"; next.status = "Archived"; newValue = next.status; }
  if (action === "mark-ready") { field = "status"; next.status = "Ready"; newValue = next.status; }
  if (action === "mark-needs-review") { field = "status"; next.status = "Needs Review"; newValue = next.status; }

  next.history = [...current.history, { timestamp, user, action, field, oldValue, newValue, reason }].slice(-100);
  return next;
}

export function serializeCandidateValidationState(state: CandidateValidationState) {
  return {
    status: state.status,
    score: state.score,
    threshold: state.threshold,
    checks: state.checks,
    flags: state.flags,
    approved: state.approved,
    corrections: state.corrections,
    history: state.history,
    exportEligible: state.exportEligible,
    blockingReasons: state.blockingReasons,
  };
}




