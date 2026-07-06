import { classifyCandidateSearchVisibility, isRecruiterSearchBadTitle } from "./candidateSearchVisibility";
import { cleanTalentSearchModule, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany } from "./talentSearchDisplay";

type AnyRecord = Record<string, any>;

export type SearchableProfileQualityStatus = "searchable_high_quality" | "searchable_needs_enrichment" | "blocked_validation_queue";
export type SearchableProfileReviewCategory = "search_ready" | "searchable_but_needs_enrichment" | "must_repair_before_search" | "blocked_validation_queue";
export type SearchableProfileRecommendedAction =
  | "keep_searchable"
  | "enrich_company_before_market_release"
  | "enrich_before_market_release"
  | "remove_from_search_until_repaired"
  | "send_to_validation_queue";

export type SearchableProfileQualityResult = {
  candidateId: string;
  status: SearchableProfileQualityStatus;
  reviewCategory: SearchableProfileReviewCategory;
  score: number;
  reasons: string[];
  missingFields: string[];
  riskFlags: string[];
  searchableFields: {
    name: string;
    title: string;
    company: string;
    location: string;
    modules: string[];
    skills: string[];
    keywords: string[];
  };
  recommendedAction: SearchableProfileRecommendedAction;
  currentlyRecruiterSearchable: boolean;
};

