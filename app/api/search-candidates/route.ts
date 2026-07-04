import { NextRequest, NextResponse } from "next/server";
import { buildCanonicalCandidateProfile } from "@/lib/canonicalCandidateProfile";
import { evaluateResumeQualityGate } from "@/lib/resumeQualityGate";
import { dedupeByCanonicalIdentity } from "@/lib/identityResolution";
import { supabase } from "@/lib/supabase";
import {
  buildCandidateSapText,
  buildSapSearchIntent,
  candidateModuleSignals,
  canonicalSapKey,
  derivePrimarySapModule,
  primarySapModuleCanSatisfySearch,
  scoreSapSearchCandidate,
  sapDisplayLabel,
  sapRoleTypeForModules,
} from "@/lib/sapCanonicalModuleEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep this aligned with the actual candidates table. Avoid adding columns that are not confirmed in Supabase.
const CANDIDATE_LIGHT_FIELDS = `
  id,
  name,
  email,
  phone,
  location,
  current_location,
  current_title,
  title,
  headline,
  years,
  years_experience,
  primary_module,
  secondary_modules,
  sap_modules,
  sap_submodules,
  skills,
  role_type,
  consulting_level,
  current_company,
  company,
  summary,
  experience,
  raw_text,
  resume_text,
  raw_cv,
  expected_salary,
  status,
  profile_quality_score,
  implementation_project_count,
  rollout_project_count,
  ams_support_project_count,
  migration_project_count,
  total_project_count,
  s4hana_project_count,
  s4_implementation_count,
  s4_support_count,
  s4_greenfield_count,
  s4_conversion_count,
  module_authority_score,
  module_authority,
  implementation_authority,
  domain_authority,
  consulting_dna,
  confidence,
  name_review_required,
  title_review_required,
  years_review_required,
  updated_at
`;

type AnyRecord = Record<string, any>;

const SEARCH_INDEX_FIELDS = `
  candidate_id,
  primary_module,
  all_modules,
  all_submodules,
  country,
  city,
  years,
  role_type,
  consulting_level,
  company_type,
  consulting_firms,
  project_types,
  greenfield_count,
  brownfield_count,
  rollout_count,
  s4_count,
  s4_ams_count,
  ams_count,
  quality_score,
  contactable,
  search_text,
  updated_at,
  source_updated_at,
  display_name,
  display_title,
  display_company,
  display_location,
  email_masked,
  phone_masked
`;

function chunk<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function mergeIndexCandidate(indexRow: AnyRecord, candidate?: AnyRecord): AnyRecord {
  const c = candidate || {};
  return {
    ...c,
    __index: indexRow,
    id: c.id || indexRow.candidate_id,
    candidate_id: indexRow.candidate_id,
    // candidate_search_index is the canonical source after rebuild.
    // Do NOT let stale candidates.primary_module override the strict index primary module.
    primary_module: indexRow.primary_module || c.primary_module,
    primaryModule: indexRow.primary_module || c.primary_module,
    // Keep module display canonical and index-backed.
    index_all_modules: indexRow.all_modules || [],
    secondary_modules: (indexRow.all_modules || []).filter((module: any) => String(module || "").toUpperCase() !== String(indexRow.primary_module || "").toUpperCase()),
    sap_modules: indexRow.primary_module ? [indexRow.primary_module] : (c.sap_modules || []),
    sap_submodules: indexRow.all_submodules || c.sap_submodules || [],
    role_type: c.role_type || indexRow.role_type,
    consulting_level: c.consulting_level || indexRow.consulting_level,
    company_type: c.company_type || indexRow.company_type,
    current_company: c.current_company || indexRow.display_company,
    company: c.company || indexRow.display_company,
    location: c.location || indexRow.display_location || indexRow.country,
    current_location: c.current_location || indexRow.display_location || indexRow.country,
    years: n(c.years ?? indexRow.years),
    profile_quality_score: n(indexRow.quality_score ?? c.profile_quality_score, c.profile_quality_score ?? 85),
    contactable: Boolean(indexRow.contactable || c.email || c.phone),
    index_quality_score: n(indexRow.quality_score ?? c.profile_quality_score, c.profile_quality_score ?? 85),
    email_masked: indexRow.email_masked,
    phone_masked: indexRow.phone_masked,
    search_text: indexRow.search_text,
    // Index-level project counts are the canonical display fallback for Talent Pool Search.
    greenfield_count: n(c.greenfield_count ?? indexRow.greenfield_count),
    brownfield_count: n(c.brownfield_count ?? indexRow.brownfield_count),
    rollout_count: n(c.rollout_count ?? indexRow.rollout_count),
    s4_count: n(c.s4_count ?? indexRow.s4_count),
    s4_ams_count: n(c.s4_ams_count ?? indexRow.s4_ams_count ?? indexRow.ams_count),
    ams_count: n(c.ams_count ?? indexRow.ams_count),
    project_types: unique([...arrayFrom(c.project_types), ...arrayFrom(indexRow.project_types)]),
  };
}

function firstParam(url: URL, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return fallback;
}

function parseList(value: any): string[] {
  return String(value || "")
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !["all", "any"].includes(item.toLowerCase()));
}

function listParams(url: URL, keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    for (const value of url.searchParams.getAll(key)) values.push(...parseList(value));
  }
  return unique(values);
}

