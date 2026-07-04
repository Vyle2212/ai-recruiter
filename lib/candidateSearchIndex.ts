import { supabase } from "@/lib/supabase";
import { textOf } from "@/lib/sapRecruiterRules";
import { canonicalSapKey, parseSapModulesFromKeyword } from "@/lib/sapCanonicalModuleEngine";

type AnyRecord = Record<string, any>;

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function s(value: any) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function arr(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).map(s).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).map(s).filter(Boolean);
    } catch {}
    return value
      .split(/[,\n;|]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function unique(values: any[]) {
  return Array.from(new Set(values.map((v) => s(v)).filter(Boolean)));
}


const INVALID_INDEX_MODULES = new Set(["", "UNKNOWN", "ALL", "ANY", "SAP_GENERAL", "GENERAL_SAP", "SAP"]);

function normalizeIndexModule(value: any): string {
  const raw = s(value).toUpperCase();
  if (/\b(CO\s*[-/]?\s*PA|COPA)\b/.test(raw)) return "COPA";

  const module = canonicalSapKey(value);
  return module && !INVALID_INDEX_MODULES.has(module) ? module : "";
}

function normalizeIndexModules(values: any[]): string[] {
  return unique(
    values
      .map((value) => normalizeIndexModule(value))
      .filter(Boolean)
  );
}


function isIndexModuleAllowedForPrimary(primary: string, module: string): boolean {
  const p = normalizeIndexModule(primary);
  const m = normalizeIndexModule(module);
  if (!p || !m) return false;
  if (m === p) return true;

  const allowedByPrimary: Record<string, Set<string>> = {
    // BTP badges should be direct BTP ecosystem skills only.
    // Keep ABAP/HANA as ranking evidence elsewhere, not as visible Talent Pool chips.
    BTP: new Set(["CPI", "FIORI", "UI5", "CAP", "RAP", "BAS", "BUILD", "KYMA", "INTEGRATION_SUITE"]),
    SUCCESSFACTORS: new Set(["EC", "ECP", "RCM", "ONB", "LMS", "PMGM", "COMPENSATION", "HCM"]),
    FICO: new Set(["FI", "CO", "GL", "AP", "AR", "AA", "COPA", "CFIN", "FSCM", "TRM", "BCM", "GR", "BPC", "RAR", "RE_FX", "PSM", "FM"]),
    BW: new Set(["BI", "BW4HANA", "SAC", "DATASPHERE", "BPC", "BOBJ", "HANA"]),
    BASIS: new Set(["SECURITY", "GRC", "HANA", "SOLMAN", "NETWEAVER"]),
    ABAP: new Set(["FIORI", "UI5", "CDS", "AMDP", "ODATA", "BAPI", "BADI", "IDOC", "FORMS", "ABAP"]),
    MM: new Set(["WM", "EWM", "ARIBA", "P2P", "SRM", "VIM"]),
    SD: new Set(["OTC", "O2C", "LE", "TM", "CRM", "C4C"]),
    PP: new Set(["QM", "PM", "PPDS", "APO"]),
    PM: new Set(["EAM", "CS", "PS"]),
    PS: new Set(["PM", "CO", "CPM"]),
    EWM: new Set(["WM", "TM", "YARD"]),
    TM: new Set(["EWM", "LE"]),
  };

  return Boolean(allowedByPrimary[p]?.has(m));
}

function filterIndexModulesForPrimary(primary: string, values: any[]): string[] {
  return normalizeIndexModules(values).filter((module) => isIndexModuleAllowedForPrimary(primary, module));
}

function hasContact(candidate: AnyRecord) {
  return Boolean(s(candidate.email) || s(candidate.phone));
}

function maskEmail(email: any) {
  const e = s(email);
  const [name, domain] = e.split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: any) {
  const value = s(phone);
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${value.slice(0, 3)} ***** ${digits.slice(-3)}`;
}

function countryOf(candidate: AnyRecord) {
  return s(candidate.country || candidate.current_location || candidate.location);
}

function cityOf(candidate: AnyRecord) {
  return s(candidate.city || candidate.current_city);
}

function yearsOf(candidate: AnyRecord) {
  const direct = n(candidate.years ?? candidate.years_experience ?? candidate.total_years, 0);
  if (direct > 0) return direct;

  const months = n(candidate.calculated_experience_months, 0);
  if (months > 0) return Math.round((months / 12) * 10) / 10;

  return 0;
}

function cleanTitle(value: any): string {
  let title = s(value);
  if (!title) return "";

  title = title
    .replace(/^Career\s*history\s*/i, "")
    .replace(/^Employment\s*history\s*/i, "")
    .replace(/^Professional\s*experience\s*/i, "")
    .replace(/^Work\s*experience\s*/i, "")
    .replace(/^Current\s*Position\s*[:\-]?\s*/i, "")
    .replace(/^Position\s*[:\-]?\s*/i, "")
    .replace(/^Title\s*[:\-]?\s*/i, "")
    .replace(/\s+Jan\s+\d{4}\s*[-–]\s*Present.*$/i, "")
    .replace(/\s+\d{4}\s*[-–]\s*(Present|\d{4}).*$/i, "")
    .replace(/\s+Education.*$/i, "")
    .replace(/\s+Bachelor.*$/i, "")
    .replace(/\s+Master.*$/i, "")
    .trim();

  const bad = [
    "career history",
    "employment history",
    "professional experience",
    "personal particulars",
    "profile summary",
    "career objective",
    "education",
    "hobbies",
    "references",
    "review required",
    "profile under review",
    "candidate information",
    "position title",
    "current position title",
    "tools platforms",
    "projects as reference",
    "head management",
    "core expertise",
  ];

  if (bad.some((x) => title.toLowerCase() === x || title.toLowerCase().startsWith(`${x} `))) return "";
  if (title.length > 180) title = title.slice(0, 180).trim();

  return title;
}

function cleanName(value: any): string | null {
  const name = s(value);
  if (!name) return null;

  const bad = [
    "review required",
    "profile under review",
    "personal particulars",
    "personal particular",
    "personal information",
    "candidate information",
    "job title name",
    "candidate name",
    "career history",
    "employment history",
    "robot framework",
    "hobbies",
    "procedures",
    "test scripts",
    "and need for resources",
    "head management",
    "core expertise",
    "from date",
    "to date",
    "and quality",
    "projects as reference",
    "about me",
    "position title",
    "current position title",
    "tools platforms",
    "green channel travel services",
    "mother name",
    "father name",
    "job description thailand managing director",
    "and driving overall operational improvements",
    "configuring delta ods info cubes",
    "briefcase duration",
    "dxc technology",
    "construction occupational safety",
    "enterprise accounts segments",
    "non-disclosure agreement",
    "agency non-disclosure agreement",
    "job description",
    "tdi apj",
    "public unrestricted access",
    "public - unrestricted access",
    "academic qualifications",
    "academic qualification",
    "powershell scripting",
    "best practices",
  ];

  const lower = name.toLowerCase();
  if (bad.some((x) => lower.includes(x))) return null;
  if (/@|https?:|www\.|\+?\d[\d\s().-]{5,}\d/.test(name)) return null;
  if (name.length < 4 || name.length > 80) return null;

  if (/\b(TRAVEL\s+SERVICES|GREEN\s+CHANNEL|INTERNALLY\s+AND\s+EXTERNALLY|YEAR\s+LEVEL\s+INSTITUTION|EACH\s+TYPE|AND\s+GAS\s+PROJECTS|PT\.??\s+EMERIO|KONE\s+INDUSTRY|TAMAN\s+AMPANG|PROFESSIONAL\s+CERTIFICATION|EDUCATIONAL\s+ATTAINMENT|CAREER\s+SNAPSHOT|BEST\s+PRACTICES|POWERSHELL\s+SCRIPTING|ACADEMIC\s+QUALIFICATIONS?|PUBLIC\s*-?\s*UNRESTRICTED\s+ACCESS|TDI\s+APJ|JOB\s+DESCRIPTION|NON[-\s]?DISCLOSURE\s+AGREEMENT|ENTERPRISE\s+ACCOUNTS\s+SEGMENTS|FATHER\s+NAME|MOTHER\s+NAME|BRIEFCASE\s+DURATION|CONSTRUCTION\s+OCCUPATIONAL|CONFIGURING\s+DELTA|INFO\s+CUBES|AND\s+DRIVING\s+OVERALL\s+OPERATIONAL)\b/i.test(name)) {
    return null;
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return null;

  // Reject title/section-like extracted names.
  if (/\b(manager|consultant|developer|architect|analyst|specialist|project|program|position|title|role|summary|profile|career|professional|technical|functional|implementation|support|rollout|migration)\b/i.test(name)) {
    return null;
  }

  return name;
}
function hasTextSignal(candidate: AnyRecord, pattern: RegExp) {
  const haystack = textOf(
    candidate.title,
    candidate.current_title,
    candidate.headline,
    candidate.summary,
    candidate.experience,
    candidate.raw_text,
    candidate.resume_text,
    candidate.raw_cv,
    candidate.project_types,
  ).toLowerCase();
  return pattern.test(haystack);
}

function projectMetric(candidate: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = n(candidate?.[key], 0);
    if (value > 0) return value;
  }
  return 0;
}

function hasSapSignal(candidate: AnyRecord) {
  return hasTextSignal(
    candidate,
    /\b(SAP|S\/4HANA|S4HANA|ABAP|FICO|FI\/CO|BASIS|SUCCESSFACTORS|BTP|BW|MM|SD|PP|PM|QM|EWM|TM|ARIBA|CONCUR|MDG|GRC|HANA)\b/i
  );
}

function deriveSearchPrimary(candidate: AnyRecord): string | null {
  // Recruiter-production source of truth:
  // candidate_search_index must NEVER re-classify from title/raw_text.
  // It must only index candidates.primary_module already produced by parser/saveCandidate.
  return normalizeIndexModule(candidate.primary_module) || null;
}

function qualityScore(candidate: AnyRecord, displayName: string | null, displayTitle: string, primary: string | null) {
  const greenfieldCount = projectMetric(candidate, "s4_greenfield_count", "greenfield_projects", "greenfield_count");
  const brownfieldCount = projectMetric(candidate, "s4_conversion_count", "brownfield_projects", "brownfield_count");
  const rolloutCount = projectMetric(candidate, "rollout_project_count", "rollout_projects", "rollout_count");
  const implementationCount = projectMetric(candidate, "implementation_project_count", "implementation_projects", "implementation_count");
  const amsCount = projectMetric(candidate, "ams_support_project_count", "ams_project_count", "ams_count", "support_projects");
  const s4Count = projectMetric(candidate, "s4hana_project_count", "s4_count", "s4_implementation_count", "s4ImplementationProjects");

  let score = 45;
  if (primary) score += 14;
  if (displayName) score += 12;
  if (displayTitle) score += 8;
  if (hasContact(candidate)) score += 10;

  const years = yearsOf(candidate);
  if (years >= 3) score += 4;
  if (years >= 7) score += 4;
  if (years >= 12) score += 3;
  if (years >= 18) score += 2;

  if (implementationCount > 0) score += 4;
  if (rolloutCount > 0) score += 2;
  if (amsCount > 0) score += 2;
  if (s4Count > 0) score += 3;
  if (greenfieldCount > 0 || brownfieldCount > 0) score += 2;

  if (!displayName) score -= 20;
  if (!displayTitle) score -= 8;
  if (!hasContact(candidate)) score -= 10;

  return Math.max(35, Math.min(96, Math.round(score)));
}


function isHiddenCandidateStatus(candidate: AnyRecord) {
  const status = s(candidate.status).toUpperCase();
  return ["REJECTED_NOISE", "DELETED", "NON_SAP"].includes(status);
}

function isNeedsReviewWithoutTrustedIdentity(candidate: AnyRecord, displayName: string | null, primary: string | null) {
  const status = s(candidate.status).toUpperCase();
  if (status !== "NEEDS_REVIEW") return false;

  // Review rows with no reliable name or no trusted module should not enter recruiter search index.
  if (!displayName) return true;
  if (!primary || ["UNKNOWN", "SAP_GENERAL", "GENERAL_SAP", "SAP"].includes(primary)) return true;

  return false;
}

function isIndexEligibleCandidate(candidate: AnyRecord, displayName: string | null, primary: string | null, displayTitle: string) {
  if (!candidate?.id) return false;
  if (isHiddenCandidateStatus(candidate)) return false;
  if (!displayName) return false;
  if (!primary || ["UNKNOWN", "SAP_GENERAL", "GENERAL_SAP", "SAP"].includes(primary)) return false;
  if (isNeedsReviewWithoutTrustedIdentity(candidate, displayName, primary)) return false;

  // Do not index placeholder names even if a module was inferred elsewhere.
  if (/^profile\s+under\s+review$/i.test(displayName)) return false;

  // Generic title + weak contact/name should remain outside recruiter search index.
  if (/^(manager|senior manager|consultant|senior consultant|business consultant|project manager|it project manager)$/i.test(displayTitle || "") && !hasContact(candidate)) {
    return false;
  }

  return true;
}

export function buildCandidateSearchIndexRow(candidate: AnyRecord) {
  const primary = deriveSearchPrimary(candidate);
  if (!primary) return null;

  const secondary = filterIndexModulesForPrimary(primary, arr(candidate.secondary_modules || candidate.secondaryModules));
  const skills = filterIndexModulesForPrimary(primary, arr(candidate.skills || candidate.sap_skills));
  const submodules = filterIndexModulesForPrimary(primary, [
    ...arr(candidate.sap_submodules),
    ...arr(candidate.submodules),
  ]);

  const allModules = filterIndexModulesForPrimary(primary, [
    primary,
    ...secondary.filter((module) => module !== primary),
    ...skills.filter((module) => module !== primary),
    ...submodules.filter((module) => module !== primary),
  ]);

  const greenfieldCount = projectMetric(candidate, "s4_greenfield_count", "greenfield_projects", "greenfield_count");
  const brownfieldCount = projectMetric(candidate, "s4_conversion_count", "brownfield_projects", "brownfield_count");
  const rolloutCount = projectMetric(candidate, "rollout_project_count", "rollout_projects", "rollout_count");
  const implementationCount = projectMetric(candidate, "implementation_project_count", "implementation_projects", "implementation_count");
  const amsCount = projectMetric(candidate, "ams_support_project_count", "ams_project_count", "ams_count", "support_projects");
  const s4Count = projectMetric(candidate, "s4hana_project_count", "s4_count", "s4_implementation_count", "s4ImplementationProjects");
  const s4AmsCount = projectMetric(candidate, "s4_support_count", "s4_ams_projects", "s4_ams_count", "s4AmsProjects", "ams_support_project_count", "ams_count");
  const migrationCount = projectMetric(candidate, "migration_project_count", "migration_count");
  const transformationCount = projectMetric(candidate, "transformation_project_count");

  const projectTypes: string[] = [];
  if (greenfieldCount > 0 || hasTextSignal(candidate, /\bgreen[-\s]?field\b/i)) projectTypes.push("GREENFIELD");
  if (brownfieldCount > 0 || hasTextSignal(candidate, /\bbrown[-\s]?field\b|\bconversion\b/i)) projectTypes.push("BROWNFIELD");
  if (rolloutCount > 0 || hasTextSignal(candidate, /\broll[-\s]?out\b|\brollout\b/i)) projectTypes.push("ROLLOUT");
  if (implementationCount > 0 || hasTextSignal(candidate, /\bimplementation\b|\bimplemented\b|\bfull[-\s]?cycle\b|\bend[-\s]?to[-\s]?end\b/i)) projectTypes.push("IMPLEMENTATION");
  if (amsCount > 0 || hasTextSignal(candidate, /\bams\b|application maintenance|application management|production support|l[23]\s+support|hypercare/i)) projectTypes.push("AMS");
  if (s4Count > 0 || hasTextSignal(candidate, /s\/?4\s?hana|s4hana|s\/4hana/i)) projectTypes.push("S4");
  if (s4AmsCount > 0) projectTypes.push("S4_AMS");
  if (migrationCount > 0 || hasTextSignal(candidate, /\bmigration\b|\bmigrate\b/i)) projectTypes.push("MIGRATION");
  if (transformationCount > 0 || hasTextSignal(candidate, /\btransformation\b|\bmoderni[sz]ation\b/i)) projectTypes.push("TRANSFORMATION");

  const sourceUpdatedAt =
    candidate.updated_at ||
    candidate.latest_cv_uploaded_at ||
    candidate.modified_at ||
    candidate.created_at ||
    new Date().toISOString();

  const title = cleanTitle(candidate.current_title || candidate.title || candidate.headline || "");
  const company = s(candidate.current_company || candidate.company || "");
  const displayName = cleanName(candidate.name);

  if (!isIndexEligibleCandidate(candidate, displayName, primary, title)) return null;

  // Metadata-only search text.
  // Do NOT include raw_text/resume_text/raw_cv here; raw CV text causes semantic search to pull wrong modules.
  const searchText = textOf(
    displayName,
    title,
    company,
    candidate.location,
    candidate.current_location,
    candidate.country,
    cityOf(candidate),
    primary,
    allModules,
    submodules,
    candidate.role_type,
    candidate.consulting_level,
    candidate.company_type,
    candidate.project_types,
    projectTypes
  ).slice(0, 8000);

  const qs = qualityScore(candidate, displayName, title, primary);
  if (qs < 55) return null;

  return {
    candidate_id: candidate.id,
    primary_module: primary,
    all_modules: allModules,
    all_submodules: submodules,
    country: countryOf(candidate),
    city: cityOf(candidate),
    years: yearsOf(candidate),
    role_type: candidate.role_type || candidate.roleType || null,
    consulting_level: candidate.consulting_level || candidate.consultingLevel || null,
    company_type: candidate.company_type || candidate.company_background || null,
    consulting_firms: unique([
      ...arr(candidate.consulting_firm_evidence),
      ...arr(candidate.consulting_firms),
      ...arr(candidate.consultingCompanies),
    ]),
    project_types: unique([...projectTypes, ...arr(candidate.project_types)]),
    greenfield_count: greenfieldCount,
    brownfield_count: brownfieldCount,
    rollout_count: rolloutCount,
    s4_count: s4Count,
    s4_ams_count: s4AmsCount,
    ams_count: amsCount,
    quality_score: qs,
    contactable: hasContact(candidate),
    search_text: searchText,
    source_updated_at: sourceUpdatedAt,
    updated_at: new Date().toISOString(),

    display_name: displayName,
    display_title: title || null,
    display_company: company || null,
    display_location: candidate.location || candidate.current_location || candidate.country || null,
    email_masked: maskEmail(candidate.email),
    phone_masked: maskPhone(candidate.phone),
  };
}

export async function upsertCandidateSearchIndex(candidate: AnyRecord) {
  if (!candidate?.id) return { error: new Error("Missing candidate id") };
  const row = buildCandidateSearchIndexRow(candidate);
  if (!row) return { error: new Error("Candidate is not SAP/search-index eligible") };
  return supabase.from("candidate_search_index").upsert(row, { onConflict: "candidate_id" });
}

export async function syncCandidateSearchIndexSince(sinceIso?: string, limit = 2000) {
  let query = supabase
    .from("candidates")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (sinceIso) query = query.gte("updated_at", sinceIso);

  const { data, error } = await query;
  if (error) return { error, count: 0 };

  const rows = (data || []).map(buildCandidateSearchIndexRow).filter((row): row is NonNullable<ReturnType<typeof buildCandidateSearchIndexRow>> => row !== null);
  if (!rows.length) return { count: 0 };

  const { error: upsertError } = await supabase
    .from("candidate_search_index")
    .upsert(rows, { onConflict: "candidate_id" });

  return { error: upsertError, count: rows.length };
}

export function modulesForKeyword(keyword: string) {
  const q = String(keyword || "").trim();
  if (!q) return [];
  const detected = parseSapModulesFromKeyword(q);
  const normalized = normalizeIndexModule(q);
  const base = [...detected.map(normalizeIndexModule).filter(Boolean)];
  if (normalized) base.push(normalized);
  return normalizeIndexModules(base);
}