const SAP_MODULES = ["FICO", "MM", "SD", "PP", "QM", "PM", "PS", "ABAP", "BASIS", "BTP", "CPI", "PI/PO", "EWM", "WM", "TM", "MDG", "GRC", "BW", "BW/4HANA", "SAC", "DATASPHERE", "SUCCESSFACTORS", "ARIBA", "CONCUR", "FIELDGLASS", "VIM", "OPENTEXT", "HCM", "IS-U"];
const SAP_SKILLS = ["S/4HANA", "ECC", "RISE", "FIORI", "CPI", "PI/PO", "CDS", "ODATA", "WRICEF", "IDOC", "BAPI", "EDI", "ROLLOUT", "IMPLEMENTATION", "SUPPORT", "AMS", "MIGRATION"];
const CRITICAL_STATUSES = /^(deleted|rejected_noise|non_sap)$/i;
const NOT_DISCLOSED_RE = /^(not disclosed|unknown|protected|n\/?a|na|none)$/i;
const INVALID_FRAGMENT_RE = /in the world|where as my goal|managed\s*&|roles and|achievement artifacts|professional objective|personal particular|date of birth|curriculum vitae|responsibilities|generic resume text/i;

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function textBlob(candidate: AnyRecord) {
  return clean([
    candidate.name,
    candidate.displayName,
    candidate.display_name,
    candidate.current_title,
    candidate.title,
    candidate.headline,
    candidate.current_company,
    candidate.company,
    candidate.primary_module,
    candidate.sap_modules,
    candidate.secondary_modules,
    candidate.skills,
    candidate.search_text,
    candidate.summary,
    candidate.raw_text,
    candidate.resume_text,
    candidate.raw_cv,
  ].flatMap((value) => Array.isArray(value) ? value : [value]).join(" "));
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function displayName(candidate: AnyRecord) {
  return clean(candidate.displayName || candidate.display_name || candidate.name || candidate.full_name || candidate.candidate_name || candidate.normalized_name);
}

function title(candidate: AnyRecord) {
  return clean(candidate.display_title || candidate.current_title || candidate.title || candidate.headline);
}

function rawCompany(candidate: AnyRecord) {
  return clean(candidate.display_company || candidate.currentCompany || candidate.current_company || candidate.company || candidate.employer);
}

function location(candidate: AnyRecord) {
  return clean(candidate.display_location || candidate.country || candidate.current_country || candidate.location_country || candidate.location || candidate.current_location);
}

function qualityScore(candidate: AnyRecord) {
  const parsed = Number(candidate.profile_quality_score ?? candidate.parser_quality_score ?? candidate.quality_score ?? candidate.display_quality_score ?? candidate.__index?.quality_score ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeModule(value: any) {
  const raw = clean(value).replace(/^SAP\s+/i, "").toUpperCase();
  if (!raw || /^(UNKNOWN|GENERAL_SAP|SAP_GENERAL|SAP|N\/?A|NA)$/.test(raw)) return "";
  if (/^(FI|CO|FI\/CO|FICO)$/.test(raw)) return "FICO";
  if (/^(PI|PO|PI\/PO|PI-PO)$/.test(raw)) return "PI/PO";
  if (/^(BW4HANA|BW\/4HANA)$/.test(raw)) return "BW/4HANA";
  if (/^SUCCESSFACTORS$/.test(raw)) return "SUCCESSFACTORS";
  if (/^ISU$/.test(raw)) return "IS-U";
  return SAP_MODULES.includes(raw) ? raw : cleanTalentSearchModule(raw);
}

function modules(candidate: AnyRecord) {
  const values = [
    candidate.primary_module,
    candidate.primaryModule,
    candidate.module,
    candidate.sap_module,
    ...list(candidate.sap_modules),
    ...list(candidate.secondary_modules),
    ...list(candidate.selected_modules),
    ...list(candidate.index_all_modules),
    ...list(candidate.skills),
  ];
  return Array.from(new Set(values.map(normalizeModule).filter(Boolean)));
}

function detectedSkills(candidate: AnyRecord) {
  const blob = textBlob(candidate);
  const found = SAP_SKILLS.filter((skill) => {
    if (skill === "PI/PO") return /\bPI\s*\/\s*PO\b|\bPI-PO\b|\bPI PO\b/i.test(blob);
    if (skill === "S/4HANA") return /\bS\/?4HANA\b|\bS4HANA\b/i.test(blob);
    return new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob);
  });
  return Array.from(new Set(found));
}

function isLongSummaryTitle(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  return value.length > 95 || words.length > 12 || /\b(responsible for|experience in|having|worked on|involved in|successfully|professional summary|objective)\b/i.test(value);
}

function validCompanyState(company: string) {
  if (!company) return { valid: true, risk: "company not disclosed" };
  if (INVALID_FRAGMENT_RE.test(company)) return { valid: false, risk: "invalid company fragment" };
  if (NOT_DISCLOSED_RE.test(company)) return { valid: true, risk: "company explicitly not disclosed" };
  if (safeTalentSearchCompany(company) === "Not disclosed") return { valid: false, risk: "unsafe company value" };
  return { valid: true, risk: "" };
}

function keywordFields(input: { name: string; title: string; company: string; location: string; modules: string[]; skills: string[] }) {
  return Array.from(new Set([input.name, input.title, input.company, input.location, ...input.modules, ...input.skills].map(clean).filter(Boolean)));
}

function hasContact(candidate: AnyRecord) {
  return Boolean(clean(candidate.email || candidate.phone || candidate.email_masked || candidate.phone_masked || candidate.contact_email || candidate.contact_phone));
}

function onlyMissingCompany(result: Pick<SearchableProfileQualityResult, "missingFields" | "riskFlags" | "searchableFields">, candidate: AnyRecord) {
  return result.missingFields.length === 1 && result.missingFields[0] === "company" && Boolean(result.searchableFields.name && result.searchableFields.title && result.searchableFields.location && result.searchableFields.modules.length && hasContact(candidate));
}

export function classifySearchableProfileQuality(candidate: AnyRecord): SearchableProfileQualityResult {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  const riskFlags: string[] = [];
  const name = displayName(candidate);
  const role = title(candidate);
  const company = rawCompany(candidate);
  const safeCompany = safeTalentSearchCompany(company);
  const loc = location(candidate);
  const moduleList = modules(candidate);
  const skills = detectedSkills(candidate);
  const visibility = classifyCandidateSearchVisibility(candidate);
  const statusValue = clean(candidate.status || candidate.import_status || candidate.record_status);
  const scoreValue = qualityScore(candidate);
  let score = 100;

  const invalidName = !name || isTalentSearchPlaceholderName(name) || isTalentSearchBadDisplayName(name);
  if (invalidName) {
    reasons.push("invalid or placeholder display name");
    riskFlags.push("critical_identity_issue");
    score -= 45;
  }
  const titleIsInvalid = !role || isRecruiterSearchBadTitle(role);
  const titleIsLongSummary = Boolean(role && isLongSummaryTitle(role));
  if (titleIsInvalid || titleIsLongSummary) {
    reasons.push("invalid or low-quality title");
    riskFlags.push(titleIsLongSummary ? "long_summary_title" : "invalid_title");
    score -= 18;
  }
  const companyState = validCompanyState(company);
  if (!companyState.valid) {
    reasons.push(companyState.risk);
    riskFlags.push(companyState.risk);
    score -= 18;
  } else if (!company || safeCompany === "Not disclosed") {
    missingFields.push("company");
    riskFlags.push(companyState.risk || "company not disclosed");
    score -= 5;
  }
  if (!moduleList.length) {
    reasons.push("missing known SAP module");
    missingFields.push("sap_module");
    riskFlags.push("missing_sap_module");
    score -= 22;
  }
  if (!skills.length && !/\b(SAP|S\/4HANA|S4HANA|ECC|implementation|rollout|support|AMS|migration)\b/i.test(textBlob(candidate))) {
    reasons.push("missing meaningful SAP skill evidence");
    missingFields.push("sap_skill_evidence");
    riskFlags.push("missing_sap_skill_evidence");
    score -= 15;
  }
  if (!loc) {
    missingFields.push("location");
    score -= 5;
  }
  if (visibility.blocked_from_recruiter_search) {
    reasons.push(`blocked from recruiter search: ${visibility.validation_queue_reason}`);
    riskFlags.push("blocked_by_recruiter_visibility_gate");
    score -= 35;
  }
  if (CRITICAL_STATUSES.test(statusValue)) {
    reasons.push(`blocked status: ${statusValue}`);
    riskFlags.push(`status_${statusValue.toLowerCase()}`);
    score -= 50;
  }
  if (scoreValue > 0 && scoreValue < 70) {
    reasons.push("profile quality score below searchable threshold");
    riskFlags.push("low_profile_quality_score");
    score -= scoreValue < 55 ? 25 : 12;
  }
  if (!name) missingFields.push("name");
  if (!role) missingFields.push("title");

  const searchableFields = {
    name,
    title: role,
    company: safeCompany,
    location: loc,
    modules: moduleList,
    skills,
    keywords: keywordFields({ name, title: role, company: safeCompany, location: loc, modules: moduleList, skills }),
  };
  if (!searchableFields.keywords.length || !name || !role || !moduleList.length) {
    riskFlags.push("keyword_search_fields_incomplete");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const criticalRepairIssue = invalidName || titleIsInvalid || titleIsLongSummary || !moduleList.length || CRITICAL_STATUSES.test(statusValue) || riskFlags.includes("invalid company fragment") || riskFlags.includes("unsafe company value");
  const blockedByCurrentGate = visibility.blocked_from_recruiter_search;
  const highQuality = !criticalRepairIssue && !blockedByCurrentGate && boundedScore >= 75 && missingFields.length === 0 && Boolean(name && role && moduleList.length && searchableFields.keywords.length) && !riskFlags.includes("missing_sap_skill_evidence");
  const status: SearchableProfileQualityStatus = blockedByCurrentGate || CRITICAL_STATUSES.test(statusValue)
    ? "blocked_validation_queue"
    : highQuality
      ? "searchable_high_quality"
      : "searchable_needs_enrichment";
  const currentlyRecruiterSearchable = !visibility.blocked_from_recruiter_search;

  let reviewCategory: SearchableProfileReviewCategory;
  if (!currentlyRecruiterSearchable) reviewCategory = "blocked_validation_queue";
  else if (highQuality) reviewCategory = "search_ready";
  else if (criticalRepairIssue) reviewCategory = "must_repair_before_search";
  else reviewCategory = "searchable_but_needs_enrichment";

  const draftResult = { missingFields: Array.from(new Set(missingFields)), riskFlags: Array.from(new Set(riskFlags.filter(Boolean))), searchableFields };
  const recommendedAction: SearchableProfileRecommendedAction = reviewCategory === "search_ready"
    ? "keep_searchable"
    : reviewCategory === "blocked_validation_queue"
      ? "send_to_validation_queue"
      : reviewCategory === "must_repair_before_search"
        ? "remove_from_search_until_repaired"
        : onlyMissingCompany(draftResult, candidate)
          ? "enrich_company_before_market_release"
          : "enrich_before_market_release";

  return {
    candidateId: candidateId(candidate),
    status,
    reviewCategory,
    score: boundedScore,
    reasons: Array.from(new Set(reasons)),
    missingFields: draftResult.missingFields,
    riskFlags: draftResult.riskFlags,
    searchableFields,
    recommendedAction,
    currentlyRecruiterSearchable,
  };
}

export function auditSearchableProfileQuality(candidates: AnyRecord[]) {
  const results = candidates.map(classifySearchableProfileQuality);
  const currentRecruiterSearchable = results.filter((result) => result.currentlyRecruiterSearchable).length;
  const searchableHighQuality = results.filter((result) => result.status === "searchable_high_quality").length;
  const searchableNeedsEnrichment = results.filter((result) => result.status === "searchable_needs_enrichment").length;
  const blockedValidationQueue = results.filter((result) => result.status === "blocked_validation_queue").length;
  const currentlySearchableShouldReview = results.filter((result) => result.currentlyRecruiterSearchable && result.status !== "searchable_high_quality");
  const currentSearchableMissingCompany = currentlySearchableShouldReview.filter((result) => result.missingFields.includes("company"));
  const currentSearchableMissingLocation = currentlySearchableShouldReview.filter((result) => result.missingFields.includes("location"));
  const currentSearchableMissingSapModule = currentlySearchableShouldReview.filter((result) => result.missingFields.includes("sap_module"));
  const currentSearchableInvalidOrLongTitle = currentlySearchableShouldReview.filter((result) => result.riskFlags.includes("invalid_title") || result.riskFlags.includes("long_summary_title"));
  const currentSearchableLowProfileQuality = currentlySearchableShouldReview.filter((result) => result.riskFlags.includes("low_profile_quality_score"));
  const currentSearchableIncompleteKeywordFields = currentlySearchableShouldReview.filter((result) => result.riskFlags.includes("keyword_search_fields_incomplete"));
  const missingFieldCounts = countValues(results.flatMap((result) => result.missingFields));
  const riskFlagCounts = countValues(results.flatMap((result) => result.riskFlags));
  const reviewCategoryCounts = countValues(results.map((result) => result.reviewCategory));
  return {
    totalCandidates: candidates.length,
    currentRecruiterSearchable,
    searchableHighQuality,
    searchableNeedsEnrichment,
    blockedValidationQueue,
    searchReady: reviewCategoryCounts.search_ready || 0,
    searchableButNeedsEnrichment: reviewCategoryCounts.searchable_but_needs_enrichment || 0,
    mustRepairBeforeSearch: reviewCategoryCounts.must_repair_before_search || 0,
    blockedValidationQueueCategory: reviewCategoryCounts.blocked_validation_queue || 0,
    currentlySearchableShouldReview,
    groupedBreakdown: {
      currentSearchableMissingCompany: currentSearchableMissingCompany.length,
      currentSearchableMissingLocation: currentSearchableMissingLocation.length,
      currentSearchableMissingSapModule: currentSearchableMissingSapModule.length,
      currentSearchableInvalidOrLongTitle: currentSearchableInvalidOrLongTitle.length,
      currentSearchableLowProfileQuality: currentSearchableLowProfileQuality.length,
      currentSearchableIncompleteKeywordFields: currentSearchableIncompleteKeywordFields.length,
    },
    missingFieldCounts,
    riskFlagCounts,
    reviewCategoryCounts,
    results,
  };
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}