function unique(values: any[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function toBool(value: any) {
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ilikeValue(value: string) {
  return `%${String(value || "").replace(/[%_]/g, "")}%`;
}

function maskEmail(email: any) {
  const e = String(email || "").trim();
  const [name, domain] = e.split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: any) {
  const value = String(phone || "").trim();
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${value.slice(0, 3)} ***** ${digits.slice(-3)}`;
}

function arrayFrom(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return value.split(/[,;|\n]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizedText(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/[â€â€‘â€’â€“â€”â€•]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}


function cleanSearchKey(value: any) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SEARCH_HIDDEN_STATUSES = new Set(["REJECTED_NOISE", "DELETED", "NON_SAP"]);
const SEARCH_REVIEW_STATUSES = new Set(["NEEDS_REVIEW"]);

const SEARCH_BAD_NAME_PATTERNS = [
  /\bPROFILE\s+UNDER\s+REVIEW\b/i,
  /\bREVIEW\s+REQUIRED\b/i,
  /\bCANDIDATE\s+INFORMATION\b/i,
  /\bPERSONAL\s+PARTICULARS\b/i,
  /\bPERSONAL\s+INFORMATION\b/i,
  /\bFULL\s+NAME\b/i,
  /\bHEAD\s+MANAGEMENT\b/i,
  /\bCORE\s+EXPERTISE\b/i,
  /\bCONDUCTS\s+OR\s+GUIDES\b/i,
  /\bENGINEERING,\s*ADANI\b/i,
  /\bPROCESS\s+RE[-\s]?ENGINEERING\b/i,
  /\bRELEASE\s+STRATEGY\b/i,
  /\bAND\s+DRIVING\s+HIGH[-\s]?IMPACT\b/i,
  /\bFROM\s+DATE\b/i,
  /\bTO\s+DATE\b/i,
  /\bAND\s+QUALITY\b/i,
  /\bPROJECTS\s+AS\s+REFERENCE\b/i,
  /\bABOUT\s+ME\b/i,
  /\bPOSITION\s+TITLE\b/i,
  /\bCURRENT\s+POSITION\s+TITLE\b/i,
  /\bTOOLS\s*:/i,
];

const SEARCH_GENERIC_TITLE_PATTERNS = [
  /^(MANAGER|SENIOR MANAGER|ASSISTANT MANAGER|ASSITANT MANAGER)$/i,
  /^(CONSULTANT|SENIOR CONSULTANT|LEAD CONSULTANT|ASSOCIATE CONSULTANT)$/i,
  /^(BUSINESS CONSULTANT|FUNCTIONAL CONSULTANT|TECHNICAL CONSULTANT)$/i,
  /^(PROJECT MANAGER|IT PROJECT MANAGER|PROGRAM MANAGER|PROGRAMME MANAGER)$/i,
  /^(PRODUCT MANAGER|TERRITORY MANAGER|SALES MANAGER|SERVICE DELIVERY MANAGER)$/i,
];

function isSearchBadName(value: any) {
  const name = cleanSearchKey(value);
  if (!name) return true;
  return SEARCH_BAD_NAME_PATTERNS.some((rx) => rx.test(name));
}

function isSearchUnknownModule(value: any) {
  const module = cleanSearchKey(value);
  return !module || module === "UNKNOWN" || module === "GENERAL_SAP" || module === "SAP";
}

function isSearchGenericTitle(value: any) {
  const title = cleanSearchKey(value)
    .replace(/^POSITION TITLE\s*[:\-]\s*/i, "")
    .replace(/^CURRENT POSITION TITLE\s*[:\-]\s*/i, "")
    .replace(/^ROLE\s*[:\-]\s*/i, "")
    .replace(/[().,;:]+$/g, "")
    .trim();

  if (!title) return true;
  return SEARCH_GENERIC_TITLE_PATTERNS.some((rx) => rx.test(title));
}

function hasStrongSapTitleEvidenceForSearch(value: any) {
  const title = String(value || "");
  return /\b(SAP\s+FICO|FI\/CO|FICO|SAP\s+FI\b|SAP\s+CO\b|CFIN|CENTRAL\s+FINANCE|SAP\s+SD\b|SD\s+CONSULTANT|SAP\s+MM\b|MM\s+CONSULTANT|SAP\s+PM\b|SAP\s+PS\b|SAP\s+PP\b|SAP\s+ABAP|ABAP\s+DEVELOPER|SAP\s+BASIS|BASIS\s+CONSULTANT|SAP\s+BW|SAP\s+BI|BI\s+CONSULTANT|SAP\s+BTP|SAP\s+SECURITY|SUCCESSFACTORS|SUCCESS\s+FACTORS|SAP\s+SF\b|S\/4HANA|S4HANA|SAP\s+HANA|SAP\s+EWM|SAP\s+TM|SAP\s+IS[-\s]?U|SAP\s+BODS|EWM\/WMS|WM\/EWM)\b/i.test(title);
}

function shouldHideCandidateFromRecruiterSearch(candidate: AnyRecord, showReview = false) {
  const status = cleanSearchKey(candidate.status);
  const primary = candidate.primary_module || candidate.primaryModule || candidate.__index?.primary_module;
  const title = candidate.current_title || candidate.title || candidate.headline || candidate.__index?.display_title;
  const name = candidate.name || candidate.__index?.display_name;

  if (SEARCH_HIDDEN_STATUSES.has(status)) return true;

  // Default production search: never show needs_review unless checkbox/param is on.
  if (!showReview && SEARCH_REVIEW_STATUSES.has(status)) return true;

  // Even when showReview is on, parser-placeholder names should not appear in recruiter results.
  // They can be handled in audit/admin review, not in Talent Pool Search.
  if (isSearchBadName(name)) return true;

  if (isSearchGenericTitle(title) && isSearchUnknownModule(primary)) return true;

  // Generic title + needs_review is too weak for search unless title itself has SAP module evidence.
  if (SEARCH_REVIEW_STATUSES.has(status) && isSearchGenericTitle(title) && !hasStrongSapTitleEvidenceForSearch(title)) {
    return true;
  }

  return false;
}




const BAD_DISPLAY_TITLE_PATTERNS = [
  /^(current location|professional objective|career objective|profile summary|professional summary|position level|nationality|date of birth|personal details|for enhancements|key competencies|analytical problem solving abilities|internally and externally|green channel travel services|each type\.?|prefer contract role only)$/i,
  /^career history\s*$/i,
  /^career history\s*/i,
  /^(sap consultant|consultant)$/i,
];

function cleanDisplayTitle(value: any, primaryModule = "SAP") {
  let title = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^career history\s*/i, "")
    .replace(/^(title|position|designation|current position|current title|role|job title)\s*[:\-]\s*/i, "")
    .replace(/[â€¢|]+/g, " ")
    .trim();

  if (title.length > 90) title = title.slice(0, 90).replace(/\s+\S*$/, "").trim();

  const bad = !title || BAD_DISPLAY_TITLE_PATTERNS.some((rx) => rx.test(title));
  if (bad) {
    const m = String(primaryModule || "SAP").replace(/^SAP\s+/i, "").toUpperCase();
    return m && m !== "UNKNOWN" && m !== "SAP" ? `SAP ${m} Consultant` : "SAP Consultant";
  }
  return title;
}

function calibratedProfileQuality(candidate: AnyRecord, years: number, title: string) {
  // Distribution-focused quality score. This avoids 92/100 or 100/100 clustering.
  // Quality = data completeness + confidence, not role strength.
  const projects = resolveProjectCounts(candidate);
  let score = 58;

  if (candidate.email) score += 8;
  if (candidate.phone) score += 6;
  if (candidate.name && !/review required|candidate name|current location|professional objective|position level/i.test(String(candidate.name))) score += 10;
  if (title && !BAD_DISPLAY_TITLE_PATTERNS.some((rx) => rx.test(String(title)))) score += 8;
  if (candidate.current_company || candidate.company || candidate.__index?.display_company) score += 5;
  if (years >= 3) score += 5;
  if (years >= 8) score += 3;
  if (projects.implementation > 0) score += 4;
  if (projects.rollout > 0) score += 3;
  if (projects.s4 > 0) score += 3;
  if (projects.ams > 0) score += 2;

  if (!candidate.email && !candidate.phone) score -= 12;
  if (candidate.name_review_required || /review required|candidate name|current location|professional objective|position level/i.test(String(candidate.name || ""))) score -= 22;
  if (candidate.title_review_required || BAD_DISPLAY_TITLE_PATTERNS.some((rx) => rx.test(String(title || "")))) score -= 10;
  if (years <= 1) score -= 10;
  else if (years < 4) score -= 6;
  if (projects.implementation <= 0 && projects.rollout <= 0 && projects.s4 <= 0 && projects.ams <= 0) score -= 8;

  return Math.max(45, Math.min(96, Math.round(score)));
}

function moduleMatchBaseScore(moduleMatchType: any) {
  const type = String(moduleMatchType || "").toLowerCase();
  if (type.includes("direct") && type.includes("primary")) return 88;
  if (type.includes("direct")) return 84;
  if (type.includes("strong") || type.includes("ecosystem")) return 78;
  if (type.includes("adjacent") || type.includes("related")) return 68;
  if (type.includes("cross") || type.includes("weak") || type.includes("fallback") || type.includes("mismatch")) return 55;
  return 72;
}

function calibratedSearchFit(input: {
  base: number;
  quality: number;
  years: number;
  implementation: number;
  rollout: number;
  s4: number;
  ams: number;
  moduleMatchType?: string;
  contactable?: boolean;
}) {
  // Recruiter Scoring V3:
  // Search Fit = module alignment + delivery proof + profile confidence.
  // Use diminishing returns so strong profiles separate naturally without flattening to the same score.
  const engineBase = Math.max(0, Math.min(99, Math.round(input.base || 0)));
  const moduleBase = moduleMatchBaseScore(input.moduleMatchType);
  const type = String(input.moduleMatchType || "").toLowerCase();
  const exactPrimary = type.includes("direct") && type.includes("primary");

  const diminishing = (value: number, scale: number, cap: number) => {
    const safe = Math.max(0, value);
    return Math.min(cap, Math.sqrt(safe) * scale);
  };

  const implementationBoost = (count: number) => {
    const v = Math.max(0, count);
    if (v === 0) return -7;
    if (v === 1) return 4;
    if (v === 2) return 6.5;
    if (v === 3) return 8.5;
    if (v === 4) return 10.5;
    return 10.5 + Math.min(2, Math.sqrt(v - 4) * 0.9);
  };

  const s4Boost = (count: number) => {
    const v = Math.max(0, count);
    if (v === 0) return 0;
    if (v === 1) return 2.5;
    if (v === 2) return 4.5;
    if (v === 3) return 5.8;
    return 5.8 + Math.min(1.8, Math.sqrt(v - 3) * 0.7);
  };

  const rolloutBoost = (count: number) => {
    const v = Math.max(0, count);
    if (v === 0) return 0;
    if (v === 1) return 1.8;
    if (v === 2) return 3.2;
    if (v === 3) return 4.2;
    return 4.2 + Math.min(1.2, Math.sqrt(v - 3) * 0.5);
  };

  const amsBoost = (count: number) => {
    const v = Math.max(0, count);
    if (v === 0) return 0;
    if (v === 1) return 0.4;
    if (v === 2) return 0.7;
    return 0.7 + Math.min(0.6, Math.sqrt(v - 2) * 0.2);
  };

  let score = moduleBase;
  score += Math.min(6, Math.max(0, engineBase - moduleBase) * 0.22);
  score += implementationBoost(input.implementation);
  score += s4Boost(input.s4);
  score += rolloutBoost(input.rollout);
  score += amsBoost(input.ams);

  if (input.years >= 18) score += 1.5;
  else if (input.years >= 12) score += 1;
  else if (input.years >= 8) score += 0.5;

  if (input.quality >= 92) score += 2.5;
  else if (input.quality >= 88) score += 1.5;
  else if (input.quality >= 82) score += 1;
  else if (input.quality < 70) score -= 5;
  else if (input.quality < 80) score -= 2.5;

  if (input.contactable) score += 0.75;
  else score -= 2;

  if (input.implementation <= 0 && input.rollout <= 0 && input.s4 <= 0 && input.ams <= 0) score -= 7;

  const meaningfulDelivery = input.implementation >= 3 || input.s4 >= 2 || input.rollout >= 2 || (input.implementation >= 2 && input.s4 >= 1);
  const isExceptionalExactPrimary =
    exactPrimary &&
    input.quality >= 88 &&
    input.contactable !== false &&
    input.years >= 15 &&
    input.implementation >= 3 &&
    meaningfulDelivery;

  if (isExceptionalExactPrimary) return 99;

  if (score >= 98.5) return 99;
  return Math.max(70, Math.min(98, Math.round(score)));
}

function recruiterPriorityScore(input: {
  searchFit: number;
  quality: number;
  years: number;
  implementation: number;
  rollout: number;
  s4: number;
  ams: number;
  contactable?: boolean;
  reviewFirst?: boolean;
}) {
  // Priority is derived from Search Fit, then adjusted for recruiter usefulness.
  let score =
    input.searchFit * 0.58 +
    input.quality * 0.18 +
    Math.min(input.years, 18) * 0.65 +
    Math.min(input.implementation, 8) * 1.8 +
    Math.min(input.s4, 6) * 1.4 +
    Math.min(input.rollout, 5) * 0.9 +
    Math.min(input.ams, 8) * 0.25;

  if (!input.contactable) score -= 4;
  if (input.reviewFirst) score -= 3;
  return Math.max(40, Math.min(99, Math.round(score)));
}

function shouldRecruiterReviewFirst(input: {
  searchFit: number;
  quality: number;
  contactable: boolean;
  moduleMatchType?: string;
  implementation: number;
  rollout: number;
  s4: number;
}) {
  const type = String(input.moduleMatchType || "").toLowerCase();
  const weakModule = ["adjacent", "related", "partial", "weak", "fallback", "cross", "mismatch"].some((token) => type.includes(token));
  if (weakModule) return true;
  if (!input.contactable) return true;
  if (input.quality < 80) return true;
  if (input.searchFit < 86) return true;
  if (input.implementation <= 0 && input.rollout <= 0 && input.s4 <= 0) return true;
  return false;
}

function profileTone(years: number, quality: number, searchFit: number) {
  if (years <= 2) return "Early-career";
  if (years < 5) return "Developing";
  if (years < 8) return "Relevant";
  if (years < 12) return quality >= 82 && searchFit >= 88 ? "Well-aligned" : "Experienced";
  if (years < 18) return quality >= 84 && searchFit >= 90 ? "Senior" : "Experienced senior";
  return "Senior / lead-level";
}

function buildNaturalSearchSummary(input: { title: string; primary: string; years: number; implementation: number; rollout: number; s4: number; ams: number; companies: string[]; quality: number; searchFit: number; consultingLevel?: string }) {
  const module = String(input.primary || "SAP").replace(/^SAP\s+/i, "").toUpperCase();
  const tone = profileTone(input.years, input.quality, input.searchFit);
  const title = cleanDisplayTitle(input.title, module);
  const evidence: string[] = [];
  if (input.implementation) evidence.push(`${input.implementation} implementation`);
  if (input.rollout) evidence.push(`${input.rollout} rollout`);
  if (input.s4) evidence.push(`${input.s4} S/4HANA`);
  if (input.ams && evidence.length < 3) evidence.push(`${input.ams} AMS/support`);

  const company = input.companies.length ? ` Recent background: ${input.companies.slice(0, 2).join(" / ")}.` : "";
  const exp = input.years ? `${input.years} years SAP experience` : "SAP experience to confirm";
  const evidenceText = evidence.length ? ` Evidence: ${evidence.join(" Â· ")}.` : " Project delivery scope to validate.";

  return `${tone} SAP ${module} candidate â€” ${title}. ${exp}.${evidenceText}${company}`;
}

function countryToken(value: any) {
  return normalizedText(value)
    .replace(/[,|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function structuredCountryValues(candidate: AnyRecord) {
  const indexRow = candidate.__index || {};
  return unique([
    indexRow.country,
    candidate.country,
    candidate.current_location,
    candidate.location,
    candidate.display_location,
    indexRow.display_location,
  ])
    .map(countryToken)
    .filter(Boolean);
}

function candidateCountryText(candidate: AnyRecord) {
  // Country filter must use structured location fields only.
  // Do not scan raw CV/search_text here, otherwise "worked in Malaysia" can make
  // a Singapore/Philippines profile pass a Malaysia-only search.
  return structuredCountryValues(candidate).join(" ");
}

function candidateMatchesCountries(candidate: AnyRecord, countries: string[]) {
  if (!countries.length) return true;
  const values = structuredCountryValues(candidate);
  return countries.some((country) => {
    const wanted = countryToken(country);
    return values.some((value) => value === wanted || value.includes(wanted));
  });
}

function candidateMatchesKeywordTerms(candidate: AnyRecord, terms: string[]) {
  if (!terms.length) return true;
  const text = buildCandidateSapText(candidate, candidate.__index);
  return terms.every((term) => text.includes(term.toLowerCase()));
}

function exactModuleRegex(moduleKey: string) {
  const key = canonicalSapKey(moduleKey);
  if (key === "FICO") {
    return /\b(SAP\s*)?(FI\s*\/\s*CO|FI\s*-\s*CO|FICO|Finance\s*(and|&)\s*Controlling)\b/i;
  }
  if (key === "BTP") return /\b(SAP\s*)?(BTP|Business\s+Technology\s+Platform)\b/i;
  if (key === "SUCCESSFACTORS") return /\b(SAP\s*)?(SuccessFactors|SF|HCM|HXM)\b/i;
  if (key === "BW4HANA" || key === "BW/4HANA") return /\b(BW\s*\/\s*4\s*HANA|BW4HANA|BW\/4HANA)\b/i;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[-_\\s\/]*");
  return new RegExp(`\\b(SAP\\s*)?${escaped}\\b`, "i");
}

function sapStrictFamily(moduleKey: string) {
  const key = canonicalSapKey(moduleKey);
  if (["FICO", "FI", "CO", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE_FX", "PSM", "FM"].includes(key)) return "FICO";
  if (["BTP", "CPI", "PI_PO", "FIORI", "UI5", "CAP"].includes(key)) return "BTP";
  if (["ABAP", "WRICEF", "CDS", "AMDP", "RAP"].includes(key)) return "ABAP";
  if (["BASIS"].includes(key)) return "BASIS";
  if (["SECURITY", "GRC"].includes(key)) return "SECURITY";
  if (["HANA"].includes(key)) return "HANA";
  if (["BW", "BW4HANA", "SAC", "DATASPHERE", "BOBJ", "BODS", "PAPM"].includes(key)) return "ANALYTICS";
  if (["SUCCESSFACTORS", "EC", "ECP", "RCM", "RMK", "ONB", "LMS", "PMGM", "COMP", "HCM"].includes(key)) return "HXM";
  if (["MM", "ARIBA", "SRM", "CLM"].includes(key)) return "MM";
  if (["SD", "LE", "GTS", "CS", "VC", "HU"].includes(key)) return "SD";
  if (["PP", "PPDS", "APO", "IBP", "DMC", "ME", "MII"].includes(key)) return "PP";
  if (["PM", "EAM"].includes(key)) return "PM";
  if (["WM", "EWM"].includes(key)) return "EWM";
  if (["TM"].includes(key)) return "TM";
  if (["QM"].includes(key)) return "QM";
  if (["PS"].includes(key)) return "PS";
  if (["PLM"].includes(key)) return "PLM";
  if (["CONCUR"].includes(key)) return "CONCUR";
  if (["FIELDGLASS"].includes(key)) return "FIELDGLASS";
  if (["MDG"].includes(key)) return "MDG";
  if (["CRM", "CX", "COMMERCE", "CPQ"].includes(key)) return "CX";
  if (["BRIM"].includes(key)) return "BRIM";
  if (["FSM"].includes(key)) return "FSM";
  if (["IS_U", "IS_OIL", "IS_RETAIL", "FS_CD", "IS_BANKING", "FICA"].includes(key)) return "INDUSTRY";
  return key;
}

function primaryModuleCanRepresentRequested(primaryModule: string, requestedModule: string, candidate?: AnyRecord, indexRow?: AnyRecord) {
  return primarySapModuleCanSatisfySearch(primaryModule, requestedModule, candidate, indexRow);
}

function candidateHasDirectModuleEvidence(candidate: AnyRecord, requestedModules: string[]) {
  const required = unique(requestedModules.map((m) => canonicalSapKey(String(m))).filter((m) => m && !["ALL", "ANY", "UNKNOWN"].includes(String(m))));
  if (!required.length) return true;

  const indexRow = candidate.__index || {};
  const primary = derivePrimarySapModule(candidate, indexRow);

  // HARD GATE: selected / inferred SAP module must be represented by the candidate's PRIMARY module family.
  // Secondary chips are used only as supporting evidence, never to let an unrelated primary profile pass.
  const primaryMatchesAtLeastOneRequested = required.every((moduleKey) => primaryModuleCanRepresentRequested(primary, moduleKey, candidate, indexRow));
  if (!primaryMatchesAtLeastOneRequested) return false;

  const explicitModules = unique([
    candidate.primary_module,
    indexRow.primary_module,
    ...arrayFrom(candidate.secondary_modules),
    ...arrayFrom(candidate.sap_modules),
    ...arrayFrom(candidate.sap_submodules),
    ...arrayFrom(indexRow.all_modules),
    ...arrayFrom(indexRow.all_submodules),
  ].map(canonicalSapKey));

  const haystack = buildCandidateSapText(candidate, indexRow);

  // Every selected module/submodule must still have direct evidence.
  // Example: SAP PP + SAP QM needs a PP/QM primary-family profile AND both PP and QM evidence.
  return required.every((moduleKey) => {
    if (primaryModuleCanRepresentRequested(primary, moduleKey, candidate, indexRow)) return true;
    if (explicitModules.includes(moduleKey) && exactModuleRegex(moduleKey).test(haystack)) return true;
    return false;
  });
}

function inferredCountry(candidate: AnyRecord, countries: string[]) {
  const indexRow = candidate.__index || {};
  const values = structuredCountryValues(candidate);
  const matched = countries.find((country) => {
    const wanted = countryToken(country);
    return values.some((value) => value === wanted || value.includes(wanted));
  });
  if (matched) return matched;
  return indexRow.country || candidate.country || candidate.current_location || candidate.location || "";
}

function candidateYears(candidate: AnyRecord) {
  return n(candidate.years ?? candidate.__index?.years ?? candidate.years_experience ?? candidate.calculated_experience_months / 12, 0);
}

function candidateQuality(candidate: AnyRecord) {
  return n(
    candidate.profile_quality_score ?? candidate.quality_score ?? candidate.__index?.quality_score ?? (candidate.name_review_required ? 60 : 85),
    candidate.name_review_required ? 60 : 85,
  );
}

function projectCount(candidate: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = n(candidate[key], 0);
    if (value > 0) return value;
  }
  return 0;
}

function resolveProjectCounts(candidate: AnyRecord) {
  const indexRow = candidate.__index || {};

  const implementation = projectCount(
    candidate,
    "implementation_project_count",
    "implementation_projects",
    "implementation_count",
  );

  const rollout = projectCount(
    candidate,
    "rollout_project_count",
    "rollout_count",
    "rollout_projects",
    "rolloutProjects",
  );

  const ams = projectCount(
    candidate,
    "ams_support_project_count",
    "ams_project_count",
    "ams_count",
    "ams_projects",
    "amsProjects",
  );

  const s4 = projectCount(
    candidate,
    "s4hana_project_count",
    "s4_implementation_count",
    "s4_count",
    "s4hana_projects",
    "s4_implementation_projects",
    "s4hanaProjects",
  );

  const s4Ams = projectCount(
    candidate,
    "s4_support_count",
    "s4_ams_count",
    "s4_ams_projects",
    "s4AmsProjects",
  );

  const greenfield = projectCount(
    candidate,
    "s4_greenfield_count",
    "greenfield_count",
    "greenfield_projects",
    "greenfieldProjects",
  );

  const brownfield = projectCount(
    candidate,
    "s4_conversion_count",
    "brownfield_count",
    "brownfield_projects",
    "brownfieldProjects",
  );

  return {
    implementation,
    rollout,
    ams,
    s4,
    s4Ams,
    greenfield,
    brownfield,
    selective: projectCount(
      candidate,
      "selective_transformation_projects",
      "selective_count",
      "selectiveTransformationProjects",
    ),
    // Keep exact project counters only. Do not copy generic implementation/AMS
    // into Greenfield or S/4 AMS, because that makes the UI show false evidence.
    source: indexRow.candidate_id ? "candidate_search_index + candidates" : "candidates",
  };
}

function normalizeCandidateForSearch(args: {
  candidate: AnyRecord;
  score: number;
  why: string[];
  tokens: string[];
  moduleMatchType: string;
  requestedModules: string[];
  countries: string[];
  debug?: { enabled: boolean; candidateName: string; rawScore: number; scoreDetails?: any; searchContext?: string };
}) {
  const { candidate, score, why, tokens, moduleMatchType, requestedModules, countries, debug } = args;
  const indexRow = candidate.__index || {};

  // Recruiter-production display source of truth:
  // UI badges must come from candidate_search_index only.
  // Do NOT use raw CV / candidateModuleSignals here, because raw text can add incidental modules
  // such as CO, SD, PP, MM, or COPA and make the card look like a wrong-module match.
  const primary = String(indexRow.primary_module || candidate.primary_module || "").trim().toUpperCase();
  const indexModules = unique([
    primary,
    ...arrayFrom(indexRow.all_modules),
  ])
    .map((module) => canonicalSapKey(module))
    .filter((module) => module && !["UNKNOWN", "ALL", "ANY", "SAP_GENERAL", "GENERAL_SAP", "SAP"].includes(module));

  const displayModules = unique([
    primary,
    ...indexModules.filter((module) => module !== primary),
  ]).slice(0, 8);

  const projects = resolveProjectCounts(candidate);
  const s4Impl = projects.s4;
  const s4Ams = projects.s4Ams;
  const implementation = projects.implementation;
  const rollout = projects.rollout;
  const greenfield = projects.greenfield;
  const brownfield = projects.brownfield;
  const ams = projects.ams;
  const years = candidateYears(candidate);
  const cleanTitle = cleanDisplayTitle(candidate.current_title || candidate.title || candidate.headline || indexRow.display_title, primary);
  const quality = calibratedProfileQuality(candidate, years, cleanTitle);
  const contactable = Boolean(candidate.contactable || indexRow.contactable || candidate.email || candidate.phone);
  const scoreDetails = debug?.scoreDetails || {};
  const moduleScore = Number(scoreDetails.moduleScore ?? 0);
  const keywordBoost = Number(scoreDetails.keywordBoost ?? 0);
  const projectBoost = Number(scoreDetails.projectBoost ?? 0);
  const implementationCount = Number(scoreDetails.implementationCount ?? implementation ?? 0);
  const s4Count = Number(scoreDetails.s4Count ?? s4Impl ?? 0);
  const greenfieldCount = Number(scoreDetails.greenfieldCount ?? greenfield ?? 0);
  const brownfieldCount = Number(scoreDetails.brownfieldCount ?? brownfield ?? 0);
  const rolloutCount = Number(scoreDetails.rolloutCount ?? rollout ?? 0);
  const amsCount = Number(scoreDetails.amsCount ?? ams ?? 0);
  const engineBase = Math.max(0, Math.min(99, Math.round(score || 0)));
  const moduleBase = moduleMatchBaseScore(moduleMatchType);
  const type = String(moduleMatchType || "").toLowerCase();
  const exactPrimary = type.includes("direct") && type.includes("primary");
  const priorityBonus = Math.min(6, Math.max(0, engineBase - moduleBase) * 0.22);
  const moduleBonus = moduleBase;
  const directPrimaryBonus = exactPrimary && quality >= 88 && contactable !== false && years >= 15 && implementation >= 3 ? 0.75 : 0;
  const consultingBonus = 0;
  const yearsBonus = years >= 18 ? 1.5 : years >= 12 ? 1 : years >= 8 ? 0.5 : 0;
  const qualityBonus = quality >= 92 ? 2.5 : quality >= 88 ? 1.5 : quality >= 82 ? 1 : quality < 70 ? -5 : quality < 80 ? -2.5 : 0;
  const cityBonus = Number(scoreDetails.cityBonus ?? 0);
  const countryBonus = Number(scoreDetails.countryBonus ?? 0);
  const scoreBeforeCalibratedSearchFit = score;

  if (debug?.enabled) {
    console.log("BTP_SCORE_DEBUG", {
      candidateName: debug.candidateName,
      rawScore: debug.rawScore,
      moduleScore,
      projectBoost,
      keywordBoost,
      yearsBonus,
      cityBonus,
      countryBonus,
      scoreBeforeCalibration: scoreBeforeCalibratedSearchFit,
    });
  }

  const adjustedSearchFit = calibratedSearchFit({
    base: score,
    quality,
    years,
    implementation,
    rollout,
    s4: s4Impl,
    ams,
    moduleMatchType,
    contactable,
  });

  if (debug?.enabled) {
    console.log("BTP_SCORE_DEBUG", {
      candidateName: debug.candidateName,
      scoreAfterCalibration: adjustedSearchFit,
    });
  }
  const reviewFirst = shouldRecruiterReviewFirst({
    searchFit: adjustedSearchFit,
    quality,
    contactable,
    moduleMatchType,
    implementation,
    rollout,
    s4: s4Impl,
  });
  const priorityScore = recruiterPriorityScore({
    searchFit: adjustedSearchFit,
    quality,
    years,
    implementation,
    rollout,
    s4: s4Impl,
    ams,
    contactable,
    reviewFirst,
  });
  const companies = unique([candidate.current_company, candidate.company, ...(arrayFrom(indexRow.consulting_firms))]).filter(Boolean);
  const naturalSummary = buildNaturalSearchSummary({ title: cleanTitle, primary, years, implementation, rollout, s4: s4Impl, ams, companies, quality, searchFit: adjustedSearchFit, consultingLevel: candidate.consulting_level });
  const canonicalProfile = buildCanonicalCandidateProfile(candidate);
  const parserQuality = evaluateResumeQualityGate({ ...candidate, name: canonicalProfile.displayName, currentCompany: canonicalProfile.currentCompany });

  return {
    ...candidate,
    id: candidate.id,
    candidate_id: candidate.id,
    title: cleanTitle,
    display_title: cleanTitle,
    primary_module: primary || candidate.primary_module || "SAP",
    secondary_modules: displayModules.filter((module) => module !== primary),
    submodules: unique([...arrayFrom(candidate.sap_submodules), ...tokens]).slice(0, 8),
    selected_modules: displayModules,
    search_context_module: requestedModules.length ? sapDisplayLabel(requestedModules[0]).replace(/^SAP\s+/i, "") : "",
    role_type: candidate.role_type || sapRoleTypeForModules(displayModules),
    seniority_level: candidate.consulting_level || candidate.role_type || "",
    country: inferredCountry(candidate, countries),
    display_location: candidate.location || candidate.current_location || inferredCountry(candidate, countries),
    display_company: canonicalProfile.currentCompany !== "Not disclosed" ? canonicalProfile.currentCompany : candidate.current_company || candidate.company || "",
    current_company: canonicalProfile.currentCompany,
    company_type: canonicalProfile.companyType,
    background_experience: canonicalProfile.backgroundExperience,
    years,
    years_experience: years,
    email_masked: maskEmail(candidate.email) || indexRow.email_masked,
    phone_masked: maskPhone(candidate.phone) || indexRow.phone_masked,
    contactable,
    review_first: reviewFirst,
    recruiter_review_first: reviewFirst,
    searchFit: adjustedSearchFit,
    search_fit: adjustedSearchFit,
    search_score: adjustedSearchFit,
    module_match_type: moduleMatchType,
    why_matched: why,
    matched_tokens: tokens,
    profile_quality_score: Math.min(quality, parserQuality.parserQualityScore),
    parser_quality_score: parserQuality.parserQualityScore,
    parser_quality: parserQuality,
    review_needed: parserQuality.needsManualReview,
    excluded_from_client_view: !parserQuality.allowedForExecutiveExport,
    display_quality_score: quality,
    recruiter_priority_score: priorityScore,
    rank_score: priorityScore,
    recommendation_summary: naturalSummary,
    summary: naturalSummary,
    quality_grade: quality >= 88 ? "A" : quality >= 78 ? "B" : quality >= 68 ? "C" : "Review Needed",
    implementation_projects: implementation,
    ams_projects: ams,
    // Current UI card reads these fields. Exact counts only.
    greenfield_projects: greenfield,
    rollout_projects: rollout,
    brownfield_projects: brownfield,
    selective_transformation_projects: projects.selective,
    s4hana_projects: s4Impl,
    s4_implementation_projects: s4Impl,
    s4_ams_projects: s4Ams,
    project_counts: {
      implementation,
      ams,
      greenfield,
      rollout,
      brownfield,
      selective: projects.selective,
      s4hana: s4Impl,
      s4Ams,
    },
    project_extraction_confidence: "Candidate table + candidate_search_index canonical fallback",
    project_extraction_source: projects.source,
    visa_status: candidate.status || "New",
  };
}

function buildSupabaseCountryOr(countries: string[]) {
  const clauses: string[] = [];
  for (const country of countries) {
    const value = ilikeValue(country);
    clauses.push(`country.ilike.${value}`);
    clauses.push(`display_location.ilike.${value}`);
  }
  return clauses.join(",");
}

async function fetchIndexRows(args: {
  countries: string[];
  contactableOnly: boolean;
  minYears: number;
  minQuality: number;
  limit: number;
}) {
  const { countries, contactableOnly, minYears, minQuality, limit } = args;
  const fetchLimit = Math.max(Math.min(limit * 3, 3000), 1000);

  let query = supabase
    .from("candidate_search_index")
    .select(SEARCH_INDEX_FIELDS)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  if (countries.length) query = query.or(buildSupabaseCountryOr(countries));
  if (minYears > 0) query = query.gte("years", minYears);
  if (minQuality > 0) query = query.gte("quality_score", minQuality);

  // Search-index gate: remove rows that cannot be recruiter-ready by module.
  query = query.not("primary_module", "is", null).neq("primary_module", "UNKNOWN").neq("primary_module", "GENERAL_SAP");

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchCandidateDetailsByIds(ids: string[]) {
  const out: AnyRecord[] = [];
  const uniqueIds = unique(ids).filter(Boolean);
  for (const part of chunk(uniqueIds, 200)) {
    const { data, error } = await supabase
      .from("candidates")
      .select(CANDIDATE_LIGHT_FIELDS)
      .in("id", part);
    if (error) throw error;
    out.push(...(data || []));
  }
  return new Map(out.map((row) => [String(row.id), row]));
}

async function fetchCandidates(args: {
  countries: string[];
  contactableOnly: boolean;
  minYears: number;
  minQuality: number;
  limit: number;
}) {
  const indexRows = await fetchIndexRows(args);
  const details = await fetchCandidateDetailsByIds(indexRows.map((row: AnyRecord) => row.candidate_id));
  return indexRows.map((row: AnyRecord) => mergeIndexCandidate(row, details.get(String(row.candidate_id))));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const rawKeyword = firstParam(url, ["keyword", "q", "search"], "");
    const rawModules = listParams(url, ["module", "modules", "sapSkill", "sapSkills"]);
    const rawProjects = listParams(url, ["projectType", "projectTypes"]);
    const countries = unique([
      ...listParams(url, ["country", "countries", "location"]),
    ]).filter((value) => !["all", "any"].includes(value.toLowerCase()));
    const city = firstParam(url, ["city"], "");
    const minYears = n(firstParam(url, ["minYears", "years"], "0"), 0);
    const minQuality = n(firstParam(url, ["minQuality"], "0"), 0);
    const contactableOnly = toBool(firstParam(url, ["contactableOnly", "contactOnly"], "false"));
    const showReview = toBool(firstParam(url, ["showReview"], "false"));
    const limit = Math.min(n(firstParam(url, ["limit"], "1000"), 1000), 2000);

    const intent = buildSapSearchIntent({
      rawKeyword,
      explicitModules: rawModules,
      explicitProjectTypes: rawProjects,
    });

    const sourceRows = await fetchCandidates({ countries, contactableOnly, minYears, minQuality: showReview ? 0 : minQuality, limit });
    const visibleRows = sourceRows.filter((candidate: AnyRecord) => !shouldHideCandidateFromRecruiterSearch(candidate, showReview));

    let btpDebugCount = 0;
  const isBtpRequested = intent.requiredModules.some((module) => canonicalSapKey(module) === "BTP");

  const results = visibleRows
      .filter((candidate: AnyRecord) => candidateMatchesCountries(candidate, countries))
      .filter((candidate: AnyRecord) => {
        const years = candidateYears(candidate);
        if (minYears > 0 && years < minYears) return false;
        const quality = candidateQuality(candidate);
        if (!showReview && quality < minQuality) return false;
        if (!candidateMatchesKeywordTerms(candidate, intent.keywordTerms)) return false;
        if (!candidateHasDirectModuleEvidence(candidate, intent.requiredModules)) return false;
        return true;
      })
      .map((candidate: AnyRecord) => {
        const scored = scoreSapSearchCandidate({
          candidate,
          indexRow: candidate.__index,
          intent,
          country: countries[0] || "",
          city,
          minYears,
        });
        return { candidate, scored };
      })
      .filter(({ scored }) => scored.ok)
      .map(({ candidate, scored }) => {
        const shouldDebug = isBtpRequested && btpDebugCount < 8;
        if (shouldDebug) btpDebugCount += 1;
        return normalizeCandidateForSearch({
          candidate,
          score: scored.score,
          why: scored.why,
          tokens: scored.tokens,
          moduleMatchType: scored.moduleMatchType,
          requestedModules: intent.requiredModules,
          countries,
          debug: shouldDebug ? {
            enabled: true,
            candidateName: buildCanonicalCandidateProfile(candidate).displayName || "Candidate profile pending validation",
            rawScore: scored.score,
            scoreDetails: scored.details?.debug,
            searchContext: intent.requiredModules[0] || "",
          } : undefined,
        });
      })
      .sort((a: AnyRecord, b: AnyRecord) =>
        n(b.recruiter_priority_score) - n(a.recruiter_priority_score) ||
        n(b.search_fit) - n(a.search_fit) ||
        n(b.profile_quality_score) - n(a.profile_quality_score) ||
        n(b.implementation_projects) - n(a.implementation_projects) ||
        n(b.s4hana_projects) - n(a.s4hana_projects) ||
        n(b.years) - n(a.years)
      )
      .map((candidate: AnyRecord, index: number) => ({
        ...candidate,
        result_rank: index + 1,
        rank_label:
          n(candidate.search_fit) >= 95 && !candidate.review_first && index === 0
            ? "#1 Best Match"
            : n(candidate.search_fit) >= 90 && !candidate.review_first
              ? `Top ${index + 1} Match`
              : n(candidate.search_fit) >= 84
                ? "Recommended"
                : "Module Review",
        rank_tier:
          n(candidate.search_fit) >= 95 && !candidate.review_first
            ? "BEST_MATCH"
            : n(candidate.search_fit) >= 90 && !candidate.review_first
              ? "TOP_MATCH"
              : n(candidate.search_fit) >= 84
                ? "STRONG_POOL"
                : "REVIEW_POOL",
      }))
      .slice(0, limit);

    const stats = {
      contactable: results.filter((candidate: AnyRecord) => candidate.contactable).length,
      highQuality: results.filter((candidate: AnyRecord) => n(candidate.profile_quality_score) >= 85 && !candidate.review_needed).length,
      reviewNeeded: results.filter((candidate: AnyRecord) => candidate.review_needed || n(candidate.profile_quality_score) < 75).length,
      excludedFromClientView: results.filter((candidate: AnyRecord) => candidate.excluded_from_client_view).length,
      clientExportEligible: results.filter((candidate: AnyRecord) => !candidate.excluded_from_client_view && candidate.contactable).length,
    };

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      data: results,
      stats,
      debug: {
        source: "canonical_sap_module_engine_v70_recruiter_scoring_v3",
        rawKeyword,
        cleanedKeyword: intent.cleanedKeyword,
        explicitModules: intent.explicitModules,
        inferredModules: intent.inferredModules,
        requiredModules: intent.requiredModules,
        projectIntents: intent.projectIntents,
        keywordTerms: intent.keywordTerms,
        countries,
        cityMode: city ? "soft_boost_only" : "none",
        sourceRows: sourceRows.length,
        visibleRows: visibleRows.length,
        hiddenRows: sourceRows.length - visibleRows.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Search candidates failed",
        debug: {
          source: "canonical_sap_module_engine_v70_recruiter_scoring_v3",
          hint: "If this is a Supabase select error, check CANDIDATE_LIGHT_FIELDS against your candidates table columns.",
        },
      },
      { status: 500 },
    );
  }
}










