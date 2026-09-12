import { hasUsableEvidence } from "./candidate360EvidenceAvailability";
import {
  calculateProfileCompleteness,
  profileSectionState,
  type CompletenessComponent,
  type ProfileSectionState,
} from "./candidate360Completeness";
import { calculateTotalCareerYears } from "./candidateCareerExperience";
import {
  CANDIDATE_EMPLOYMENT_TIMELINE_VERSION,
  canonicalEmploymentTimeline,
  embeddedCvIdentityHeader,
  linkProjectsToEmployment,
  stripEmbeddedCvHeaderFromProjectResponsibility,
  validEmploymentCompany,
  validEmploymentTitle,
} from "./candidate360Employment";

export type CandidateSchemaRecord = Record<string, unknown>;
export const CANDIDATE_CANONICAL_VERSION =
  "candidate-canonical-v42-exact-project-identity";
export const CANDIDATE_DETAIL_PROJECTION_VERSION =
  "candidate-detail-v24-exact-project-identity";
export const CANDIDATE_EXPERIENCE_EXTRACTOR_VERSION =
  CANDIDATE_EMPLOYMENT_TIMELINE_VERSION;
export const CANDIDATE_PROJECT_EXTRACTOR_VERSION =
  "candidate-projects-v22-exact-project-identity";

type NormalizedCandidateProjection = ReturnType<
  typeof normalizeActualCandidateSchemaFresh
>;
const normalizationRuntime = globalThis as typeof globalThis & {
  __candidateCanonicalProjectionV42?: Map<
    string,
    NormalizedCandidateProjection
  >;
};
const normalizedProjectionCache =
  normalizationRuntime.__candidateCanonicalProjectionV42 ||
  (normalizationRuntime.__candidateCanonicalProjectionV42 = new Map());

export type EnterpriseEmployment = {
  id: string;
  sourceEmploymentIds?: string[];
  company: string;
  title: string;
  titleAssociation?: "employment_record";
  location: string;
  companyType: string;
  modules: string[];
  achievements: string[];
  responsibilities?: string[];
  start: string;
  end: string;
  duration: string;
  current: boolean;
  evidenceState?: EvidenceState;
  evidenceConfidence?: number;
  linkedProjectIds?: string[];
  provenance?: EvidenceRef[];
};

export type EvidenceState =
  "verified" | "source_extracted" | "derived" | "inferred" | "missing";

export type EvidenceRef = {
  sourceType:
    | "candidate_field"
    | "parsed_resume"
    | "employment"
    | "project"
    | "candidate_confirmation"
    | "recruiter_confirmation"
    | "system_derived";
  sourceRef?: string;
  fieldPath?: string;
  label: string;
  excerpt?: string;
  normalizedValue?: string;
};

export type ProjectEvidenceValue<T> = {
  value: T | null;
  provenance: EvidenceRef[];
  evidenceState: EvidenceState;
};

export type CandidateExperienceSummary = {
  totalCareerYears: number | null;
  currentEmployerTenureYears: number | null;
  currentRoleTenureYears: number | null;
  sapExperienceYears: number | null;
  primaryModuleExperienceYears: number | null;
  consultingExperienceYears: number | null;
};

export type EvidenceQualitySummary = {
  profileCompleteness: number;
  sourceTraceability: number;
  directlySupportedClaims: number;
  derivedClaims: number;
  inferredClaims: number;
  missingCriticalFields: string[];
};
export type EnterpriseProject = {
  id: string;
  sourceAssignmentIds?: string[];
  name: string;
  client: string;
  employer?: string;
  industry: string;
  country: string;
  role: string;
  modules: string[];
  projectType: string;
  implementationType: string;
  start: string;
  end: string;
  duration: string | null;
  responsibilities: string[];
  teamSize: number | null;
  environment: string;
  evidenceState: EvidenceState;
  fieldEvidence: Partial<
    Record<
      | "name"
      | "client"
      | "employer"
      | "industry"
      | "country"
      | "role"
      | "modules"
      | "projectType"
      | "implementationType"
      | "dates"
      | "duration"
      | "responsibilities"
      | "teamSize"
      | "environment",
      ProjectEvidenceValue<unknown>
    >
  >;
};

export type CareerHighlights = {
  yearsExperience: number | null;
  yearsConsulting: number | null;
  yearsLeadership: number | null;
  implementationProjects: number;
  rolloutProjects: number;
  greenfieldProjects: number;
  brownfieldProjects: number;
  amsProjects: number;
  supportProjects: number;
  primarySapModule: string;
  countries: string[];
  industries: string[];
  consultingBackground: boolean;
  endUserBackground: boolean;
  leadershipExperience: boolean;
  teamSize: number | null;
  regionalExperience: string[];
  s4hana: boolean;
  ecc: boolean;
  migration: boolean;
  treasury: boolean;
  banking: boolean;
  publicCloud: boolean;
  privateCloud: boolean;
};

export type IntelligenceMetric = {
  key: string;
  label: string;
  score: number | null;
  confidence: number | null;
  status:
    | "excellent"
    | "strong"
    | "established"
    | "developing"
    | "limited_evidence"
    | "not_assessed";
  evidence: string[];
  reason: string;
};

export type CandidateIntelligence = {
  candidateStrengths: string[];
  careerRisks: string[];
  promotionReadiness: IntelligenceMetric;
  leadershipReadiness: IntelligenceMetric;
  consultingDna: IntelligenceMetric;
  implementationAuthority: IntelligenceMetric;
  financeDepth: IntelligenceMetric;
  technicalDepth: IntelligenceMetric;
  marketPosition: IntelligenceMetric;
  salaryPosition: IntelligenceMetric;
  regionalCoverage: IntelligenceMetric;
  countryCoverage: IntelligenceMetric;
  projectComplexity: IntelligenceMetric;
  clientTier: IntelligenceMetric;
  domainExpertise: IntelligenceMetric;
  trend: Array<{ label: string; score: number; evidence: string }>;
  insights: {
    topStrengths: string[];
    topRisks: string[];
    idealRoles: string[];
    idealClients: string[];
    idealIndustries: string[];
    idealCountries: string[];
    potentialGaps: string[];
  };
};
export type EvidenceAvailability =
  | "structured_available"
  | "source_present_unstructured"
  | "derived"
  | "verification_pending"
  | "missing";
export type CandidateExtractionStatus =
  | "extracted"
  | "genuinely_none"
  | "source_unavailable"
  | "extraction_pending"
  | "extraction_failed";
export type CandidateExtractionSection = {
  status: CandidateExtractionStatus;
  version: typeof CANDIDATE_CANONICAL_VERSION;
  sourceRef: string;
  fallbackExcerpt: string;
  attemptedRoutes: string[];
  failureReason: string;
  retryable: boolean;
};
export type ProfileSectionEvidence<T> = {
  value: T | null;
  sourceTextPresent: boolean;
  normalized: boolean;
  provenance: EvidenceRef[];
  state: EvidenceAvailability;
};
export type NormalizedSectionEvidence = ProfileSectionEvidence<unknown> & {
  sourcePresent: boolean;
  normalizedValuePresent: boolean;
  sourceRef: string;
  profileState: ProfileSectionState;
};
export type EnterpriseCandidateProfile = {
  candidateId: string;
  identity: {
    name: string;
    /** Profile-level title context; never derived from the latest historical job. */
    profileTitle?: string;
    currentTitle: string;
    currentCompany: string;
    headline: string;
    location: string;
    country: string;
  };
  summary: string;
  /** Sanitized source-backed narrative, distinct from generated summaries. */
  professionalSummary?: string;
  technicalSkills: string[];
  sapModules: string[];
  careerHighlights: CareerHighlights;
  experienceSummary: CandidateExperienceSummary;
  employmentTimeline: EnterpriseEmployment[];
  projects: EnterpriseProject[];
  education: Array<{
    id: string;
    qualification: string;
    institution: string;
    fieldOfStudy: string;
    startYear: string;
    endYear: string;
  }>;
  certifications: string[];
  languages: Array<{ language: string; proficiency: string }>;
  recruiterSignals: {
    availability: string;
    notice: string;
    salary: string;
    travel: string;
    remote: string;
    visa: string;
    relocation?: string;
  };
  intelligence: CandidateIntelligence;
  quality: {
    profileCompleteness: number;
    dataConfidence: number;
    missingSections: string[];
    reviewRisks: string[];
    evidenceQuality: EvidenceQualitySummary;
    sectionEvidence: Record<
      "education" | "languages" | "certifications",
      NormalizedSectionEvidence
    >;
    completenessComponents: CompletenessComponent[];
    extraction: {
      experience: CandidateExtractionSection;
      projects: CandidateExtractionSection;
    };
  };
};

const GENERIC =
  /^(unknown|n\/?a|none|not provided|needs_repair|repair missing data|parser extracted|null|undefined|\[object Object\])$/i;
export const PROFILE_COMPLETENESS_SECTIONS = [
  "identity.name",
  "identity.currentTitle",
  "identity.currentCompany",
  "employmentTimeline",
  "projects",
  "education",
  "skills",
  "certifications",
  "languages",
] as const;
const SECTION_KEYS = [
  "profile",
  "personal",
  "summary",
  "skills",
  "experience",
  "experiences",
  "projects",
  "projectExperience",
  "project_experience",
  "assignments",
  "engagements",
  "programs",
  "education",
  "certifications",
  "languages",
  "sap",
  "consulting",
  "employer",
  "employment",
  "employmentHistory",
  "employment_history",
  "workHistory",
  "work_history",
  "professionalExperience",
  "professional_experience",
  "positions",
  "jobs",
  "roles",
  "role",
  "compensation",
  "resume",
  "cv",
  "career",
  "ai",
  "payload",
  "candidate",
  "data",
];

function isRecord(value: unknown): value is CandidateSchemaRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCandidateValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const source = value.trim();
  if (!source || (!source.startsWith("{") && !source.startsWith("[")))
    return value;
  try {
    return JSON.parse(source);
  } catch {
    return value;
  }
}

function unwrap(value: unknown): unknown {
  let current = parseCandidateValue(value);
  for (let depth = 0; depth < 8 && isRecord(current); depth += 1) {
    const keys = Object.keys(current);
    if (keys.length === 1 && ["value", "data", "result"].includes(keys[0]))
      current = parseCandidateValue(current[keys[0]]);
    else break;
  }
  return current;
}

function clean(value: unknown): string {
  const current = unwrap(value);
  if (typeof current === "string") {
    const result = current.replace(/\s+/g, " ").trim();
    return result && !GENERIC.test(result) ? result : "";
  }
  if (typeof current === "number" || typeof current === "boolean")
    return String(current);
  if (isRecord(current))
    return clean(
      firstValue([current], ["name", "label", "title", "text", "description"]),
    );
  return "";
}

function direct(record: CandidateSchemaRecord, aliases: string[]): unknown {
  for (const alias of aliases) {
    const value = unwrap(record[alias]);
    if (value !== undefined && value !== null && clean(value)) return value;
  }
}

function parsedRoot(raw: CandidateSchemaRecord): CandidateSchemaRecord {
  const parsed = unwrap(raw.parsed_json);
  return isRecord(parsed) ? parsed : {};
}

function scopes(raw: CandidateSchemaRecord): CandidateSchemaRecord[] {
  const parsed = parsedRoot(raw);
  const output: CandidateSchemaRecord[] = [raw, parsed];
  const queue: Array<{ value: CandidateSchemaRecord; depth: number }> = [
    { value: parsed, depth: 0 },
  ];
  const seen = new Set<CandidateSchemaRecord>(output);
  while (queue.length) {
    const item = queue.shift();
    if (!item || item.depth >= 6) continue;
    for (const key of SECTION_KEYS) {
      const value = unwrap(item.value[key]);
      const children = Array.isArray(value)
        ? value.filter(isRecord)
        : isRecord(value)
          ? [value]
          : [];
      for (const child of children)
        if (!seen.has(child)) {
          seen.add(child);
          output.push(child);
          queue.push({ value: child, depth: item.depth + 1 });
        }
    }
  }
  return output;
}

function firstValue(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): unknown {
  for (const scope of sourceScopes) {
    const value = direct(scope, aliases);
    if (value !== undefined) return value;
  }
}

function firstText(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): string {
  return clean(firstValue(sourceScopes, aliases));
}

function asList(value: unknown): unknown[] {
  const current = unwrap(value);
  if (Array.isArray(current)) return current.map(unwrap);
  if (isRecord(current)) {
    for (const key of [
      "items",
      "entries",
      "data",
      "results",
      "history",
      "experiences",
      "projects",
      "employment",
      "work_history",
    ]) {
      const nested = unwrap(current[key]);
      if (Array.isArray(nested)) return nested.map(unwrap);
    }
    return [current];
  }
  if (typeof current === "string" && current.trim())
    return current
      .split(/[,;|\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
}

function recordLists(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): CandidateSchemaRecord[] {
  const output: CandidateSchemaRecord[] = [];
  const seen = new Set<unknown>();
  for (const scope of sourceScopes)
    for (const alias of aliases) {
      const raw = scope[alias];
      if (raw === undefined || seen.has(raw)) continue;
      seen.add(raw);
      output.push(...asList(raw).filter(isRecord));
    }
  return output;
}

function stringList(values: unknown[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const current = unwrap(value);
    if (Array.isArray(current)) {
      current.forEach(add);
      return;
    }
    if (isRecord(current)) {
      const named = clean(
        firstValue(
          [current],
          [
            "name",
            "skill",
            "module",
            "certification",
            "language",
            "label",
            "title",
          ],
        ),
      );
      if (named) add(named);
      else
        for (const [key, enabled] of Object.entries(current))
          if (enabled === true || enabled === 1 || enabled === "true") add(key);
      return;
    }
    for (const item of clean(current)
      .split(/[,;|\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      const key = item.toLowerCase();
      if (!seen.has(key) && !GENERIC.test(item)) {
        seen.add(key);
        output.push(item);
      }
    }
  };
  values.forEach(add);
  return output;
}

function allStrings(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): string[] {
  return stringList(
    sourceScopes.flatMap((scope) => aliases.map((alias) => scope[alias])),
  );
}

function numeric(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): number | null {
  const value = firstValue(sourceScopes, aliases);
  const parsed = Number(unwrap(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function maximumNumeric(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): number | null {
  const values = sourceScopes
    .flatMap((scope) => aliases.map((alias) => Number(unwrap(scope[alias]))))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return values.length ? Math.max(...values) : null;
}

function truthy(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
  evidence: string,
): boolean {
  const value = unwrap(firstValue(sourceScopes, aliases));
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string" && /^(true|yes|y)$/i.test(value.trim()))
    return true;
  return evidence
    .toLowerCase()
    .includes(aliases.join(" ").replaceAll("_", " ").toLowerCase());
}

function humanizeMissingSection(value: string): string {
  const labels: Record<string, string> = {
    "identity.name": "Name",
    "identity.currentTitle": "Current title",
    "identity.currentCompany": "Current employer",
    employmentTimeline: "Employment history",
    projects: "Project experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    languages: "Languages",
  };
  return (
    labels[value] ||
    value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function dateYear(value: string): number {
  return Number(value.match(/(?:19|20)\d{2}/g)?.at(-1) || 0);
}

function duration(start: string, end: string, explicit = ""): string {
  if (explicit) return explicit;
  const parseMonth = (value: string) => {
    const numeric = value
      .trim()
      .match(/^((?:19|20)\d{2})[-/](0?[1-9]|1[0-2])$/);
    const named = value
      .trim()
      .match(
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\b/i,
      );
    const names = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    if (numeric) return { year: Number(numeric[1]), month: Number(numeric[2]) };
    if (named)
      return {
        year: Number(named[2]),
        month: names.indexOf(named[1].toLowerCase()) + 1,
      };
    return null;
  };
  const supportedStart = parseMonth(start);
  const supportedEnd = parseMonth(end);
  if (!supportedStart || !supportedEnd) return "";
  const months =
    (supportedEnd.year - supportedStart.year) * 12 +
    supportedEnd.month -
    supportedStart.month;
  if (months < 0) return "";
  if (months === 0) return "Less than 1 month";
  if (months < 12) return String(months) + " month" + (months === 1 ? "" : "s");
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return (
    String(years) +
    " year" +
    (years === 1 ? "" : "s") +
    (remainder ? " " + remainder + " month" + (remainder === 1 ? "" : "s") : "")
  );
}

export function cleanCandidateTitle(value: unknown): string {
  return validEmploymentTitle(
    clean(value)
      .replace(/[+()\d][\d\s()+.-]{7,}/g, " ")
      .replace(/^[\"']|[\"']$/g, "")
      .replace(/^\s*(?:[•*-]|\d+[.)])\s*/, "")
      .replace(
        /^\s*(?:(?:currently\s+)?working\s+as|worked\s+as|current\s+employment|roles?\s+as|position|role|job\s*title)\s*:?\s*/i,
        "",
      )
      .replace(
        /^.*?\b(?:currently\s+working\s+as|worked\s+as|roles?\s+as)\s+/i,
        "",
      )
      .replace(
        /^.*?\bcurrently\s+(?:he|she|they)\s+is\s+(?:working\s+)?as\s+/i,
        "",
      )
      .replace(/^.*?\bcurrently\s+serving\s+as\s+/i, "")
      .replace(/\b(?:mob(?:ile)?\s*(?:no\.?)?|phone)\s*:?.*$/i, "")
      .replace(
        /\s+(?:in|with)\s+[^,;]{2,80}\b(?:sdn\s+bhd|pte\s+ltd|ltd|limited|inc|corporation|company)\b.*$/i,
        "",
      )
      .replace(/\s+at\s+.+$/i, "")
      .replace(/[.;:]\s+(?:responsibilities|duties|company|employer)\b.*$/i, "")
      .replace(/\s+([,.;:])/g, "$1")
      .trim(),
  );
}

type SupportedProjectDate = { year: number; month: number | null };

function supportedProjectDate(value: string): SupportedProjectDate | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/present|current|now/i.test(normalized)) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  const year = dateYear(normalized);
  if (!year) return null;
  const numericMonth = normalized.match(
    /(?:19|20)\d{2}[-/]((?:0?[1-9])|(?:1[0-2]))(?:\b|[-/])/i,
  )?.[1];
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const namedMonth = normalized
    .toLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)?.[1];
  return {
    year,
    month: numericMonth
      ? Number(numericMonth)
      : namedMonth
        ? monthNames.indexOf(namedMonth) + 1
        : null,
  };
}

function projectDuration(
  start: string,
  end: string,
  explicit = "",
): string | null {
  if (explicit.trim())
    return /calendar-year span|year-level dates/i.test(explicit)
      ? null
      : explicit.trim();
  const supportedStart = supportedProjectDate(start);
  const supportedEnd = supportedProjectDate(end);
  if (!supportedStart || !supportedEnd) return null;
  if (supportedStart.month === null || supportedEnd.month === null) return null;
  const months =
    (supportedEnd.year - supportedStart.year) * 12 +
    supportedEnd.month -
    supportedStart.month;
  if (months < 0) return null;
  if (months === 0) return "Less than 1 month";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return [
    years ? years + " year" + (years === 1 ? "" : "s") : "",
    remainingMonths
      ? remainingMonths + " month" + (remainingMonths === 1 ? "" : "s")
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function parsedMonth(value: string, current = false): number | null {
  if (current || /present|current|now/i.test(value)) {
    const now = new Date();
    return now.getUTCFullYear() * 12 + now.getUTCMonth();
  }
  const year = dateYear(value);
  if (!year) return null;
  const names = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const name = value
    .toLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)?.[1];
  return year * 12 + (name ? names.indexOf(name) : 0);
}

function nonOverlappingYears(records: EnterpriseEmployment[]): number | null {
  return calculateTotalCareerYears(
    records.map((item) => ({
      start: item.start,
      end: item.end,
      current: item.current,
    })),
  );
}

function buildExperienceSummary(
  sourceScopes: CandidateSchemaRecord[],
  timeline: EnterpriseEmployment[],
  primaryModule: string,
  currentEmployer: string,
): CandidateExperienceSummary {
  const current = timeline.find((item) => item.current && item.start) || null;
  const explicitSap = maximumNumeric(sourceScopes, [
    "years_of_sap_experience",
    "sap_experience_years",
    "sapYearsExperience",
  ]);
  const datedCapabilityEvidence = (item: EnterpriseEmployment) =>
    item.title + " " + item.modules.join(" ");
  const sapRoles = timeline.filter((item) =>
    /\bsap\b|s\/4|hana|abap/i.test(datedCapabilityEvidence(item)),
  );
  const modulePattern = primaryModule
    ? new RegExp(primaryModule.replace(/[.*+?^()|[\]\\]/g, "\\$&"), "i")
    : null;
  const moduleRoles = modulePattern
    ? timeline.filter((item) =>
        modulePattern.test(datedCapabilityEvidence(item)),
      )
    : [];
  const consultingRoles = timeline.filter((item) =>
    /consulting|consultancy|consultant/i.test(
      item.companyType + " " + item.company + " " + item.title,
    ),
  );
  const currentTenure = current ? nonOverlappingYears([current]) : null;
  return {
    totalCareerYears: nonOverlappingYears(timeline),
    currentEmployerTenureYears: currentTenure,
    currentRoleTenureYears:
      current?.title && current.start ? currentTenure : null,
    sapExperienceYears:
      explicitSap && explicitSap > 0
        ? explicitSap
        : nonOverlappingYears(sapRoles),
    primaryModuleExperienceYears: moduleRoles.length
      ? nonOverlappingYears(moduleRoles)
      : null,
    consultingExperienceYears: nonOverlappingYears(consultingRoles),
  };
}

function directProjectField<T>(
  value: T | null,
  fieldPath: string,
  sourceType: EvidenceRef["sourceType"] = "project",
  excerpt = "",
): ProjectEvidenceValue<T> {
  const present =
    value !== null &&
    value !== "" &&
    (!Array.isArray(value) || value.length > 0);
  return {
    value: present ? value : null,
    provenance: present
      ? [
          {
            sourceType,
            sourceRef: fieldPath,
            fieldPath,
            label:
              sourceType === "parsed_resume"
                ? "Resume evidence"
                : "Structured project evidence",
            ...(excerpt
              ? { excerpt: visibleCandidateSourceText(excerpt).slice(0, 1200) }
              : {}),
          },
        ]
      : [],
    evidenceState: present ? "source_extracted" : "missing",
  };
}

function supportedProjectName(value: unknown) {
  const name = clean(value)
    .replace(/\s+(?:Project\s+)?Duration\s*:[\s\S]*$/i, "")
    .replace(/\s+Project\s+Scope\s*:[\s\S]*$/i, "")
    .trim();
  if (
    /^(?:(?:SAP\s+)?(?:FI\/?CO|FICO|FI|CO|PS)\s+)?(?:Rollout|Migration|Support(?:\s*\/\s*Enhancement)?|Integration)\s+assignment$/i.test(
      name,
    ) ||
    /^\d+\s*\{[^}]*\b(?:implementation|rollout|migration|support)\b[^}]*\}$/i.test(
      name,
    )
  )
    return "";
  return name;
}
function withProjectEvidence(
  project: Omit<EnterpriseProject, "evidenceState" | "fieldEvidence">,
  sourceType: EvidenceRef["sourceType"],
  sourceRef: string,
  hasExplicitDuration = false,
): EnterpriseProject {
  const assignmentText = project.responsibilities
    .join(" ")
    .replace(/\u2019/g, "'");
  const labelledRole = cleanCandidateTitle(
    assignmentText.match(
      /\b(?:role|position)\s*:\s*([\s\S]{2,120}?)(?=\s+(?:responsibilities?|deliverables?|application|project|client|system|year|duration|skills?\s+gained|job\s+duties|highlights?)\b\s*[:(–—-]?|\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|[.;|]|$)/i,
    )?.[1] || "",
  );
  const labelledRange =
    assignmentText.match(
      /\b(?:project\s+)?duration\s*:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[ '\/]*(?:19|20)?\d{2,4})\s*(?:-|–|—|to|~)\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[ '\/]*(?:19|20)?\d{2,4})|Present|Current)/i,
    ) ||
    assignmentText.match(
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*(?:-|–|—|to|~)\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})|Present|Current)\b/i,
    );
  const enrichedProject = {
    ...project,
    role: project.role || labelledRole,
    start: project.start || labelledRange?.[1] || "",
    end: project.end || labelledRange?.[2] || "",
    duration:
      project.duration ||
      (labelledRange
        ? projectDuration(labelledRange[1], labelledRange[2])
        : null),
  };
  const sanitizedProject = {
    ...enrichedProject,
    name: supportedProjectName(enrichedProject.name),
    responsibilities: [
      ...new Set(
        enrichedProject.responsibilities
          .map(stripEmbeddedCvHeaderFromProjectResponsibility)
          .filter((item) => item.length >= 12),
      ),
    ],
  };
  const fields = {
    name: directProjectField(
      sanitizedProject.name || null,
      sourceRef + ".name",
      sourceType,
      sanitizedProject.responsibilities.join(" "),
    ),
    client: directProjectField(
      sanitizedProject.client || null,
      sourceRef + ".client",
      sourceType,
      sanitizedProject.responsibilities.join(" "),
    ),
    employer: directProjectField(
      sanitizedProject.employer || null,
      sourceRef + ".employer",
      sourceType,
      sanitizedProject.responsibilities.join(" "),
    ),
    industry: directProjectField(
      sanitizedProject.industry || null,
      sourceRef + ".industry",
      sourceType,
    ),
    country: directProjectField(
      sanitizedProject.country || null,
      sourceRef + ".country",
      sourceType,
    ),
    role: directProjectField(
      sanitizedProject.role || null,
      sourceRef + ".role",
      sourceType,
    ),
    modules: directProjectField(
      sanitizedProject.modules.length ? sanitizedProject.modules : null,
      sourceRef + ".modules",
      sourceType,
    ),
    projectType: directProjectField(
      sanitizedProject.projectType || null,
      sourceRef + ".projectType",
      sourceType,
    ),
    implementationType: directProjectField(
      sanitizedProject.implementationType || null,
      sourceRef + ".implementationType",
      sourceType,
    ),
    dates: directProjectField(
      sanitizedProject.start && sanitizedProject.end
        ? [sanitizedProject.start, sanitizedProject.end]
        : null,
      sourceRef + ".dates",
      sourceType,
    ),
    responsibilities: directProjectField(
      sanitizedProject.responsibilities.length
        ? sanitizedProject.responsibilities
        : null,
      sourceRef + ".responsibilities",
      sourceType,
    ),
    teamSize: directProjectField(
      sanitizedProject.teamSize,
      sourceRef + ".teamSize",
      sourceType,
    ),
    environment: directProjectField(
      sanitizedProject.environment || null,
      sourceRef + ".environment",
      sourceType,
    ),
  };
  const explicitDuration = Boolean(
    enrichedProject.duration && hasExplicitDuration,
  );
  const durationEvidence: ProjectEvidenceValue<unknown> = explicitDuration
    ? directProjectField(
        enrichedProject.duration,
        sourceRef + ".duration",
        sourceType,
      )
    : enrichedProject.duration && enrichedProject.start && enrichedProject.end
      ? {
          value: enrichedProject.duration,
          provenance: [
            {
              sourceType: "system_derived",
              sourceRef: sourceRef + ".dates",
              fieldPath: sourceRef + ".dates",
              label: "Derived from project dates",
            },
          ],
          evidenceState: "derived",
        }
      : directProjectField(null, sourceRef + ".duration", sourceType);
  return {
    ...sanitizedProject,
    evidenceState:
      sourceType === "recruiter_confirmation" ||
      sourceType === "candidate_confirmation"
        ? "verified"
        : "source_extracted",
    fieldEvidence: { ...fields, duration: durationEvidence },
  };
}

const normalizedAssignmentAnchor = (value: unknown) =>
  clean(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /\b(?:client|customer|project|programme|program|role|position|system)\s*:\s*/g,
      " ",
    )
    .replace(
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|limited|ltd\.?|inc\.?|corporation|corp\.?|berhad)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const assignmentTokens = (value: unknown) =>
  new Set(
    normalizedAssignmentAnchor(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 2 &&
          ![
            "sap",
            "senior",
            "junior",
            "lead",
            "team",
            "project",
            "consultant",
          ].includes(token),
      ),
  );

function assignmentTokenOverlap(left: unknown, right: unknown) {
  const leftTokens = assignmentTokens(left);
  const rightTokens = assignmentTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function projectText(project: EnterpriseProject) {
  return [
    project.name,
    project.client,
    project.employer,
    project.role,
    project.environment,
    ...project.modules,
    ...project.responsibilities,
  ]
    .filter(Boolean)
    .join(" ");
}

function assignmentOrganizationAnchor(value: unknown) {
  return normalizedAssignmentAnchor(
    clean(value)
      .replace(
        /\s+(?:role|position|system|employer|project)\s*:\s*[\s\S]*$/i,
        "",
      )
      .replace(/\s+\((?:[^)]*\b(?:19|20)\d{2}\b[^)]*)\)[\s\S]*$/i, "")
      .replace(
        /\s+\b(?:provided|led|implemented|supported|delivered|managed|configured|migrated|rolled out)\b[\s\S]*$/i,
        "",
      ),
  );
}

function inferredProjectClient(project: EnterpriseProject) {
  const explicit = assignmentOrganizationAnchor(project.client);
  if (explicit) return explicit;
  return assignmentOrganizationAnchor(
    projectText(project).match(
      /\b(?:client|customer)\s*[:\-]\s*([^.;|]{2,100})/i,
    )?.[1],
  );
}

function assignmentOrganizationAliases(value: string) {
  const aliases = new Set<string>();
  for (const segment of value.split(/[\/|]/)) {
    const tokens = normalizedAssignmentAnchor(segment)
      .split(" ")
      .filter(
        (token) =>
          token &&
          ![
            "project",
            "retail",
            "company",
            "corporation",
            "limited",
            "sdn",
            "bhd",
            "technology",
            "technologies",
            "services",
          ].includes(token),
      );
    if (!tokens.length) continue;
    aliases.add(tokens.join(" "));
    const acronym = tokens.map((token) => token[0]).join("");
    if (acronym.length >= 3) aliases.add(acronym);
    for (let length = 3; length < tokens.length; length += 1)
      aliases.add(
        tokens
          .slice(0, length)
          .map((token) => token[0])
          .join(""),
      );
    for (const token of tokens)
      if (token.length >= 3 && token === token.toUpperCase())
        aliases.add(token.toLowerCase());
  }
  return aliases;
}

function projectsDescribeSameAssignment(
  left: EnterpriseProject,
  right: EnterpriseProject,
) {
  if (left.id === right.id) return true;
  const leftClient = inferredProjectClient(left);
  const rightClient = inferredProjectClient(right);
  const leftName = normalizedAssignmentAnchor(left.name);
  const rightName = normalizedAssignmentAnchor(right.name);
  const leftDates = normalizedAssignmentAnchor(`${left.start}|${left.end}`);
  const rightDates = normalizedAssignmentAnchor(`${right.start}|${right.end}`);
  if (leftDates && rightDates && leftDates !== rightDates) return false;
  const sameClient = Boolean(
    leftClient &&
    rightClient &&
    (leftClient === rightClient ||
      intersectsAssignmentAliases(
        assignmentOrganizationAliases(leftClient),
        assignmentOrganizationAliases(rightClient),
      ) ||
      assignmentTokenOverlap(leftClient, rightClient) >= 0.75),
  );
  const sameName = Boolean(leftName && rightName && leftName === rightName);
  const sameDates = Boolean(
    leftDates && rightDates && leftDates === rightDates,
  );
  const sameDeliveryType = Boolean(
    normalizedAssignmentAnchor(left.projectType || left.implementationType) &&
    normalizedAssignmentAnchor(left.projectType || left.implementationType) ===
      normalizedAssignmentAnchor(right.projectType || right.implementationType),
  );
  const relatedRole = assignmentTokenOverlap(left.role, right.role) >= 0.5;
  const relatedModules =
    assignmentTokenOverlap(left.modules.join(" "), right.modules.join(" ")) >=
    0.5;
  const relatedDescription =
    assignmentTokenOverlap(projectText(left), projectText(right)) >= 0.65;
  const relatedResponsibilities =
    assignmentTokenOverlap(
      left.responsibilities.join(" "),
      right.responsibilities.join(" "),
    ) >= 0.6;
  const oneSideUndated = Boolean(leftDates) !== Boolean(rightDates);
  const sparseFragment = (project: EnterpriseProject) =>
    !project.name && !project.role && !project.start && !project.end;
  return (
    (sameClient &&
      (sameName ||
        sameDates ||
        relatedRole ||
        relatedResponsibilities ||
        relatedDescription ||
        sparseFragment(left) ||
        sparseFragment(right) ||
        (oneSideUndated && (!left.role || !right.role)) ||
        (oneSideUndated && sameDeliveryType && relatedModules) ||
        (sameDeliveryType &&
          assignmentTokenOverlap(projectText(left), projectText(right)) >=
            0.3))) ||
    (sameName && (sameDates || relatedRole || relatedDescription))
  );
}

function intersectsAssignmentAliases(left: Set<string>, right: Set<string>) {
  return [...left].some((value) => right.has(value));
}

const evidenceStateRank: Record<EvidenceState, number> = {
  missing: 0,
  inferred: 1,
  derived: 2,
  source_extracted: 3,
  verified: 4,
};

function mergeProjectEvidence(
  left: EnterpriseProject["fieldEvidence"],
  right: EnterpriseProject["fieldEvidence"],
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const field = key as keyof EnterpriseProject["fieldEvidence"];
      const leftValue = left[field];
      const rightValue = right[field];
      const preferred = !leftValue
        ? rightValue
        : !rightValue
          ? leftValue
          : evidenceStateRank[rightValue.evidenceState] >
              evidenceStateRank[leftValue.evidenceState]
            ? rightValue
            : leftValue;
      if (!preferred) return [field, undefined];
      const provenance = [
        ...(leftValue?.provenance || []),
        ...(rightValue?.provenance || []),
      ].filter(
        (item, index, values) =>
          values.findIndex(
            (candidate) =>
              `${candidate.sourceType}|${candidate.sourceRef || ""}|${candidate.fieldPath || ""}|${candidate.excerpt || ""}` ===
              `${item.sourceType}|${item.sourceRef || ""}|${item.fieldPath || ""}|${item.excerpt || ""}`,
          ) === index,
      );
      return [field, { ...preferred, provenance }];
    }),
  ) as EnterpriseProject["fieldEvidence"];
}

function mergeEnterpriseProjects(
  left: EnterpriseProject,
  right: EnterpriseProject,
): EnterpriseProject {
  const prefer = (first: string, second: string) =>
    !first
      ? second
      : !second
        ? first
        : second.length > first.length
          ? second
          : first;
  const responsibilities = [
    ...left.responsibilities,
    ...right.responsibilities,
  ].filter(
    (value, index, values) =>
      values.findIndex(
        (candidate) =>
          normalizedAssignmentAnchor(candidate) ===
          normalizedAssignmentAnchor(value),
      ) === index,
  );
  return {
    ...left,
    sourceAssignmentIds: [
      ...new Set([
        ...(left.sourceAssignmentIds || [left.id]),
        ...(right.sourceAssignmentIds || [right.id]),
      ]),
    ].sort(),
    name: prefer(left.name, right.name),
    client: prefer(left.client, right.client),
    employer: prefer(left.employer || "", right.employer || ""),
    industry: prefer(left.industry, right.industry),
    country: prefer(left.country, right.country),
    role: prefer(left.role, right.role),
    modules: [...new Set([...left.modules, ...right.modules])],
    projectType: prefer(left.projectType, right.projectType),
    implementationType: prefer(
      left.implementationType,
      right.implementationType,
    ),
    start: left.start || right.start,
    end: left.end || right.end,
    duration: left.duration || right.duration,
    responsibilities,
    teamSize: Math.max(left.teamSize || 0, right.teamSize || 0) || null,
    environment: prefer(left.environment, right.environment),
    evidenceState:
      evidenceStateRank[right.evidenceState] >
      evidenceStateRank[left.evidenceState]
        ? right.evidenceState
        : left.evidenceState,
    fieldEvidence: mergeProjectEvidence(
      left.fieldEvidence,
      right.fieldEvidence,
    ),
  };
}

function stableAssignmentHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function canonicalizeEnterpriseProjects(
  projects: readonly EnterpriseProject[],
) {
  const canonical: EnterpriseProject[] = [];
  for (const project of projects) {
    const existingIndex = canonical.findIndex((candidate) =>
      projectsDescribeSameAssignment(candidate, project),
    );
    if (existingIndex < 0)
      canonical.push({
        ...project,
        sourceAssignmentIds: [
          ...new Set(project.sourceAssignmentIds || [project.id]),
        ],
      });
    else
      canonical[existingIndex] = mergeEnterpriseProjects(
        canonical[existingIndex],
        project,
      );
  }
  return canonical.map((project) => {
    const clientUsedAsName = Boolean(
      project.name &&
      project.client &&
      normalizedAssignmentAnchor(project.name) ===
        normalizedAssignmentAnchor(project.client),
    );
    const normalizedProject = clientUsedAsName
      ? {
          ...project,
          name: "",
          fieldEvidence: {
            ...project.fieldEvidence,
            name: directProjectField(
              null,
              `${project.sourceAssignmentIds?.[0] || project.id}.name`,
              "parsed_resume",
            ),
          },
        }
      : project;
    const identity =
      [
        inferredProjectClient(normalizedProject),
        normalizedAssignmentAnchor(normalizedProject.employer),
        normalizedAssignmentAnchor(normalizedProject.name),
        normalizedAssignmentAnchor(normalizedProject.role),
        normalizedAssignmentAnchor(normalizedProject.start),
        normalizedAssignmentAnchor(normalizedProject.end),
        normalizedAssignmentAnchor(normalizedProject.environment),
      ]
        .filter(Boolean)
        .join("|") ||
      (normalizedProject.sourceAssignmentIds || [normalizedProject.id]).join(
        "|",
      );
    return {
      ...normalizedProject,
      id: `canonical-assignment-${stableAssignmentHash(identity)}`,
    };
  });
}

function removeEmploymentOnlyProjectDuplicates(
  projects: readonly EnterpriseProject[],
  employment: readonly EnterpriseEmployment[],
) {
  return projects.filter((project) => {
    if (project.name || project.employer || !project.client) return true;
    const clientAliases = assignmentOrganizationAliases(
      normalizedAssignmentAnchor(project.client),
    );
    const duplicatesEmployment = employment.some((role) => {
      const employerAliases = assignmentOrganizationAliases(
        normalizedAssignmentAnchor(role.company),
      );
      const sameOrganization =
        intersectsAssignmentAliases(clientAliases, employerAliases) ||
        assignmentTokenOverlap(project.client, role.company) >= 0.75;
      const sameRole =
        normalizedAssignmentAnchor(project.role) ===
          normalizedAssignmentAnchor(role.title) ||
        assignmentTokenOverlap(project.role, role.title) >= 0.5;
      return sameOrganization && sameRole;
    });
    return !duplicatesEmployment;
  });
}
function normalizeEmploymentLegacy(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseEmployment[] {
  const records = recordLists(sourceScopes, [
    "experience",
    "experiences",
    "work_experience",
    "workExperience",
    "employment_history",
    "employmentHistory",
    "work_history",
    "workHistory",
    "career_history",
    "careerHistory",
    "professional_experience",
    "professionalExperience",
    "employment",
    "employmentExperience",
    "positions",
    "jobs",
    "roles",
  ]);
  const unique = new Map<string, EnterpriseEmployment>();
  records.forEach((item, index) => {
    const company = firstText(
      [item],
      ["company", "employer", "organization", "company_name"],
    );
    const title = firstText([item], ["title", "job_title", "role", "position"]);
    const location = firstText(
      [item],
      ["country", "location", "city", "region"],
    );
    const companyType = firstText(
      [item],
      ["company_type", "companyType", "employment_type", "organization_type"],
    );
    const modules = allStrings(
      [item],
      ["modules", "module", "sap_modules", "sapModules", "key_modules"],
    );
    const achievements = allStrings(
      [item],
      [
        "achievements",
        "key_achievements",
        "highlights",
        "responsibilities",
        "description",
        "summary",
      ],
    ).slice(0, 3);
    const start = firstText(
      [item],
      ["start_date", "startDate", "from", "start"],
    );
    const end = firstText([item], ["end_date", "endDate", "to", "end"]);
    const currentValue = unwrap(
      firstValue([item], ["current", "is_current", "isCurrent"]),
    );
    const current =
      currentValue === true ||
      currentValue === 1 ||
      /^(true|yes)$/i.test(clean(currentValue)) ||
      /present|current|now/i.test(end);
    if (!company && !title) return;
    const entry: EnterpriseEmployment = {
      id: firstText([item], ["id"]) || `employment-${index + 1}`,
      company,
      title,
      ...(title ? { titleAssociation: "employment_record" as const } : {}),
      location,
      companyType,
      modules,
      achievements,
      start,
      end,
      duration: duration(start, end, firstText([item], ["duration", "tenure"])),
      current,
      provenance: [
        {
          sourceType: "employment",
          sourceRef: `candidate.employment.${index + 1}`,
          fieldPath: `candidate.employment.${index + 1}`,
          label: "Candidate employment record",
        },
      ],
    };
    unique.set(`${company}|${title}|${start}|${end}`.toLowerCase(), entry);
  });
  if (!unique.size) {
    const resumeText = firstText(sourceScopes, [
      "resume_text",
      "raw_text",
      "cv_text",
      "raw_cv",
    ]);
    const employerSection =
      resumeText.match(/\bEMPLOYERS\b([\s\S]*?)(?:\bPROJECT\b|$)/i)?.[1] || "";
    const employerPattern =
      /(\d{4})\s*-\s*(Present|\d{4})\s*[–—-]\s*(.*?)(?=\s+\d{4}\s*-\s*(?:Present|\d{4})\s*[–—-]|$)/gi;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = employerPattern.exec(employerSection))) {
      const company = clean(match[3]);
      if (!company) continue;
      const start = match[1];
      const end = match[2];
      const current = /present/i.test(end);
      const entry: EnterpriseEmployment = {
        id: `resume-employment-${++index}`,
        company,
        title: "",
        location: "",
        companyType: "",
        modules: [],
        achievements: [],
        start,
        end,
        duration: duration(start, end),
        current,
        provenance: [
          {
            sourceType: "parsed_resume",
            sourceRef: "resume.employers",
            fieldPath: "resume.employers",
            label: "Resume employment section",
          },
        ],
      };
      unique.set(`${company}||${start}|${end}`.toLowerCase(), entry);
    }
    if (!unique.size) {
      const datedRolePattern =
        /((?:SAP|Senior|Lead|Manager|Consultant|Analyst|Accountant|Specialist|Director|Head|Finance|FICO|FI\/CO)[A-Za-z0-9/&(),.'\- ]{1,100}?)\s+at\s+([A-Z][A-Za-z0-9&(),.'\/ –—-]{1,140}?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*[–—-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|Current)/gi;
      let careerMatch: RegExpExecArray | null;
      let careerIndex = 0;
      while ((careerMatch = datedRolePattern.exec(resumeText))) {
        const rawTitle = cleanCandidateTitle(careerMatch[1]);
        const title = cleanCandidateTitle(
          rawTitle.match(
            /((?:Senior\s+)?SAP\s+[A-Z0-9/&() -]{0,60}?(?:Consultant|Analyst|Manager|Specialist|Engineer))$/i,
          )?.[1] || rawTitle,
        );
        const company = clean(careerMatch[2]);
        const start = clean(careerMatch[3]);
        const end = clean(careerMatch[4]);
        const current = /present|current/i.test(end);
        if (title && company)
          unique.set(`${company}|${title}|${start}|${end}`.toLowerCase(), {
            id: `resume-employment-${++careerIndex}`,
            company,
            title,
            titleAssociation: "employment_record",
            location: "",
            companyType: "",
            modules: [],
            achievements: [],
            start,
            end,
            duration: duration(start, end),
            current,
            provenance: [
              {
                sourceType: "parsed_resume",
                sourceRef: "resume.experience",
                fieldPath: "resume.experience",
                label: "Resume career timeline",
              },
            ],
          });
      }
      if (!unique.size) {
        const monthDate =
          "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{4}";
        const dateRange = `(${monthDate})\\s*[–—-]\\s*(${monthDate}|Present|Current)`;
        const section =
          resumeText.match(
            /Employment History\s*:\s*([\s\S]*?)(?=Education\s*:|Qualifications?\s*\/\s*Education|$)/i,
          )?.[1] || "";
        const dual = section.match(
          new RegExp(
            `^${dateRange}\\s+${dateRange}\\s+(.{2,100}?Sdn\\s+Bhd)\\s+(.{2,100}?Sdn\\s+Bhd)\\s+(FICO Consultant[^J]{0,40}?)\\s+(FICO Consultant[^J]{0,40}?)(?=${monthDate})`,
            "i",
          ),
        );
        let remainder = section;
        if (dual) {
          const pairs = [
            [dual[1], dual[2], dual[5], dual[7]],
            [dual[3], dual[4], dual[6], dual[8]],
          ];
          pairs.forEach(([start, end, company, title]) => {
            const entry: EnterpriseEmployment = {
              id: `resume-employment-${++careerIndex}`,
              company: clean(company),
              title: cleanCandidateTitle(title),
              titleAssociation: "employment_record",
              location: "",
              companyType: "",
              modules: [],
              achievements: [],
              start: clean(start),
              end: clean(end),
              duration: duration(clean(start), clean(end)),
              current: /present|current/i.test(end),
              provenance: [
                {
                  sourceType: "parsed_resume",
                  sourceRef: "resume.employmentHistory",
                  fieldPath: "resume.employmentHistory",
                  label: "Resume employment history",
                },
              ],
            };
            unique.set(
              `${entry.company}|${entry.title}|${entry.start}|${entry.end}`.toLowerCase(),
              entry,
            );
          });
          remainder = section.slice((dual.index || 0) + dual[0].length);
        }
        const rangePattern = new RegExp(dateRange, "gi");
        const ranges: RegExpExecArray[] = [];
        let range: RegExpExecArray | null;
        while ((range = rangePattern.exec(remainder))) ranges.push(range);
        ranges.forEach((row, rowIndex) => {
          const segmentStart = (row.index || 0) + row[0].length;
          const segmentEnd = ranges[rowIndex + 1]?.index ?? remainder.length;
          const segment = clean(remainder.slice(segmentStart, segmentEnd));
          const role = segment.match(
            /\b(SAP Delivery Manager|Managing Consultant|FI\/CO team leader\s*(?:\([^)]*\))?|Senior Consultant \/ Consultant|Finance Manager\s*(?:\([^)]*\))?|Accountant\s*(?:\([^)]*\))?)$/i,
          );
          if (!role) return;
          const start = clean(row[1]);
          const end = clean(row[2]);
          const company = clean(segment.slice(0, role.index));
          const title = cleanCandidateTitle(role[1]);
          if (!company || !title) return;
          const entry: EnterpriseEmployment = {
            id: `resume-employment-${++careerIndex}`,
            company,
            title,
            titleAssociation: "employment_record",
            location: "",
            companyType: "",
            modules: [],
            achievements: [],
            start,
            end,
            duration: duration(start, end),
            current: /present|current/i.test(end),
            provenance: [
              {
                sourceType: "parsed_resume",
                sourceRef: "resume.employmentHistory",
                fieldPath: "resume.employmentHistory",
                label: "Resume employment history",
              },
            ],
          };
          unique.set(
            `${company}|${title}|${start}|${end}`.toLowerCase(),
            entry,
          );
        });
        const finalAccounting = section.match(
          new RegExp(
            `${dateRange}\\s+(Guocera.{2,160}?Industries\\s+Bhd)\\s+(Accountant\\s*(?:\\([^)]*\\))?)`,
            "i",
          ),
        );
        if (finalAccounting) {
          const start = clean(finalAccounting[1]);
          const end = clean(finalAccounting[2]);
          const company = clean(finalAccounting[3]);
          const title = cleanCandidateTitle(finalAccounting[4]);
          const entry: EnterpriseEmployment = {
            id: `resume-employment-${++careerIndex}`,
            company,
            title,
            titleAssociation: "employment_record",
            location: "",
            companyType: "",
            modules: [],
            achievements: [],
            start,
            end,
            duration: duration(start, end),
            current: false,
            provenance: [
              {
                sourceType: "parsed_resume",
                sourceRef: "resume.employmentHistory",
                fieldPath: "resume.employmentHistory",
                label: "Resume employment history",
              },
            ],
          };
          unique.set(
            `${company}|${title}|${start}|${end}`.toLowerCase(),
            entry,
          );
        }
      }
    }
  }
  if (!unique.size) {
    const title = cleanCandidateTitle(
      firstValue(sourceScopes, [
        "current_title",
        "currentTitle",
        "job_title",
        "jobTitle",
        "position",
        "role",
        "title",
      ]),
    );
    const company = firstText(sourceScopes, [
      "current_company",
      "currentCompany",
      "current_employer",
      "currentEmployer",
      "employer",
      "company",
      "organisation",
      "organization",
    ]);
    const location = firstText(sourceScopes, [
      "current_location",
      "currentLocation",
      "location",
      "country",
      "city",
    ]);
    const start = firstText(sourceScopes, [
      "current_role_start",
      "currentRoleStart",
      "employment_start",
      "employmentStart",
      "start_date",
      "startDate",
    ]);
    if (title || company) {
      const entry: EnterpriseEmployment = {
        id: "candidate-current-employment",
        company,
        title,
        location,
        companyType: "",
        modules: [],
        achievements: [],
        start,
        end: "",
        duration: "",
        current: true,
        provenance: [
          {
            sourceType: "candidate_field",
            sourceRef: "candidate.currentEmployment",
            fieldPath: "candidate.current_title/current_company",
            label: "Candidate current employment fields",
          },
        ],
      };
      unique.set(`${company}|${title}|${start}|`.toLowerCase(), entry);
    }
  }
  return [...unique.values()].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      dateYear(b.end || b.start) - dateYear(a.end || a.start),
  );
}

const RESUME_RESPONSIBILITIES = [
  "Business Blueprint",
  "Functional Specification",
  "Configuration",
  "Data Migration",
  "System Integration Test",
  "User Acceptance Test",
  "Unit Testing",
  "End-user Training",
  "Support",
  "Workshop",
  "Enhancement",
  "Electronic bank statement",
  "Integration with feeder applications",
  "Integration with other modules",
  "Integration with Point-Of-Sales system",
  "Sales and Distribution",
  "Project System",
  "Production Planning",
  "Integration with Weigh Bridge and Plantation Payroll System",
];

function resumeResponsibilities(value: string): string[] {
  const patterns = [
    "Business Blueprint",
    "Functional Specification",
    "Configuration",
    "Data Migration",
    "System Integration Test",
    "User Acceptance Test",
    "Unit Testing",
    "End-user Training",
    "Support",
    "Workshop",
    "Enhancement",
    "Electronic bank statement",
    "Integration with feeder applications",
    "Integration with other modules",
    "Integration with Point-Of-Sales system",
    "Sales and Distribution",
    "Project System",
    "Production Planning",
    "Integration with Weigh Bridge and Plantation Payroll System",
  ];
  return patterns
    .filter((item) =>
      new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(value),
    )
    .slice(0, 4);
}

const visibleCandidateSourceText = (value: string) =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function extractExplicitResponsibilityProjects(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const rawValue = firstValue(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const resumeText =
    typeof unwrap(rawValue) === "string"
      ? String(unwrap(rawValue))
          .normalize("NFKC")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
      : "";
  if (!resumeText) return [];
  const markers = [...resumeText.matchAll(/\bDATE\s*:/gi)];
  const dateValue =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\\s+(?:19|20)\\d{2}";
  return markers.flatMap((marker, index) => {
    const startIndex = marker.index || 0;
    const block = resumeText.slice(
      startIndex,
      markers[index + 1]?.index ?? resumeText.length,
    );
    const range = block.match(
      new RegExp(
        `^DATE\\s*:\\s*(${dateValue})\\s*[-\\u2013\\u2014]\\s*(${dateValue}|Present|Current)`,
        "i",
      ),
    );
    const client = clean(
      block.match(
        /\bCLIENT\s*:\s*([\s\S]{2,140}?)(?=\s+PROJECT\s+DESCRIPTION\s*:)/i,
      )?.[1] || "",
    );
    const description = clean(
      block.match(
        /\bPROJECT\s+DESCRIPTION\s*:\s*([\s\S]{2,240}?)(?=\s+RESPONSIBILIT(?:Y|IES)\s*:)/i,
      )?.[1] || "",
    );
    const responsibilityBlock = clean(
      block.match(/\bRESPONSIBILIT(?:Y|IES)\s*:\s*([\s\S]{2,220})/i)?.[1] || "",
    );
    const role = cleanCandidateTitle(
      responsibilityBlock.match(
        /\b(?:SAP\s+)?(?:FI\s*\/\s*CO|FICO|FI|CO)\s+(?:Team\s+)?(?:Member|Leader|Lead|Consultant|Analyst)(?:\s*\([^)]{1,100}\))?/i,
      )?.[0] ||
        responsibilityBlock.match(
          /\b(?:Senior\s+|Lead\s+)?SAP\s+[A-Z0-9/& -]{1,70}?(?:Consultant|Lead|Analyst|Manager)\b/i,
        )?.[0] ||
        "",
    );
    if (!range || !client || !description || !role) return [];
    const assignmentText = `${description} ${role}`;
    if (
      !/\b(?:re)?implement(?:ation|ed|ing)?\b|\bmigrat(?:ion|ed|ing)?\b|\b(?:conversion|rollout|support|upgrade|cutover|go-live|configuration|prototyping)\b/i.test(
        assignmentText,
      )
    )
      return [];
    const projectType = /\bmigrat|conversion/i.test(assignmentText)
      ? "Migration"
      : /\brollout/i.test(assignmentText)
        ? "Rollout"
        : /\bsupport/i.test(assignmentText)
          ? "Support"
          : /\bcutover|go-live/i.test(assignmentText)
            ? "Cutover"
            : "Implementation";
    const modules = stringList(
      assignmentText.match(
        /\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM)\b/gi,
      ) || [],
    );
    const sourceRef = `resume.explicitResponsibilityProjects.${index + 1}`;
    return [
      withProjectEvidence(
        {
          id: `explicit-responsibility-project-${index + 1}`,
          name: description,
          client,
          employer: "",
          industry: "",
          country: "",
          role,
          modules,
          projectType,
          implementationType: projectType,
          start: range[1],
          end: range[2],
          duration: projectDuration(range[1], range[2]),
          responsibilities: [
            visibleCandidateSourceText(
              `Project description: ${description}. Responsibility: ${role}.`,
            ),
          ],
          teamSize: null,
          environment: /\bECC\s*6(?:\.0)?\b/i.test(description)
            ? "SAP ERP ECC 6"
            : "",
        },
        "parsed_resume",
        sourceRef,
      ),
    ];
  });
}

export function legacyEmploymentTimelineForAudit(raw: CandidateSchemaRecord) {
  return normalizeEmploymentLegacy(scopes(raw));
}

function explicitCurrentRoleContext(sourceScopes: CandidateSchemaRecord[]) {
  let title = firstText(sourceScopes, [
    "current_title",
    "currentTitle",
    "job_title",
    "jobTitle",
  ]);
  let company = firstText(sourceScopes, [
    "current_company",
    "currentCompany",
    "current_employer",
    "currentEmployer",
  ]);
  const fused = title.match(
    /^(.{2,100}?\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant))\s+(?:in|at)\s+(.{2,140}?)\s+(?:form|from)?$/i,
  );
  if (
    fused &&
    /\b(?:sdn\s*bhd|pte\s*ltd|limited|ltd|inc|corporation|technology|solutions?|consulting|capgemini)\b/i.test(
      validEmploymentCompany(fused[2]),
    )
  ) {
    title = fused[1];
    company = company || fused[2];
  }
  if (!company) {
    const split = title.match(/^(.{2,120}?)\s+(?:—|–|-)\s+(.{2,140})$/);
    if (
      split &&
      /\b(?:sdn\.?\s*bhd\.?|pte\.?\s*ltd\.?|limited|ltd\.?|inc\.?|corporation|corp\.?|technology|solutions?)\b/i.test(
        split[2],
      )
    ) {
      title = split[1];
      company = split[2];
    }
  }
  return {
    title: validEmploymentTitle(title),
    company: validEmploymentCompany(company),
    location: firstText(sourceScopes, [
      "current_location",
      "currentLocation",
      "location",
      "country",
      "city",
    ]),
    start: firstText(sourceScopes, [
      "current_role_start",
      "currentRoleStart",
      "employment_start",
      "employmentStart",
      "start_date",
      "startDate",
    ]),
    end: firstText(sourceScopes, [
      "current_role_end",
      "currentRoleEnd",
      "employment_end",
      "employmentEnd",
      "end_date",
      "endDate",
    ]),
  };
}

function normalizeEmployment(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseEmployment[] {
  const records = recordLists(sourceScopes, [
    "experience",
    "experiences",
    "work_experience",
    "workExperience",
    "employment_history",
    "employmentHistory",
    "work_history",
    "workHistory",
    "career_history",
    "careerHistory",
    "professional_experience",
    "professionalExperience",
    "employment",
    "employmentExperience",
    "positions",
    "jobs",
    "roles",
  ]).map((record, index) => ({
    record,
    sourceRef: `candidate.employment.${index + 1}`,
  }));
  return canonicalEmploymentTimeline({
    structuredRecords: records,
    resumeText: firstText(sourceScopes, [
      "resume_text",
      "raw_text",
      "cv_text",
      "raw_cv",
    ]),
    currentRole: explicitCurrentRoleContext(sourceScopes),
  });
}

export function resolveCurrentEmployer(
  sourceScopes: CandidateSchemaRecord[],
  timeline: EnterpriseEmployment[],
): string {
  const explicitCurrentRecord = timeline.find(
    (item) => item.current && item.company,
  );
  if (explicitCurrentRecord) return explicitCurrentRecord.company;
  const explicitCurrentField =
    validEmploymentCompany(
      firstText(sourceScopes, [
        "current_company",
        "currentCompany",
        "current_employer",
        "currentEmployer",
        "current_organisation",
        "currentOrganisation",
        "current_organization",
        "currentOrganization",
      ]),
    ) || explicitCurrentRoleContext(sourceScopes).company;
  if (explicitCurrentField) return explicitCurrentField;
  const openEndedRecord = timeline.find(
    (item) => item.company && /present|current|now/i.test(item.end),
  );
  if (openEndedRecord) return openEndedRecord.company;
  return timeline.find((item) => item.company)?.company || "";
}

function plausiblePersonName(value: string) {
  const name = clean(value)
    .replace(/[<>]/g, "")
    .replace(/^NAME\s*:\s*/i, "")
    .replace(/^Name\s+/i, "")
    .replace(
      /\s+(?:Location|Goal|Objective|Position|Contact Info)\s*:?.*$/i,
      "",
    )
    .replace(/\s+is\s+a\s+seasoned.*$/i, "")
    .replace(/\s+(?:As|ERP|SD|ECE|Sr\.?|Mr\.?|Ms\.?|Executive|Around)$/i, "")
    .replace(/LamSAP$/i, "Lam")
    .replace(/[|(:]+$/g, "")
    .trim();
  if (
    /\b(?:Age|Experience|Company|Employer|Role|Position)\s*[:.-]?\s*$/i.test(
      name,
    )
  )
    return "";
  if (/\bminerals?\b/i.test(name)) return "";
  if (/\bsolutions?\b/i.test(name)) return "";
  if (
    /^(?:a|an)\s+(?:challenging|passionate|dedicated|resourceful|results-oriented|highly skilled|experienced|seasoned)\b/i.test(
      name,
    )
  )
    return "";
  if (
    /^(?:Ho Chi Minh(?: City)?|Kuala Lumpur|Petaling Jaya|Cyberjaya|Selangor|Singapore|Bangkok|Hanoi|Manila|Jakarta)$/i.test(
      name,
    )
  )
    return "";
  if (
    /[,;:]$|[!?]$|(?:\.$)/.test(name) ||
    /^(?:and|driving)\b/i.test(name) ||
    /\b(?:and|or|of|for|with)$/i.test(name) ||
    /\b(?:framework|hobbies|high-impact outcomes?)\b/i.test(name)
  )
    return "";
  if (
    name
      .split(/\s+/)
      .some((word) =>
        /^(?:sap|erp|fico|abap)$|(?:consult|manag|develop|engineer|project|implement|associate|architect)/i.test(
          word,
        ),
      )
  )
    return "";
  if (
    !name ||
    name.length > 100 ||
    /\d|@|https?:|\b(?:curriculum\s+vitae|résumé|resume|cv|special\s+skills|skills|summary|subject|email\s+subject|phone|mobile|professional|executive|references|internal use|mailing|native hana|personal|core|expertise|objective|qualifications?|education|experience|details|contact|matriculation|university|institution|kolej|sap|erp\s*implementation|consultant|profile|projects?|roll\s*out|rollout|services|solutions|technologies|consulting|travel|channel|industry|authorization|matrix|position\s+level|year\s+level|capital\s+market|subject|roles?\s+as|sdn\s*bhd|pte\s*ltd|limited|company|corporation|taman|jalan|street|road|candidate profile pending validation|name unavailable|accurate information|enhancements? and reports?|customer request|release strategy(?: in procurement)?)\b/i.test(
      name,
    ) ||
    /^(?:pt\.?|kone\b|global\b)/i.test(name)
  )
    return "";
  const words = name.split(/\s+/).filter(Boolean);
  const structuralHeadingWords = new Set([
    "cost",
    "allocation",
    "accounting",
    "configuration",
    "management",
    "process",
    "overview",
    "history",
    "background",
    "responsibilities",
    "achievements",
    "activities",
    "competencies",
  ]);
  if (
    words.length <= 4 &&
    words.every((word) => structuralHeadingWords.has(word.toLowerCase()))
  )
    return "";
  return words.length >= 2 && words.length <= 8 ? name : "";
}

export function isPlausibleCandidateName(value: unknown) {
  const candidate = clean(value);
  if (plausiblePersonName(candidate)) return true;
  return (
    /^[A-Za-zÀ-ž.'’-]{4,}$/.test(candidate) &&
    !/(?:sap|erp|fico|abap|consult|manag|develop|engineer|project|implement|associate|architect)/i.test(
      candidate,
    )
  );
}

function resolveCandidateName(sourceScopes: CandidateSchemaRecord[]) {
  const explicitValue = firstText(sourceScopes, [
    "person_name",
    "personName",
    "full_name",
    "fullName",
    "candidate_name",
    "display_name",
    "name",
  ]);
  const resume = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const labelledBoundary = explicitValue.match(
    /^(.+?)\s+(Age|Experience|Company|Employer|Role|Position)\s*[:.-]?\s*$/i,
  );
  const boundedValue = clean(labelledBoundary?.[1] || "");
  const boundedLabel = labelledBoundary?.[2] || "";
  const escapedBoundedValue = boundedValue.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const boundedPattern = boundedValue
    ? new RegExp(
        `\\bName\\s*:\\s*${escapedBoundedValue}\\s+${boundedLabel}\\s*:`,
        "i",
      )
    : null;
  const boundedOffset = boundedPattern ? resume.search(boundedPattern) : -1;
  const precedingBoundary =
    boundedOffset >= 0
      ? resume.slice(Math.max(0, boundedOffset - 100), boundedOffset)
      : "";
  const boundedExplicit =
    boundedOffset >= 0 && !/\b(?:referee|reference)\b/i.test(precedingBoundary)
      ? plausiblePersonName(boundedValue)
      : "";
  const explicit = boundedExplicit || plausiblePersonName(explicitValue);
  if (explicit) return explicit;
  const first = firstText(sourceScopes, [
    "first_name",
    "firstName",
    "given_name",
    "givenName",
  ]);
  const last = firstText(sourceScopes, [
    "last_name",
    "lastName",
    "family_name",
    "familyName",
    "surname",
  ]);
  const combined = plausiblePersonName(`${first} ${last}`);
  if (combined) return combined;
  const labelled =
    resume.match(
      /\b(?:Full\s+Name|Candidate\s+Name)\s*:\s*([^\r\n]{2,100})/i,
    )?.[1] ||
    resume.match(
      /(?:^|Personal Details:?|Personal Information:?|Summary of Personal Details:)\s*Name\s*:\s*([^\r\n]{2,100})/i,
    )?.[1] ||
    resume.match(/Resume\s+of\s*[<]?([^>\r\n]{2,100})[>]?/i)?.[1] ||
    "";
  const labelledName = plausiblePersonName(
    labelled.replace(
      /\s+(?:Year of Birth|Date of Birth|Date of birth|D\.O\.B|Age|Nationality|Gender|SUMMARY).*$/i,
      "",
    ),
  );
  if (labelledName) return labelledName;
  const repeatedHeaderName = plausiblePersonName(
    embeddedCvIdentityHeader(resume)?.name || "",
  );
  if (repeatedHeaderName) return repeatedHeaderName;
  let sourceHeader = resume.slice(0, 320).replace(/\s+/g, " ").trim();
  for (const word of [
    "EXPERIENCE",
    "SENIOR",
    "CONSULTANT",
    "PROFILE",
    "SUMMARY",
    "DETAILS",
  ]) {
    const spaced = word.split("").join("\\s+");
    sourceHeader = sourceHeader.replace(
      new RegExp(`\\b${spaced}\\b`, "gi"),
      word,
    );
  }
  sourceHeader = sourceHeader
    .replace(
      /^\s*(?:Page\s*\|?\s*\d+|\d+\s*\|?\s*Page|CURRICULUM VITAE|RESUME OF|RESUME|Sensitivity Label:\s*General|EXPERIENCE)\s*/i,
      "",
    )
    .trim();
  sourceHeader = sourceHeader.replace(/^ABOUT ME\s+/i, "");
  const repeatedPersonalName =
    sourceHeader.match(
      /^([A-ZÀ-Ž.'’-]{4,})\s+Personal Information\s+Name\s*:/i,
    )?.[1] || "";
  if (repeatedPersonalName) return repeatedPersonalName;
  const credentialHeaderName =
    sourceHeader.match(
      /^([A-ZÀ-Ž][A-ZÀ-Ž.'’ -]{3,80}?),\s*(?:ECE|CPA|PMP)\b/,
    )?.[1] || "";
  const supportedCredentialName = plausiblePersonName(credentialHeaderName);
  if (supportedCredentialName) return supportedCredentialName;
  const supportedSingleName =
    sourceHeader.match(
      /^([A-Za-zÀ-ž.'’-]{4,})\s+(?=SAP\b|Mobile\b|E-?mail\b|is\s+a\s+seasoned\b)/i,
    )?.[1] || "";
  if (
    supportedSingleName &&
    !/^(?:Professional|Executive|Personal|Experience|Summary|Profile|Senior)$/i.test(
      supportedSingleName,
    )
  )
    return supportedSingleName;
  const beforeStreetAddress =
    sourceHeader.match(
      /^([A-Za-zÀ-ž.'’/-]+(?:\s+[A-Za-zÀ-ž.'’/-]+){0,7})\s+(?:No\.?\s*\d+|\d{1,4}\s+[A-Za-z])/i,
    )?.[1] || "";
  const streetName = plausiblePersonName(beforeStreetAddress);
  if (streetName) return streetName;
  const afterPostalLocation =
    sourceHeader.match(
      /\b\d{5}\s+([A-Z][A-Z.'’ -]{3,80}?)(?=\s*\(|\s+SAP\b)/,
    )?.[1] || "";
  const postalName = plausiblePersonName(afterPostalLocation);
  if (postalName) return postalName;
  const narrativeName =
    resume.match(
      /\b([A-Z][a-zÀ-ž.'’-]+(?:\s+[A-Z][a-zÀ-ž.'’-]+){1,5})\s+has\s+(?:over|more|\w+)?\s*\d+/,
    )?.[1] || "";
  const supportedNarrativeName = plausiblePersonName(narrativeName);
  if (supportedNarrativeName) return supportedNarrativeName;
  const beforeEmail =
    sourceHeader.match(
      /^(.{2,140}?)\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )?.[1] || "";
  if (beforeEmail) {
    const candidate = beforeEmail
      .split(
        /\b(?:SAP|Senior|Certified|Consultant|Contact|Phone|Mobile|Email|E-mail|Profile|Summary|Career)\b/i,
      )[0]
      .trim();
    const emailName = plausiblePersonName(candidate);
    if (emailName) return emailName;
  }
  const roleBounded = sourceHeader
    .split(
      /\b(?:SAP|Senior|Certified|Solutions Advisor|Contact Details|Mobile(?:\s+No)?|Phone|Email|E-mail|PROFILE|SUMMARY|Career history|Address|Details Block)\b/i,
    )[0]
    .trim();
  const headerName = plausiblePersonName(roleBounded);
  if (headerName) return headerName;
  const beforeRole =
    sourceHeader.match(/^(.{2,160}?)\s+(?:Senior|SAP)\b/i)?.[1] || "";
  if (
    /\b(?:Matriculation|University|College|Kolej|Education)\b/i.test(beforeRole)
  ) {
    const trailingSource =
      beforeRole
        .split(/\b(?:Matriculation|University|College|Kolej|Education)\b/i)
        .pop()
        ?.trim() || "";
    const trailingName = trailingSource.split(/\s+/).slice(-2).join(" ");
    const supportedTrailingName = plausiblePersonName(trailingName);
    if (supportedTrailingName) return supportedTrailingName;
  }
  const embeddedBeforeEmail =
    sourceHeader.match(
      /(?:^|[:|])\s*([A-Za-zÀ-ž][A-Za-zÀ-ž.'’,-]*(?:\s+[A-Za-zÀ-ž][A-Za-zÀ-ž.'’,-]*){1,7})\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )?.[1] || "";
  return plausiblePersonName(embeddedBeforeEmail);
}

function cleanResumeClient(value: string) {
  let client = value;
  for (const responsibility of RESUME_RESPONSIBILITIES)
    client = client.replace(
      new RegExp(responsibility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      " ",
    );
  return client
    .replace(/^[:;,\s]+/, "")
    .replace(
      /^(?:responsibilities?[:\-]*|and|with|GST|T|nfiguration|nd-user)\s+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function candidateExtractionSection(
  values: readonly unknown[],
  sourceScopes: CandidateSchemaRecord[],
  cuePattern: RegExp,
  sourceRef: string,
): CandidateExtractionSection {
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const cue = clean(resumeText.match(cuePattern)?.[0] || "").slice(0, 600);
  const sourceAvailable =
    Boolean(resumeText) ||
    sourceScopes.some((scope) =>
      Object.keys(scope).some(
        (key) =>
          !["id", "candidate_id", "created_at", "updated_at"].includes(key) &&
          scope[key] !== null &&
          scope[key] !== "",
      ),
    );
  const attemptedRoutes = sourceRef.includes("experience")
    ? [
        "structured_employment_arrays",
        "legacy_employment_shapes",
        "resume_employment_sections",
        "current_employment_fields",
      ]
    : [
        "structured_project_arrays",
        "legacy_assignment_shapes",
        "resume_project_sections",
        "employment_description_projects",
      ];
  return {
    status: values.length
      ? "extracted"
      : !sourceAvailable
        ? "source_unavailable"
        : "genuinely_none",
    version: CANDIDATE_CANONICAL_VERSION,
    sourceRef: cue ? sourceRef : resumeText ? "resume.inspected" : "",
    fallbackExcerpt: values.length ? "" : cue,
    attemptedRoutes,
    failureReason: "",
    retryable: false,
  };
}

function normalizeResumeProjects(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const safeFallback = (pattern: RegExp) => {
    const match = resumeText.match(pattern)?.[0] || "";
    return clean(match).slice(0, 600);
  };
  const experienceCue = safeFallback(
    /(?:employment|experience|career|internship|trainee|apprentice|volunteer)[\s\S]{0,560}/i,
  );
  const projectCue = safeFallback(
    /(?:projects?|implementation|rollout|migration|upgrade|support|capstone)[\s\S]{0,560}/i,
  );
  const extractionSection = (
    values: readonly unknown[],
    cue: string,
    sourceRef: string,
  ): CandidateExtractionSection => ({
    status: values.length
      ? "extracted"
      : !resumeText
        ? "source_unavailable"
        : "genuinely_none",
    version: CANDIDATE_CANONICAL_VERSION,
    sourceRef: cue ? sourceRef : resumeText ? "resume.inspected" : "",
    fallbackExcerpt: values.length ? "" : cue,
    attemptedRoutes: sourceRef.includes("experience")
      ? ["resume_experience"]
      : ["resume_projects"],
    failureReason: "",
    retryable: false,
  });
  const section =
    resumeText
      .match(/PROJECT PROJECT RESPONSIBILITIES([\s\S]*)/i)?.[1]
      ?.replace(/PROJECT PROJECT RESPONSIBILITIES/gi, " ") || "";
  if (!section) return [];
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const pattern = new RegExp(
    `([A-Z][A-Za-z0-9&.,()'\\/ –—-]{2,500}?)\\s+(${month}\\s+\\d{4})\\s*[–—-]\\s*(${month}\\s+\\d{4}|Present)\\s+(SAP\\s+.{2,100}?)\\s+Responsibilities:-\\s*(.*?)(?=[A-Z][A-Za-z0-9&.,()'\\/ –—-]{2,500}?\\s+${month}\\s+\\d{4}\\s*[–—-]\\s*(?:${month}\\s+\\d{4}|Present)\\s+SAP\\s+|$)`,
    "gi",
  );
  const projects: EnterpriseProject[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section))) {
    const clientText = clean(match[1]);
    const inheritedResponsibilities = resumeResponsibilities(clientText);
    if (projects.length && inheritedResponsibilities.length)
      projects[projects.length - 1].responsibilities =
        inheritedResponsibilities;
    const industry = clientText.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || "";
    const cleanedClient = cleanResumeClient(
      clientText.replace(/\s*\([^)]+\)\s*$/, ""),
    );
    const client = cleanedClient
      .replace(/\s+[–—]\s+.*$/, "")
      .replace(/^(?:and|with|GST)\s+/i, "")
      .trim();
    const start = clean(match[2]);
    const end = clean(match[3]);
    const role = clean(match[4]);
    const responsibilityText = clean(match[5]);
    const typeEvidence = `${role} ${responsibilityText}`;
    const projectType = /\brollout\b/i.test(typeEvidence)
      ? "Rollout"
      : /\bmigration\b/i.test(typeEvidence)
        ? "Migration"
        : /\bams\b/i.test(typeEvidence)
          ? "AMS"
          : /\bsupport\b/i.test(typeEvidence)
            ? "Support"
            : /\bimplementation\b/i.test(typeEvidence)
              ? "Implementation"
              : "";
    let modules = stringList([
      ...(typeEvidence.match(
        /\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM)\b/gi,
      ) || []),
    ]);
    if (modules.some((item) => /^FICO$/i.test(item)))
      modules = modules.filter((item) => !/^(FI|CO)$/i.test(item));
    const environment = /S\/4\s*HANA|S4HANA/i.test(typeEvidence)
      ? "S/4HANA"
      : /\bECC\b/i.test(typeEvidence)
        ? "ECC"
        : /Public Cloud/i.test(typeEvidence)
          ? "Public Cloud"
          : /Private Cloud/i.test(typeEvidence)
            ? "Private Cloud"
            : "";
    if (!client || client.split(/\s+/).length > 12) continue;
    projects.push(
      withProjectEvidence(
        {
          id: "resume-project-" + (projects.length + 1),
          name: "",
          client,
          employer: "",
          industry,
          country: "",
          role,
          modules,
          projectType,
          implementationType: projectType,
          start,
          end,
          duration: projectDuration(start, end),
          responsibilities: resumeResponsibilities(responsibilityText),
          teamSize: null,
          environment,
        },
        "parsed_resume",
        "resume.projects." + (projects.length + 1),
      ),
    );
  }
  return projects;
}
function narrativeProjects(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const rawValue = firstValue(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const completeResumeText =
    typeof unwrap(rawValue) === "string" ? String(unwrap(rawValue)) : "";
  if (!completeResumeText) return [];
  if (
    /\bCompany\s+Name\s*:[\s\S]*\bProject\s+Duration\s*:/i.test(
      completeResumeText,
    )
  )
    return [];
  const explicitProjectHeading = completeResumeText.search(
    /(?:^|\n)\s*(?:PROJECT\s+PROFILE|PROJECT\s+HISTORY|PROJECT\s+EXPERIENCE(?:S)?)\s*:?/im,
  );
  const projectBounded =
    explicitProjectHeading >= 0
      ? completeResumeText
          .slice(explicitProjectHeading)
          .replace(
            /^[\s\S]*?(?:PROJECT\s+PROFILE|PROJECT\s+HISTORY|PROJECT\s+EXPERIENCE(?:S)?)\s*:?/i,
            "",
          )
      : completeResumeText;
  const nextSection = projectBounded.search(
    /(?:^|\n)\s*(?:EDUCATION|ACADEMIC QUALIFICATIONS?|CERTIFICATIONS?|TECHNICAL SKILLS?|CORE SKILLS?|LANGUAGES?|PERSONAL DETAILS|CONTACT DETAILS|REFERENCES?)\s*:?/im,
  );
  const resumeText =
    nextSection >= 0 ? projectBounded.slice(0, nextSection) : projectBounded;
  const lifecycle =
    /\b(?:implementation|rollout|roll-out|migration|upgrade|deployment|integration|support|enhancement|transformation|greenfield|brownfield|cutover|go-live|go live)\b/i;
  const delivery =
    /\b(?:implemented|delivered|configured|migrated|deployed|integrated|rolled out|cutover|go-live|supported|enhanced|provid(?:e|ed|ing)\s+(?:functional|application|production)|troubleshoot(?:ing)?|break\s*\/\s*fix)\b/i;
  const excludedSection =
    /^\s*(?:profile|professional summary|profile summary|career summary|skills?|core skills?|technical skills?|expertise|competencies|knowledge|tools?|capabilities)\b/i;
  const namedAssignmentAnchor = (value: string) =>
    /\b(?:client|customer|project|programme?|assignment)\s*[:\-\u2013\u2014]\s*[A-Za-z0-9][^.;|]{2,120}/i.test(
      value,
    );
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const fragments = resumeText
    .split(/(?:\r?\n){1,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((value) => visibleCandidateSourceText(value));
  const groupedSegments: string[] = [];
  for (const fragment of fragments) {
    if (!fragment) continue;
    if (namedAssignmentAnchor(fragment) || !groupedSegments.length)
      groupedSegments.push(fragment);
    else if (
      /^(?:specific\s+responsibilities|responsibilities|role\s+as|position\s*:|report(?:ed|ing)?\s+to|provid(?:e|ed|ing)|assist(?:ed|ing)?|monitor(?:ed|ing)?|handl(?:e|ed|ing)|configur(?:e|ed|ing))\b/i.test(
        fragment,
      ) &&
      groupedSegments[groupedSegments.length - 1].length + fragment.length <
        1200
    )
      groupedSegments[groupedSegments.length - 1] += ` ${fragment}`;
    else groupedSegments.push(fragment);
  }
  const segments = groupedSegments.filter((value) => {
    if (
      value.length < 24 ||
      value.length > 1200 ||
      !lifecycle.test(value) ||
      !delivery.test(value) ||
      excludedSection.test(value)
    )
      return false;
    const hasNamedAnchor = namedAssignmentAnchor(value);
    // A dated employment Role/Position block is not a project merely because its
    // responsibilities happen to mention "projects". The assignment boundary
    // must be explicit in this same source fragment.
    return hasNamedAnchor;
  });
  const unique = [
    ...new Map(segments.map((value) => [value.toLowerCase(), value])).values(),
  ]
    .filter((excerpt) => lifecycle.test(excerpt) && delivery.test(excerpt))
    .slice(0, 40);
  const stableAssignmentId = (value: string) => {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };
  return unique.map((segment, index) => {
    const projectType = /\broll(?:out|-out|ed out)\b/i.test(segment)
      ? "Rollout"
      : /\bmigrat/i.test(segment)
        ? "Migration"
        : /\bintegrat/i.test(segment)
          ? "Integration"
          : /\btransform/i.test(segment)
            ? "Transformation"
            : /\bdeploy/i.test(segment)
              ? "Deployment"
              : /\b(?:support|enhanc)/i.test(segment)
                ? "Support / Enhancement"
                : "Implementation";
    const rawClient = clean(
      segment.match(
        /\b(?:client|customer)\s*[:\-\u2013\u2014]\s*([\s\S]{2,160}?)(?=\s+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2}|(?:company|duration|position|role|project|system|year|highlights?|specific\s+responsibilities)\s*[:\-\u2013\u2014(])|\s*\(|[.;]|$)/i,
      )?.[1] || "",
    ).replace(
      /\s*-\s*(?:Plantation|Manufacturing|Banking|Energy|Retail)\s+Industry$/i,
      "",
    );
    let name = clean(
      segment.match(
        /\b(?:projects?|program(?:me)?)\s*[:\-]\s*([\s\S]{2,180}?)(?=\s+(?:role|client|system|year|highlights?|project\s+duration)\s*:|[.;|]|$)/i,
      )?.[1] || "",
    );
    let client = rawClient;
    const clientParts = rawClient.split("|").map(clean).filter(Boolean);
    if (!name && /^project\b/i.test(clientParts[0] || "")) {
      name = clientParts.shift() || "";
      client = clean(clientParts.join(" | "));
    }
    const deploymentName = clean(
      segment.match(
        /\b((?:SAP|ERP)[\s\S]{2,150}?\bproject)\s+Client\s*[-:\u2013\u2014]/i,
      )?.[1] || "",
    );
    const parentheticalProject = clean(
      segment.match(
        /\bClient\s*[-:\u2013\u2014]\s*[^()]{2,140}\(\s*([^)]*\b(?:deployment|implementation|rollout|migration|upgrade)\b[^)]*)\)/i,
      )?.[1] || "",
    );
    if (!name && deploymentName)
      name = [
        deploymentName
          .replace(/^.*?\([^)]*(?:19|20)\d{2}[^)]*\)\s*/, "")
          .replace(/\bproject\b/i, "Project"),
        parentheticalProject.replace(/([A-Za-z0-9])[-–—]\s+/, "$1 "),
      ]
        .filter(Boolean)
        .join(" – ")
        .replace(/\s+/g, " ");
    let employer = validEmploymentCompany(
      segment.match(
        /\b(?:company|employer)\s*:\s*([\s\S]{2,140}?)(?=\s+(?:position|role|client|project|duration|specific\s+responsibilities)\s*[:\u2013\u2014-]|[.;|]|$)/i,
      )?.[1] || "",
    );
    const explicitEmployerLabel = /\bemployer\s*:/i.test(segment);
    const companyClientLabel = /\bcompany\s+client\s*:/i.test(segment);
    const sameOrganization =
      client && employer
        ? (() => {
            const clientAliases = assignmentOrganizationAliases(client);
            const employerAliases = assignmentOrganizationAliases(employer);
            return (
              [...clientAliases].some((value) => employerAliases.has(value)) ||
              assignmentTokenOverlap(client, employer) >= 0.72
            );
          })()
        : false;
    // In a project-history record, `Company client` identifies the customer.
    // A separate Company value is an employer only when a distinct Client is
    // also present (as in the Accenture / Exxon source record), or when the
    // source explicitly labels it Employer.
    if (
      !explicitEmployerLabel &&
      (companyClientLabel || !rawClient || sameOrganization)
    )
      employer = "";
    const inlineTeamRole = segment.match(
      /\b(?:FICO|FI\s*\/\s*CO)\s*[–—-]\s*((?:Senior\s+|Lead\s+)?Team\s+(?:Member|Lead(?:er)?))/i,
    )?.[1];
    const role = cleanCandidateTitle(
      (
        segment.match(
          /\b(?:role|position)\s*:\s*([\s\S]{2,120}?)(?=\s+(?:(?:specific\s+)?responsibilities?|application|project|client|system|year|duration|highlights?)\s*[:(]?|[.;|]|$)/i,
        )?.[1] ||
        segment.match(
          /\brole\s+as\s+([\s\S]{2,100}?\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant))(?:\s*[-–—]\s*Application)?(?=\s+(?:during|for|on|in|with|and|to|$))/i,
        )?.[1] ||
        (inlineTeamRole ? `FICO ${inlineTeamRole}` : "")
      ).replace(
        /\s*\(\s*SAP\s+(?:implementation|rollout|support|migration)[\s\S]*$/i,
        "",
      ),
    );
    const explicitRange = segment.match(
      /\b(?:Project\s+)?Duration\s*:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})|Present|Current)/i,
    );
    const clientRange = segment.match(
      new RegExp(
        `\\bClient\\s*[-:\\u2013\\u2014][^()]{2,220}\\(\\s*(${month}\\s+(?:19|20)\\d{2})\\s*[-\\u2013\\u2014]\\s*(${month}\\s+(?:19|20)\\d{2}|Present|Current)\\s*\\)`,
        "i",
      ),
    );
    const sharedYearRange = segment.match(
      /\(\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s*(?:to|[-\u2013\u2014])\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+((?:19|20)\d{2})\s*\)/i,
    );
    const inlineRange = segment.match(
      new RegExp(
        `\\b(${month}\\s+(?:19|20)\\d{2})\\s*[-\\u2013\\u2014]\\s*(${month}\\s+(?:19|20)\\d{2}|Present|Current)\\b`,
        "i",
      ),
    );
    const years = segment.match(
      /\bYear\s*:\s*((?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:19|20)\d{2})/i,
    );
    const start =
      explicitRange?.[1] ||
      clientRange?.[1] ||
      (sharedYearRange ? `${sharedYearRange[1]} ${sharedYearRange[3]}` : "") ||
      inlineRange?.[1] ||
      years?.[1] ||
      "";
    const end =
      explicitRange?.[2] ||
      clientRange?.[2] ||
      (sharedYearRange ? `${sharedYearRange[2]} ${sharedYearRange[3]}` : "") ||
      inlineRange?.[2] ||
      years?.[2] ||
      "";
    let modules = stringList(
      segment.match(
        /\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM|FSCM|BCM|COPC)\b/gi,
      ) || [],
    );
    if (modules.some((item) => /^FICO$/i.test(item)))
      modules = modules.filter((item) => !/^(FI|CO)$/i.test(item));
    const assignmentAnchor =
      clean(`${client}|${name}`).toLowerCase().replace(/^\|$/, "") || segment;
    const assignmentId = `resume-narrative-assignment-${stableAssignmentId(assignmentAnchor)}`;
    const sourceRef = `resume.narrativeProjects.${index + 1}`;
    return withProjectEvidence(
      {
        id: assignmentId,
        name,
        client,
        employer,
        industry: "",
        country: "",
        role,
        modules,
        projectType,
        implementationType: projectType,
        start,
        end,
        duration: start && end ? projectDuration(start, end) : null,
        responsibilities: [segment],
        teamSize: null,
        environment: "",
      },
      "parsed_resume",
      sourceRef,
    );
  });
}
function labelledWorkingExperienceProjects(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const rawValue = firstValue(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const resumeText =
    typeof unwrap(rawValue) === "string"
      ? String(unwrap(rawValue))
          .normalize("NFKC")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
      : "";
  if (!resumeText) return [];
  const starts = [...resumeText.matchAll(/\bCompany\s+Name\s*:/gi)].map(
    (match) => match.index || 0,
  );
  return starts.flatMap((start, index) => {
    const block = resumeText.slice(
      start,
      starts[index + 1] ?? resumeText.length,
    );
    const employerHeader = block.match(
      /^Company\s+Name\s*:\s*(.{2,120}?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})|Present|Current)\s+Work\s+Description/i,
    );
    if (!employerHeader) return [];
    const client = clean(
      block.match(
        /\bClient\s*:\s*([\s\S]{2,140}?)(?=\s+Project\s*:|\s+Project\s+Duration\s*:|\s+(?:Project\s+)?Role\s*:|$)/i,
      )?.[1] || "",
    );
    const name = clean(
      block.match(
        /\bProject\s*:\s*([\s\S]{2,140}?)(?=\s+Project\s+Duration\s*:|\s+(?:Project\s+)?Role\s*:|$)/i,
      )?.[1] || "",
    );
    const range = block.match(
      /\bProject\s+Duration\s*:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})|Present|Current)/i,
    );
    const role = cleanCandidateTitle(
      block.match(
        /\b(?:Project\s+)?Role\s*:\s*((?:(?:Senior|Junior|Lead|Principal|Managing|Chief)\s+)*(?:SAP\s+)?[A-Za-z0-9/& -]{0,80}?(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Accountant|Programmer)(?:\s*\([^)]{1,60}\))?)/i,
      )?.[1] || "",
    );
    const roleIndex = block.search(/\b(?:Project\s+)?Role\s*:/i);
    const responsibilities =
      roleIndex >= 0
        ? resumeResponsibilities(
            block
              .slice(roleIndex)
              .replace(/^.*?\b(?:Project\s+)?Role\s*:\s*[^.]{2,120}/i, ""),
          )
        : [];
    const assignmentText = `${name} ${client} ${role} ${responsibilities.join(" ")}`;
    const supportedDuration = range
      ? projectDuration(range[1], range[2])
      : null;
    if (
      !(name || client) ||
      !role ||
      !range ||
      !supportedDuration ||
      !/\b(?:implement|rollout|migration|conversion|support|upgrade|cutover|go-live|reconciliation|configuration|development)\b/i.test(
        assignmentText,
      )
    )
      return [];
    const projectType = /\brollout|roll-out/i.test(assignmentText)
      ? "Rollout"
      : /\bmigrat|conversion/i.test(assignmentText)
        ? "Migration"
        : /\bcutover|go-live/i.test(assignmentText)
          ? "Cutover"
          : /\bsupport/i.test(assignmentText)
            ? "Support"
            : /\bupgrade/i.test(assignmentText)
              ? "Upgrade"
              : "Implementation";
    const modules = stringList(
      assignmentText.match(
        /\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM)\b/gi,
      ) || [],
    );
    return [
      withProjectEvidence(
        {
          id: `labelled-project-${index + 1}`,
          name,
          client,
          employer: validEmploymentCompany(employerHeader[1]),
          industry: "",
          country: "",
          role,
          modules,
          projectType,
          implementationType: projectType,
          start: range[1],
          end: range[2],
          duration: supportedDuration,
          responsibilities,
          teamSize: null,
          environment: "",
        },
        "parsed_resume",
        `resume.labelledProjects.${index + 1}`,
      ),
    ];
  });
}

function inlineClientAssignmentProjects(
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const rawValue = firstValue(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const source =
    typeof unwrap(rawValue) === "string"
      ? String(unwrap(rawValue))
          .normalize("NFKC")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
      : "";
  if (!source) return [];
  const sourceHasRepeatedIdentityBoundary = Boolean(
    embeddedCvIdentityHeader(source),
  );
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const employmentPattern = new RegExp(
    `([^.!?—–]{2,120}?\\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Head of ERP))\\s*[—–]\\s*(.{2,140}?)\\s*\\((${month}\\s+(?:19|20)\\d{2})\\s*[—–-]\\s*(${month}\\s+(?:19|20)\\d{2}|Present|Current)\\)`,
    "gi",
  );
  const employmentMatches = [...source.matchAll(employmentPattern)];
  const projects: EnterpriseProject[] = [];
  employmentMatches.forEach((employment, employmentIndex) => {
    const blockStart = (employment.index || 0) + employment[0].length;
    const blockEnd =
      employmentMatches[employmentIndex + 1]?.index ?? source.length;
    const block = source.slice(blockStart, blockEnd);
    const clientPattern = new RegExp(
      `\\bClient\\s*:\\s*([\\s\\S]{2,180}?)\\s*\\((${month}\\s+(?:19|20)\\d{2})\\s*[—–-]\\s*(${month}\\s+(?:19|20)\\d{2}|Present|Current)\\)\\s*([\\s\\S]*?)(?=\\s+Client\\s*:|$)`,
      "gi",
    );
    for (const [clientIndex, match] of [
      ...block.matchAll(clientPattern),
    ].entries()) {
      const rawClient = clean(match[1]);
      const pieces = rawClient.split("|").map(clean).filter(Boolean);
      const name = /^project\b/i.test(pieces[0] || "")
        ? pieces.shift() || ""
        : "";
      const client = clean(pieces.join(" | ") || rawClient);
      let responsibilitySource = clean(match[4]);
      const responsibilityHeader =
        embeddedCvIdentityHeader(responsibilitySource);
      // This extractor exists specifically for a repeated-CV-header boundary.
      // Ordinary employment text containing a dated Client line is handled by
      // the explicit project/engagement extractors and must not be promoted
      // globally into a score-bearing assignment.
      if (!responsibilityHeader && !sourceHasRepeatedIdentityBoundary) continue;
      if (responsibilityHeader)
        responsibilitySource = clean(
          responsibilitySource.slice(0, responsibilityHeader.start),
        );
      const redactedHeaderStart = responsibilitySource.search(
        /(?:^|[.!?]\s+)[A-Z][A-Z'’-]{1,}(?:\s+[A-Z][A-Z'’-]{1,}){1,6}\s+(?=(?:SAP|ERP|Senior|Project)\b[^|]{2,100}\|[^|]{2,100}\|)/,
      );
      if (redactedHeaderStart >= 0)
        responsibilitySource = clean(
          responsibilitySource.slice(0, redactedHeaderStart),
        );
      const responsibilities = responsibilitySource
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
        .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
        .split(/(?<=[.!?])\s+/)
        .map((item) => visibleCandidateSourceText(item))
        .filter((item) => item.length >= 12 && !embeddedCvIdentityHeader(item));
      const assignmentText = `${name} ${client} ${employment[1]} ${responsibilities.join(" ")}`;
      if (
        !client ||
        !responsibilities.length ||
        !/\b(?:implement|rollout|migration|conversion|support|upgrade|cutover|go-live|configuration|testing|enhancement|delivery|led|migrated|configured)\b/i.test(
          assignmentText,
        )
      )
        continue;
      const projectType = /\brollout|roll-out/i.test(assignmentText)
        ? "Rollout"
        : /\bmigrat|conversion/i.test(assignmentText)
          ? "Migration"
          : /\bsupport|enhanc/i.test(assignmentText)
            ? "Support / Enhancement"
            : "Implementation";
      const modules = stringList(
        assignmentText.match(
          /\b(?:FICO|FI|CO|MM|SD|PP|PS|BW|BI|HCM|SuccessFactors|Ariba|TRM)\b/gi,
        ) || [],
      );
      projects.push(
        withProjectEvidence(
          {
            id: `inline-client-assignment-${employmentIndex + 1}-${clientIndex + 1}`,
            name,
            client,
            employer: validEmploymentCompany(employment[2]),
            industry: "",
            country: "",
            role: resumeRoleForProject(employment[1]),
            modules,
            projectType,
            implementationType: projectType,
            start: match[2],
            end: match[3],
            duration: projectDuration(match[2], match[3]),
            responsibilities,
            teamSize: null,
            environment: /S\/4\s*HANA|S4HANA/i.test(assignmentText)
              ? "S/4HANA"
              : /\bECC\b/i.test(assignmentText)
                ? "ECC"
                : "",
          },
          "parsed_resume",
          `resume.inlineClientAssignments.${employmentIndex + 1}.${clientIndex + 1}`,
        ),
      );
    }
  });
  return projects;
}

function resumeRoleForProject(input: string) {
  return cleanCandidateTitle(
    clean(input).replace(
      /^.*?(?=(?:Senior|Junior|Lead|Principal|Managing|Chief|SAP|Project Manager))/i,
      "",
    ),
  );
}

function normalizeProjects(
  raw: CandidateSchemaRecord,
  sourceScopes: CandidateSchemaRecord[],
): EnterpriseProject[] {
  const records = recordLists(sourceScopes, [
    "projects",
    "project_experience",
    "projectExperience",
    "implementation_projects",
    "rollout_projects",
    "ams_projects",
    "support_projects",
    "assignments",
    "client_assignments",
    "clientAssignments",
    "engagements",
    "programs",
    "implementations",
  ]);
  const output: EnterpriseProject[] = records.map((item, index) => {
    const location = firstText(
      [item],
      ["country", "location", "city", "region"],
    );
    const companyType = firstText(
      [item],
      ["company_type", "companyType", "employment_type", "organization_type"],
    );
    const modules = allStrings(
      [item],
      ["modules", "module", "sap_modules", "sapModules", "key_modules"],
    );
    const achievements = allStrings(
      [item],
      [
        "achievements",
        "key_achievements",
        "highlights",
        "responsibilities",
        "description",
        "summary",
      ],
    ).slice(0, 3);
    const start = firstText(
      [item],
      ["start_date", "startDate", "from", "start"],
    );
    const end = firstText([item], ["end_date", "endDate", "to", "end"]);
    return withProjectEvidence(
      {
        id: firstText([item], ["id", "project_id"]) || `project-${index + 1}`,
        name: firstText([item], ["project_name", "name", "project", "title"]),
        client: firstText([item], ["client", "customer", "account"]),
        employer: validEmploymentCompany(
          firstText([item], ["employer", "company", "delivery_company"]),
        ),
        industry: firstText([item], ["industry", "sector", "domain"]),
        country: firstText([item], ["country", "location", "region"]),
        role: firstText([item], ["role", "position", "title"]),
        modules: allStrings(
          [item],
          ["module", "modules", "sap_module", "sap_modules"],
        ),
        projectType: firstText([item], ["project_type", "projectType", "type"]),
        implementationType: firstText(
          [item],
          ["implementation_type", "implementationType", "delivery_type"],
        ),
        start,
        end,
        duration: projectDuration(start, end, firstText([item], ["duration"])),
        responsibilities: allStrings(
          [item],
          [
            "responsibilities",
            "responsibility",
            "description",
            "scope",
            "achievements",
          ],
        ),
        teamSize: numeric(
          [item],
          ["team_size", "teamSize", "team_members", "team_count"],
        ),
        environment: firstText(
          [item],
          ["environment", "platform", "landscape", "system", "deployment"],
        ),
      },
      "project",
      "projects." + (index + 1),
      Boolean(firstText([item], ["duration"])),
    );
  });
  output.push(...normalizeResumeProjects(sourceScopes));
  output.push(...labelledWorkingExperienceProjects(sourceScopes));
  output.push(...inlineClientAssignmentProjects(sourceScopes));
  output.push(...extractExplicitResponsibilityProjects(sourceScopes));
  output.push(...narrativeProjects(sourceScopes));
  const canonical = canonicalizeEnterpriseProjects(
    output.filter((project) => project.name || project.client),
  );
  return canonicalizeEnterpriseProjects(
    enrichNamedClientProjectFields(canonical, sourceScopes),
  ).sort((a, b) => dateYear(b.end || b.start) - dateYear(a.end || a.start));
}

function enrichNamedClientProjectFields(
  projects: readonly EnterpriseProject[],
  sourceScopes: CandidateSchemaRecord[],
) {
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]).replace(/\s+/g, " ");
  if (!resumeText) return [...projects];
  const month =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const pattern = new RegExp(
    `\\bClient\\s*:\\s*(Project\\s+[^|]{2,140}?)\\s*\\|\\s*([^()]{2,140}?)(?:\\s*\\((${month}\\s+(?:19|20)\\d{2})\\s*[-\\u2013\\u2014]\\s*(${month}\\s+(?:19|20)\\d{2})\\))?(?=\\s+(?:Led|Provided|Implemented|Directed|Migrated|Configured|Senior|SAP|Project\\s+Manager)|[.;]|$)`,
    "gi",
  );
  const named = [...resumeText.matchAll(pattern)].map((match, index) => {
    const prefix = resumeText.slice(
      Math.max(0, (match.index || 0) - 260),
      match.index || 0,
    );
    const employment = prefix.match(
      /([^.!?]{2,120}?\b(?:Consultant|Manager|Lead|Developer|Analyst|Engineer|Officer|Head of ERP))\s*[—–-]\s*([^()]{2,140}?)\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*$/i,
    );
    return {
      name: clean(match[1]),
      client: clean(match[2]),
      employer: validEmploymentCompany(employment?.[2] || ""),
      role: cleanCandidateTitle(employment?.[1] || ""),
      start: clean(match[3]),
      end: clean(match[4]),
      sourceRef: `resume.namedClientProject.${index + 1}`,
      excerpt: clean(`${employment?.[0] || ""} ${match[0]}`),
    };
  });
  return projects.map((project) => {
    const match = named.find(
      (entry) =>
        (!project.name ||
          normalizedAssignmentAnchor(project.name) ===
            normalizedAssignmentAnchor(entry.name) ||
          assignmentTokenOverlap(project.name, entry.name) >= 0.65) &&
        (!project.client ||
          assignmentTokenOverlap(project.client, entry.client) >= 0.65),
    );
    if (!match) return project;
    return {
      ...project,
      name: project.name || match.name,
      client: project.client || match.client,
      employer: project.employer || match.employer,
      role: project.role || match.role,
      start: match.start || project.start,
      end: match.end || project.end,
      duration:
        match.start && match.end
          ? projectDuration(match.start, match.end)
          : project.duration,
      fieldEvidence: {
        ...project.fieldEvidence,
        name: project.fieldEvidence.name?.value
          ? project.fieldEvidence.name
          : directProjectField(
              match.name,
              `${match.sourceRef}.name`,
              "parsed_resume",
              match.excerpt,
            ),
        client: project.fieldEvidence.client?.value
          ? project.fieldEvidence.client
          : directProjectField(
              match.client,
              `${match.sourceRef}.client`,
              "parsed_resume",
              match.excerpt,
            ),
        employer: project.fieldEvidence.employer?.value
          ? project.fieldEvidence.employer
          : directProjectField(
              match.employer,
              `${match.sourceRef}.employer`,
              "parsed_resume",
              match.excerpt,
            ),
        role: project.fieldEvidence.role?.value
          ? project.fieldEvidence.role
          : directProjectField(
              match.role,
              `${match.sourceRef}.role`,
              "parsed_resume",
              match.excerpt,
            ),
        dates:
          match.start && match.end
            ? directProjectField(
                [match.start, match.end],
                `${match.sourceRef}.dates`,
                "parsed_resume",
                match.excerpt,
              )
            : project.fieldEvidence.dates,
      },
    };
  });
}

function resumeSection(
  sourceScopes: CandidateSchemaRecord[],
  heading: RegExp,
  followingHeadings: string[],
): string {
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "raw_cv",
  ]);
  if (!resumeText) return "";
  const boundary = followingHeadings.join("|");
  return clean(
    resumeText.match(
      new RegExp(
        "\\b(?:" +
          heading.source +
          ")(?:\\b|(?=[A-Z]))\\s*([\\s\\S]*?)(?=\\b(?:" +
          boundary +
          ")(?:\\b|(?=[A-Z]))|$)",
        "i",
      ),
    )?.[1] || "",
  );
}

function normalizeProfessionalSummary(
  sourceScopes: CandidateSchemaRecord[],
): string {
  const structured = firstText(sourceScopes, [
    "professional_summary",
    "professionalSummary",
    "profile_summary",
    "profileSummary",
    "career_summary",
    "careerSummary",
    "about",
  ]);
  const topLevelSummary = firstText(sourceScopes.slice(0, 1), ["summary"]);
  const section = resumeSection(
    sourceScopes,
    /PROFESSIONAL SUMMARY|PROFILE SUMMARY|CAREER SUMMARY|PROFESSIONAL PROFILE/,
    [
      "CORE SKILLS?",
      "TECHNICAL SKILLS?",
      "SKILLS?",
      "WORK(?:ING)? EXPERIENCE",
      "PROFESSIONAL EXPERIENCE",
      "EMPLOYMENT HISTORY",
      "CAREER HISTORY",
      "PROJECTS?",
      "EDUCATION",
      "CERTIFICATIONS?",
      "LANGUAGES?",
      "PERSONAL DETAILS",
    ],
  );
  const value = clean(structured || topLevelSummary || section)
    .replace(
      /^\s*(?:professional|profile|career)\s+(?:summary|profile)\s*:*/i,
      "",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/(?<!\w)(?:\+?\d[\s().-]*){7,15}(?!\w)/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (
    value.length < 24 ||
    /^(?:skills?|core skills?|technical skills?|certifications?|education|projects?)\b/i.test(
      value,
    ) ||
    /^\s*(?:[A-Za-z0-9+#./-]+\s*[,;|]){3,}/.test(value)
  )
    return "";
  return value
    .slice(0, 1200)
    .replace(/\s+\S*$/, value.length > 1200 ? "" : "$&");
}

function sourceValuePresent(
  sourceScopes: CandidateSchemaRecord[],
  aliases: string[],
): boolean {
  return sourceScopes.some((scope) =>
    aliases.some((alias) => hasUsableEvidence(unwrap(scope[alias]))),
  );
}
function normalizeResumeEducation(sourceScopes: CandidateSchemaRecord[]) {
  const section = resumeSection(
    sourceScopes,
    /EDUCATION|ACADEMIC (?:QUALIFICATIONS?|BACKGROUND)/,
    [
      "CERTIFICATIONS?",
      "CAREER SUMMARY",
      "PROFESSIONAL SUMMARY",
      "ORGANIZATION EXPERIENCE",
      "WORK(?:ING)? EXPERIENCE",
      "PROFESSIONAL EXPERIENCE",
      "EMPLOYMENT HISTORY",
      "TECHNICAL SKILLS?",
      "INDUSTRY EXPOSURES?",
      "PERSONAL DETAILS",
      "EMPLOYERS?",
      "PROJECTS?",
    ],
  );
  if (!section) return [];
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const explicitEducationText = `${section}\n${resumeText}`;
  const output: Array<{
    id: string;
    qualification: string;
    institution: string;
    fieldOfStudy: string;
    startYear: string;
    endYear: string;
  }> = [];
  const add = (qualification: string, institution: string, endYear = "") => {
    const normalizedQualification = clean(qualification).replace(
      /\s+from$/i,
      "",
    );
    const normalizedInstitution = clean(institution).replace(
      /\s+Finished\s+\d{4}.*$/i,
      "",
    );
    if (!normalizedInstitution) return;
    const key =
      `${normalizedQualification}|${normalizedInstitution}`.toLowerCase();
    if (
      output.some(
        (item) =>
          `${item.qualification}|${item.institution}`.toLowerCase() === key,
      )
    )
      return;
    output.push({
      id: `resume-education-${output.length + 1}`,
      qualification: normalizedQualification,
      institution: normalizedInstitution,
      fieldOfStudy: "",
      startYear: "",
      endYear,
    });
  };
  const fromPattern =
    /\b((?:Bachelor|Master|Doctor|PhD|Diploma|Degree|BSc|BA|MSc|MBA)[^,;]{0,140}?)(?:\s+from\s+|\s+at\s+)([^,;]{2,120}?)(?:\s+Finished\s+((?:19|20)\d{2})|(?=\b(?:Bachelor|Master|Doctor|PhD|Diploma|Degree|BSc|BA|MSc|MBA)\b)|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = fromPattern.exec(section)))
    add(match[1], match[2], match[3] || "");
  const institutionAfter =
    /\b((?:Bachelor|Master|Doctor|PhD|Diploma|Degree|BSc|BA|MSc|MBA)[^;]{0,150}?)\s*((?:19|20)\d{2})\s*;\s*([^.;]{3,100})/gi;
  while ((match = institutionAfter.exec(section)))
    add(match[1], match[3], match[2]);
  const universityAfter =
    /\b((?:Bachelor|Master|Doctor|PhD|Diploma|Degree|BSc|BA|MSc|MBA)[^.;]{0,150}?)\s+(University\s+of\s+[^.;]{2,80})/gi;
  while ((match = universityAfter.exec(section))) add(match[1], match[2]);
  const graduatedFrom =
    /\bGraduated\s+from\s+([^,(]{2,100})(?:,\s*Majoring\s+in\s+([^()]{2,120}))?\s*\(\s*((?:19|20)\d{2})\s*\)/gi;
  while ((match = graduatedFrom.exec(explicitEducationText))) {
    const institution = match[1];
    const fieldOfStudy = clean(match[2]);
    const existingCount = output.length;
    add("", institution, match[3]);
    if (fieldOfStudy && output.length > existingCount)
      output.at(-1)!.fieldOfStudy = fieldOfStudy;
  }
  const qualificationInstitutionRange =
    /\b((?:Postgraduate\s+Certificates?|Bachelor|Master|Doctor|PhD|Diploma|Degree|BSc|BA|MSc|MBA|STPM|SPM)[^;]{0,120}?(?:\([^)]*\))?)\s+((?!(?:in|of)\b)[A-Z][A-Za-z&.'()\- ]{1,120}?(?:University(?:\s*\([A-Z]+\))?|Institute|College|School))\s*(?:\([^)]*\))?\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})/gi;
  while ((match = qualificationInstitutionRange.exec(explicitEducationText))) {
    let qualification = match[1];
    let institution = match[2];
    if (/\b(?:in|of)\s*$/i.test(qualification)) {
      const cue = institution.search(
        /\b(?:[A-Z]{2,}|Royal|National|University|Institute|College|School)\b/,
      );
      if (cue > 0) {
        qualification = `${qualification} ${institution.slice(0, cue)}`;
        institution = institution.slice(cue);
      }
    }
    const before = output.length;
    add(qualification, institution, match[4]);
    if (output.length > before) output.at(-1)!.startYear = match[3];
  }
  const undatedSchool =
    /\b(SPM)\s+([A-Z][A-Za-z.'\- ]{2,80}?(?:\s*\([^)]*\))?)(?=\s+(?:CAREER|PROFESSIONAL|WORK(?:ING)?|EMPLOYMENT)\s+(?:SUMMARY|HISTORY|EXPERIENCE))/gi;
  while ((match = undatedSchool.exec(explicitEducationText)))
    add(match[1], match[2]);
  return output;
}

function normalizeEducation(sourceScopes: CandidateSchemaRecord[]) {
  const structured = recordLists(sourceScopes, [
    "education",
    "educations",
    "education_history",
    "educationHistory",
    "academic_history",
    "academicHistory",
  ])
    .map((item, index) => ({
      id: firstText([item], ["id"]) || "education-" + (index + 1),
      qualification: firstText(
        [item],
        ["degree", "qualification", "certificate"],
      ),
      institution: firstText(
        [item],
        ["institution", "university", "school", "college"],
      ),
      fieldOfStudy: firstText(
        [item],
        ["field_of_study", "fieldOfStudy", "major", "specialization"],
      ),
      startYear: firstText([item], ["start_year", "startYear", "start_date"]),
      endYear: firstText(
        [item],
        [
          "graduation_year",
          "graduationYear",
          "end_year",
          "endYear",
          "end_date",
          "year",
        ],
      ),
    }))
    .filter(
      (item) => item.qualification || item.institution || item.fieldOfStudy,
    );
  return structured.length
    ? structured
    : normalizeResumeEducation(sourceScopes);
}

function normalizeLanguages(sourceScopes: CandidateSchemaRecord[]) {
  const aliases = [
    "languages",
    "language",
    "language_skills",
    "languageSkills",
    "spoken_languages",
    "spokenLanguages",
  ];
  const records = recordLists(sourceScopes, aliases);
  if (records.length)
    return records
      .map((item) => ({
        language: firstText([item], ["language", "name"]),
        proficiency: firstText([item], ["proficiency", "level", "fluency"]),
      }))
      .filter((item) => item.language);
  const structured = allStrings(sourceScopes, aliases).map((language) => ({
    language,
    proficiency: "",
  }));
  if (structured.length) return structured;
  const section = resumeSection(sourceScopes, /LANGUAGES?|LANGUAGE SKILLS?/, [
    "CERTIFICATIONS?",
    "EDUCATION",
    "PERSONAL DETAILS",
    "EMPLOYERS?",
    "PROJECTS?",
    "SUMMARY",
    "PROFILE",
  ]);
  const known =
    section.match(
      /\b(?:Bahasa Malaysia|Bahasa Indonesia|Malay|Mandarin|Cantonese|English|Chinese|Tamil|Hindi|Indonesian)\b/gi,
    ) || [];
  return stringList(known).map((language) => ({ language, proficiency: "" }));
}

function normalizeCertifications(sourceScopes: CandidateSchemaRecord[]) {
  const completeSourceToken = (value: string) => {
    const sources = ["resume_text", "raw_text", "cv_text", "raw_cv"]
      .flatMap((field) => sourceScopes.map((scope) => unwrap(scope[field])))
      .filter(
        (source): source is string =>
          typeof source === "string" && source.length > 0,
      );
    const words = value.trim().split(/\s+/);
    const incomplete = words.at(-1) || "";
    const tail = words
      .slice(-4)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const continuation =
      incomplete.length >= 3 && incomplete.length <= 10
        ? sources
            .map((source) =>
              source.match(new RegExp(`${tail}([A-Za-z]{1,20})\\b`, "i")),
            )
            .find(Boolean)
        : null;
    if (continuation) return `${value}${continuation[1]}`;
    // Some legacy structured extractions stop mid-word. Complete only a known
    // SAP product term; otherwise retain the source value without guessing.
    return value.replace(
      /\bSAP Data Medium Excha$/i,
      "SAP Data Medium Exchange",
    );
  };
  const structured = allStrings(sourceScopes, [
    "certifications",
    "certification",
    "certificates",
    "professional_certifications",
    "professionalCertifications",
  ]).map(completeSourceToken);
  if (structured.length) return structured;
  const section = resumeSection(
    sourceScopes,
    /(?<!POSTGRADUATE )CERTIFICATIONS?/,
    [
      "INDUSTRY EXPOSURES?",
      "PERSONAL DETAILS",
      "EMPLOYERS?",
      "PROJECTS?",
      "EDUCATION",
    ],
  );
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const credentialSource = section || resumeText;
  if (!credentialSource) return [];
  const supported =
    credentialSource.match(
      /(?:SAP\s+Certified[^.;\n]{3,180}|Certified\s+(?:Application\s+Associate|Solution\s+Consultant)[^.;\n]{3,180}|PRINCE2[^.;\n]{0,80}|ITIL[^.;\n]{0,80}|Association\s+of\s+Chartered\s+Certified\s+Accountants\s*\(ACCA\)|\bACCA\b)/gi,
    ) || [];
  const explicitTraining =
    credentialSource.match(
      /Solution\s+Consultant\s+mySAP\s+Financials\s*&\s*Managerial\s+Accounting\s+1\s*\(TFIN10\)\s+Genovate\s+Training\s+Academy(?:\s*\([^)]*\))?(?:\s+(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2})?/gi,
    ) || [];
  return stringList([...supported, ...explicitTraining]);
}
function countByProject(
  projects: EnterpriseProject[],
  patterns: RegExp,
): number {
  return projects.filter((project) =>
    patterns.test(
      `${project.name} ${project.projectType} ${project.implementationType} ${project.responsibilities.join(" ")}`,
    ),
  ).length;
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function metric(
  key: string,
  label: string,
  score: number | null,
  confidence: number,
  evidence: string[],
  reason = "",
): IntelligenceMetric {
  const verifiedEvidence = evidence.filter(
    (item) =>
      item &&
      item.trim() !== "0" &&
      !/recorded .* score:\s*0(?:\.0+)?$/i.test(item),
  );
  const boundedScore = score === null ? null : bounded(score);
  const normalized =
    boundedScore !== null && boundedScore > 0 && verifiedEvidence.length >= 2
      ? boundedScore
      : null;
  const status: IntelligenceMetric["status"] =
    normalized === null
      ? verifiedEvidence.length
        ? "limited_evidence"
        : "not_assessed"
      : normalized >= 90
        ? "excellent"
        : normalized >= 80
          ? "strong"
          : normalized >= 60
            ? "established"
            : "developing";
  const explanation =
    reason ||
    (normalized === null
      ? "Not enough supported evidence to assess this dimension."
      : `Derived from ${verifiedEvidence.length} extracted evidence signal${verifiedEvidence.length === 1 ? "" : "s"}.`);
  return {
    key,
    label,
    score: normalized,
    confidence: normalized === null ? null : bounded(confidence),
    status,
    evidence: verifiedEvidence,
    reason: explanation,
  };
}

function buildIntelligence(input: {
  raw: CandidateSchemaRecord;
  sourceScopes: CandidateSchemaRecord[];
  identity: EnterpriseCandidateProfile["identity"];
  highlights: CareerHighlights;
  projects: EnterpriseProject[];
  timeline: EnterpriseEmployment[];
  technicalSkills: string[];
  sapModules: string[];
  quality: EnterpriseCandidateProfile["quality"];
}): CandidateIntelligence {
  const {
    raw,
    sourceScopes,
    identity,
    highlights,
    projects,
    timeline,
    technicalSkills,
    sapModules,
    quality,
  } = input;
  const sourceMetric = (
    key: string,
    label: string,
    aliases: string[],
    fallback: number | null,
    fallbackEvidence: string[],
  ) => {
    const recorded = maximumNumeric(sourceScopes, aliases);
    const explicit = recorded !== null && recorded > 0 ? recorded : null;
    const evidence =
      explicit !== null
        ? stringList([
            ...fallbackEvidence,
            `Recorded ${label.toLowerCase()} score: ${explicit}`,
          ])
        : fallbackEvidence;
    const reason =
      explicit !== null
        ? `Uses the recorded ${label.toLowerCase()} score supported by ${Math.max(fallbackEvidence.length, 1)} extracted evidence signal${fallbackEvidence.length === 1 ? "" : "s"}.`
        : "";
    return metric(
      key,
      label,
      explicit ?? fallback,
      explicit !== null ? 92 : fallback === null ? 0 : 64,
      evidence,
      reason,
    );
  };
  const implementationEvidence = [
    highlights.implementationProjects
      ? `${highlights.implementationProjects} implementation projects`
      : "",
    highlights.rolloutProjects
      ? `${highlights.rolloutProjects} rollout projects`
      : "",
    highlights.migration ? "Migration experience recorded" : "",
  ].filter(Boolean);
  const implementationFallback = implementationEvidence.length
    ? bounded(
        35 +
          highlights.implementationProjects * 7 +
          highlights.rolloutProjects * 4 +
          (highlights.migration ? 10 : 0),
      )
    : null;
  const leadershipEvidence = [
    highlights.leadershipExperience ? "Leadership experience recorded" : "",
    highlights.teamSize ? `Team size up to ${highlights.teamSize}` : "",
    timeline.some((item) => /lead|manager|head|director/i.test(item.title))
      ? "Leadership title in career timeline"
      : "",
  ].filter(Boolean);
  const leadershipFallback = leadershipEvidence.length
    ? bounded(
        45 +
          (highlights.leadershipExperience ? 25 : 0) +
          Math.min(highlights.teamSize || 0, 20),
      )
    : null;
  const financeSignals = stringList([
    sapModules.filter((item) =>
      /fico|\bfi\b|\bco\b|treasury|trm|banking/i.test(item),
    ),
    highlights.treasury ? ["Treasury"] : [],
    highlights.banking ? ["Banking"] : [],
  ]);
  const financeEvidence = stringList([
    highlights.yearsExperience && financeSignals.length
      ? [`${highlights.yearsExperience} years SAP finance experience`]
      : [],
    financeSignals,
    highlights.implementationProjects
      ? [`${highlights.implementationProjects} implementations`]
      : [],
  ]);
  const financeFallback = financeEvidence.length
    ? bounded(
        35 +
          financeSignals.length * 10 +
          Math.min(highlights.implementationProjects * 3, 20),
      )
    : null;
  const technicalEvidence = [
    ...sapModules.slice(0, 5).map((item) => `SAP ${item}`),
    ...technicalSkills.slice(0, 5),
  ];
  const technicalFallback = technicalEvidence.length
    ? bounded(35 + Math.min(technicalEvidence.length * 7, 55))
    : null;
  const complexityEvidence = stringList(
    projects.flatMap((project) => [
      project.environment,
      project.teamSize ? "Team size " + project.teamSize : "",
      project.modules.length > 1 ? "Multiple SAP modules" : "",
      project.responsibilities.length >= 3
        ? "Documented delivery responsibilities"
        : "",
    ]),
  );
  const complexityFallback =
    complexityEvidence.length >= 3
      ? bounded(
          30 +
            Math.min(projects.length * 6, 30) +
            (highlights.s4hana ? 12 : 0) +
            (highlights.migration ? 10 : 0) +
            (highlights.teamSize ? Math.min(highlights.teamSize, 18) : 0),
        )
      : null;
  const consultingFallback = highlights.consultingBackground
    ? 80
    : highlights.endUserBackground
      ? 35
      : null;
  const consultingEvidence = [
    highlights.consultingBackground ? "Consulting background recorded" : "",
    highlights.endUserBackground ? "End-user background recorded" : "",
  ].filter(Boolean);
  const countryFallback = highlights.countries.length
    ? bounded(35 + highlights.countries.length * 12)
    : null;
  const regionalFallback =
    highlights.regionalExperience.length || highlights.countries.length > 1
      ? bounded(
          45 +
            highlights.regionalExperience.length * 12 +
            Math.max(0, highlights.countries.length - 1) * 8,
        )
      : highlights.countries.length === 1
        ? 35
        : null;
  const domainEvidence = stringList([
    ...highlights.industries,
    ...financeSignals,
    ...sapModules.slice(0, 5),
  ]);
  const domainFallback = domainEvidence.length
    ? bounded(35 + Math.min(domainEvidence.length * 8, 55))
    : null;
  const clientTierValue = firstText(sourceScopes, [
    "client_tier",
    "clientTier",
    "employer_reputation",
    "company_type",
  ]);
  const clientTierScore = maximumNumeric(sourceScopes, [
    "client_score",
    "client_tier_score",
    "employer_reputation_score",
  ]);
  const salaryValue = firstText(sourceScopes, [
    "expected_salary",
    "expectedSalary",
    "current_salary",
    "salary",
  ]);
  const promotionEvidence = [
    ...leadershipEvidence,
    highlights.yearsExperience
      ? `${highlights.yearsExperience} years experience`
      : "",
    identity.currentTitle,
  ].filter(Boolean);
  const promotionFallback = promotionEvidence.length
    ? bounded(
        35 +
          Math.min(highlights.yearsExperience || 0, 15) * 2 +
          (leadershipFallback || 0) * 0.35 +
          (/senior|lead|manager|head|director/i.test(identity.currentTitle)
            ? 12
            : 0),
      )
    : null;
  const metrics = {
    promotionReadiness: sourceMetric(
      "promotionReadiness",
      "Promotion readiness",
      ["promotion_readiness_score", "career_level_score"],
      promotionFallback,
      promotionEvidence,
    ),
    leadershipReadiness: sourceMetric(
      "leadershipReadiness",
      "Leadership readiness",
      ["leadership_score", "ownership_score", "manager_score"],
      leadershipFallback,
      leadershipEvidence,
    ),
    consultingDna: sourceMetric(
      "consultingDna",
      "Consulting DNA",
      ["consulting_dna_score", "consulting_score"],
      consultingFallback,
      consultingEvidence,
    ),
    implementationAuthority: sourceMetric(
      "implementationAuthority",
      "Implementation authority",
      ["implementation_authority_score", "implementation_authority"],
      implementationFallback,
      implementationEvidence,
    ),
    financeDepth: sourceMetric(
      "financeDepth",
      "Finance depth",
      ["finance_depth_score", "finance_depth_v2"],
      financeFallback,
      financeEvidence,
    ),
    technicalDepth: sourceMetric(
      "technicalDepth",
      "Technical depth",
      ["technical_depth_score", "module_authority_score"],
      technicalFallback,
      technicalEvidence,
    ),
    marketPosition: metric(
      "marketPosition",
      "Market position",
      null,
      0,
      [],
      "Market benchmark data is required before this dimension can be assessed.",
    ),
    salaryPosition: metric(
      "salaryPosition",
      "Salary position",
      null,
      0,
      salaryValue
        ? [`Salary recorded (${salaryValue}); no market benchmark available`]
        : ["Salary data and market benchmark are unavailable"],
    ),
    regionalCoverage: sourceMetric(
      "regionalCoverage",
      "Regional coverage",
      ["regional_delivery_score", "multi_country_rollout_score"],
      regionalFallback,
      stringList([...highlights.regionalExperience, ...highlights.countries]),
    ),
    countryCoverage: sourceMetric(
      "countryCoverage",
      "Country coverage",
      ["country_coverage_count"],
      countryFallback,
      highlights.countries,
    ),
    projectComplexity: sourceMetric(
      "projectComplexity",
      "Project complexity",
      ["role_complexity_score", "project_ownership_score", "complexity_score"],
      complexityFallback,
      complexityEvidence,
    ),
    clientTier: metric(
      "clientTier",
      "Client tier",
      clientTierScore,
      clientTierScore !== null ? 90 : clientTierValue ? 55 : 0,
      clientTierValue && clientTierValue !== "0" ? [clientTierValue] : [],
    ),
    domainExpertise: sourceMetric(
      "domainExpertise",
      "Domain expertise",
      ["domain_authority", "module_authority_score"],
      domainFallback,
      domainEvidence,
    ),
  };
  const metricList = Object.values(metrics);
  const candidateStrengths = metricList
    .filter((item) => item.score !== null && item.score >= 65)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6)
    .map((item) => `${item.label}: ${item.evidence[0] || `${item.score}%`}`);
  const careerRisks = stringList([
    ...quality.reviewRisks,
    ...metricList
      .filter((item) => item.score !== null && item.score < 40)
      .map((item) => `${item.label} requires validation`),
  ]).slice(0, 8);
  const titleScore = (title: string) =>
    /director|head/i.test(title)
      ? 90
      : /manager|lead/i.test(title)
        ? 75
        : /senior/i.test(title)
          ? 60
          : 40;
  const trend = timeline
    .filter((item) => item.title)
    .slice()
    .reverse()
    .map((item) => ({
      label: item.end || item.start || item.company,
      score: titleScore(item.title),
      evidence: `${item.title}${item.company ? ` at ${item.company}` : ""}`,
    }));
  const idealRoles = stringList([
    identity.currentTitle,
    highlights.primarySapModule
      ? `SAP ${highlights.primarySapModule} roles`
      : "",
    highlights.leadershipExperience ? "SAP team leadership roles" : "",
  ]);
  const idealClients = stringList([
    highlights.consultingBackground ? "Consulting-led SAP programmes" : "",
    highlights.endUserBackground ? "SAP end-user organisations" : "",
    clientTierValue,
  ]);
  return {
    candidateStrengths,
    careerRisks,
    ...metrics,
    trend,
    insights: {
      topStrengths: candidateStrengths.slice(0, 3),
      topRisks: careerRisks.slice(0, 3),
      idealRoles,
      idealClients,
      idealIndustries: highlights.industries,
      idealCountries: highlights.countries,
      potentialGaps: quality.missingSections.map(
        (item) => `${item} requires evidence`,
      ),
    },
  };
}
function buildSummary(
  identity: EnterpriseCandidateProfile["identity"],
  highlights: CareerHighlights,
): string {
  const lines: string[] = [];
  if (highlights.yearsExperience)
    lines.push(
      "Total career experience recorded: " +
        highlights.yearsExperience +
        " years.",
    );
  else if (identity.currentTitle)
    lines.push(
      `${identity.currentTitle}${identity.currentCompany ? ` at ${identity.currentCompany}` : ""}.`,
    );
  const background =
    highlights.consultingBackground && highlights.endUserBackground
      ? "Consulting and end-user background."
      : highlights.consultingBackground
        ? "Consulting background."
        : highlights.endUserBackground
          ? "End-user SAP background."
          : "";
  if (background) lines.push(background);
  const delivery = [
    highlights.implementationProjects
      ? `${highlights.implementationProjects} full-cycle implementation${highlights.implementationProjects === 1 ? "" : "s"}`
      : "",
    highlights.amsProjects
      ? `${highlights.amsProjects} AMS engagement${highlights.amsProjects === 1 ? "" : "s"}`
      : "",
    highlights.rolloutProjects
      ? `${highlights.rolloutProjects} rollout${highlights.rolloutProjects === 1 ? "" : "s"}`
      : "",
  ].filter(Boolean);
  if (delivery.length)
    lines.push("The profile supports " + delivery.join(" and ") + ".");
  return (
    lines.slice(0, 4).join("\n") ||
    "Structured career summary is not yet available."
  );
}

export type CandidateCanonicalStageTimings = {
  sourceScopesMs: number;
  employmentMs: number;
  projectConstructionMs: number;
  projectLinkingMs: number;
  identityResolutionMs: number;
  educationAndSkillsMs: number;
  remainingProjectionMs: number;
  totalMs: number;
};

function normalizeActualCandidateSchemaFresh(
  raw: CandidateSchemaRecord,
  stageTimings?: CandidateCanonicalStageTimings,
) {
  const totalStartedAt = performance.now();
  let stageStartedAt = totalStartedAt;
  const sourceScopes = scopes(raw);
  if (stageTimings)
    stageTimings.sourceScopesMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const normalizedEmployment = normalizeEmployment(sourceScopes);
  if (stageTimings)
    stageTimings.employmentMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const projects = removeEmploymentOnlyProjectDuplicates(
    normalizeProjects(raw, sourceScopes),
    normalizedEmployment,
  );
  if (stageTimings)
    stageTimings.projectConstructionMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const employmentTimeline = linkProjectsToEmployment(
    normalizedEmployment,
    projects,
  );
  if (stageTimings)
    stageTimings.projectLinkingMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const name = resolveCandidateName(sourceScopes);
  const currentRoleContext = explicitCurrentRoleContext(sourceScopes);
  const currentEmployment =
    employmentTimeline.find((item) => item.current) || null;
  const profileTitle =
    currentRoleContext.title ||
    cleanCandidateTitle(
      firstText(sourceScopes.slice(0, 1), [
        "current_title",
        "currentTitle",
        "profile_title",
        "profileTitle",
        "job_title",
        "jobTitle",
        "title",
      ]),
    );
  const currentTitle =
    currentEmployment?.title ||
    currentRoleContext.title ||
    profileTitle ||
    employmentTimeline[0]?.title ||
    "";
  const currentCompany = resolveCurrentEmployer(
    sourceScopes,
    employmentTimeline,
  );
  const location = firstText(sourceScopes, [
    "current_location",
    "currentLocation",
    "location",
    "country",
    "city",
  ]);
  const country =
    firstText(sourceScopes, ["country", "current_country", "nationality"]) ||
    location;
  const headline = firstText(sourceScopes, [
    "headline",
    "professional_headline",
    "summary_title",
  ]);
  if (stageTimings)
    stageTimings.identityResolutionMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const technicalSkills = allStrings(sourceScopes, [
    "technical_skills",
    "technicalSkills",
    "skills",
    "hard_skills",
    "hardSkills",
    "core_skills",
  ]);
  const sapModules = allStrings(sourceScopes, [
    "sap_modules",
    "sapModules",
    "modules",
    "primary_module",
    "primaryModule",
    "secondary_modules",
    "module_authorities",
  ]);
  const primarySapModule =
    firstText(sourceScopes, [
      "primary_module",
      "primaryModule",
      "primary_sap_module",
    ]) ||
    sapModules[0] ||
    "";
  const education = normalizeEducation(sourceScopes);
  const certifications = normalizeCertifications(sourceScopes);
  const languages = normalizeLanguages(sourceScopes);
  const professionalSummary = normalizeProfessionalSummary(sourceScopes);
  if (stageTimings)
    stageTimings.educationAndSkillsMs = performance.now() - stageStartedAt;
  stageStartedAt = performance.now();
  const educationExcerpt = resumeSection(
    sourceScopes,
    /EDUCATION|ACADEMIC (?:QUALIFICATIONS?|BACKGROUND)/,
    [
      "CERTIFICATIONS?",
      "CAREER SUMMARY",
      "PROFESSIONAL SUMMARY",
      "ORGANIZATION EXPERIENCE",
      "WORK(?:ING)? EXPERIENCE",
      "PROFESSIONAL EXPERIENCE",
      "EMPLOYMENT HISTORY",
      "TECHNICAL SKILLS?",
      "INDUSTRY EXPOSURES?",
      "PERSONAL DETAILS",
      "EMPLOYERS?",
      "PROJECTS?",
    ],
  );
  const certificationExcerpt = resumeSection(
    sourceScopes,
    /(?<!POSTGRADUATE )CERTIFICATIONS?/,
    [
      "INDUSTRY EXPOSURES?",
      "PERSONAL DETAILS",
      "EMPLOYERS?",
      "PROJECTS?",
      "EDUCATION",
    ],
  );
  const languageExcerpt = resumeSection(
    sourceScopes,
    /LANGUAGES?|LANGUAGE SKILLS?/,
    [
      "CERTIFICATIONS?",
      "EDUCATION",
      "PERSONAL DETAILS",
      "EMPLOYERS?",
      "PROJECTS?",
    ],
  );
  const educationStructuredSource = sourceValuePresent(sourceScopes, [
    "education",
    "educations",
    "education_history",
    "educationHistory",
    "academic_history",
    "academicHistory",
  ]);
  const languageStructuredSource = sourceValuePresent(sourceScopes, [
    "languages",
    "language",
    "language_skills",
    "languageSkills",
    "spoken_languages",
    "spokenLanguages",
  ]);
  const certificationStructuredSource = sourceValuePresent(sourceScopes, [
    "certifications",
    "certification",
    "certificates",
    "professional_certifications",
    "professionalCertifications",
  ]);
  const educationSourcePresent =
    educationStructuredSource || Boolean(educationExcerpt);
  const languageSourcePresent =
    languageStructuredSource || Boolean(languageExcerpt);
  const certificationSourcePresent =
    certificationStructuredSource ||
    Boolean(certificationExcerpt) ||
    certifications.length > 0;
  const buildSectionEvidence = <T>(
    key: "education" | "languages" | "certifications",
    value: T,
    sourcePresent: boolean,
    structuredSource: boolean,
    excerpt: string,
  ): NormalizedSectionEvidence => {
    const normalized = hasUsableEvidence(value);
    const sourceRef = excerpt
      ? `resume.${key}`
      : structuredSource
        ? `candidate.${key}`
        : normalized &&
            sourceValuePresent(sourceScopes, [
              "resume_text",
              "raw_text",
              "cv_text",
              "raw_cv",
            ])
          ? `resume.${key}`
          : "";
    const provenance: EvidenceRef[] = sourcePresent
      ? [
          {
            sourceType: excerpt ? "parsed_resume" : "candidate_field",
            sourceRef,
            fieldPath: sourceRef,
            label: excerpt ? "Resume evidence" : "Candidate profile field",
            ...(excerpt ? { excerpt } : {}),
            ...(normalized ? { normalizedValue: JSON.stringify(value) } : {}),
          },
        ]
      : [];
    return {
      value: normalized ? value : null,
      sourceTextPresent: sourcePresent,
      normalized,
      provenance,
      state: normalized
        ? "structured_available"
        : sourcePresent
          ? "source_present_unstructured"
          : "missing",
      sourcePresent,
      normalizedValuePresent: normalized,
      sourceRef,
      profileState: profileSectionState(normalized, sourcePresent),
    };
  };
  const sectionEvidence = {
    education: buildSectionEvidence(
      "education",
      education,
      educationSourcePresent,
      educationStructuredSource,
      educationExcerpt,
    ),
    languages: buildSectionEvidence(
      "languages",
      languages,
      languageSourcePresent,
      languageStructuredSource,
      languageExcerpt,
    ),
    certifications: buildSectionEvidence(
      "certifications",
      certifications,
      certificationSourcePresent,
      certificationStructuredSource,
      certificationExcerpt,
    ),
  } satisfies Record<
    "education" | "languages" | "certifications",
    NormalizedSectionEvidence
  >;
  const countries = stringList([
    country,
    ...projects.map((project) => project.country),
  ]);
  const industries = stringList([
    ...allStrings(sourceScopes, [
      "industries",
      "industry",
      "industry_experience",
      "sectors",
    ]),
    ...projects.map((project) => project.industry),
  ]);
  const evidence = JSON.stringify({
    raw: Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) =>
          !["raw_cv", "raw_text", "resume_text", "embedding"].includes(key),
      ),
    ),
    parsed: parsedRoot(raw),
  }).toLowerCase();
  const resumeText = firstText(sourceScopes, [
    "resume_text",
    "raw_text",
    "cv_text",
    "raw_cv",
  ]);
  const resumeSapYears =
    Number(
      resumeText.match(
        /(?:more than\s+)?(\d+(?:\.\d+)?)\s+years?\s+of\s+experience[^.]{0,80}\bSAP\b/i,
      )?.[1] || 0,
    ) || null;
  const explicitYears = numeric(sourceScopes, [
    "years_of_sap_experience",
    "sap_experience_years",
    "sapYearsExperience",
    "totalYearsExperience",
    "years_of_experience",
    "yearsExperience",
    "years_experience",
    "total_experience_years",
    "experience",
    "years",
  ]);
  const calculatedMonths = numeric(sourceScopes, [
    "calculated_experience_months",
    "experience_months",
    "total_experience_months",
  ]);
  const yearsFromTimeline = (
    predicate: (item: EnterpriseEmployment) => boolean,
  ) =>
    employmentTimeline.filter(predicate).reduce((sum, item) => {
      const endYear = /present|current|now/i.test(item.end)
        ? new Date().getUTCFullYear()
        : dateYear(item.end);
      return sum + Math.max(0, endYear - dateYear(item.start));
    }, 0);
  const sapTimelineYears = yearsFromTimeline((item) =>
    /\bsap\b|fico|s\/4|hana|abap/i.test(`${item.title} ${item.company}`),
  );
  const experienceSummary = buildExperienceSummary(
    sourceScopes,
    employmentTimeline,
    primarySapModule,
    currentCompany,
  );
  const consultingYears = experienceSummary.consultingExperienceYears;
  const leadershipYears =
    maximumNumeric(sourceScopes, [
      "years_leadership",
      "leadership_years",
      "management_experience_years",
    ]) ??
    (yearsFromTimeline((item) =>
      /lead|manager|head|director/i.test(item.title),
    ) ||
      null);
  const evidenceYears = experienceSummary.sapExperienceYears;
  const highlightCount = (aliases: string[], pattern: RegExp) =>
    Math.max(
      maximumNumeric(sourceScopes, aliases) ?? 0,
      countByProject(projects, pattern),
    );
  const teamSizes = projects
    .map((project) => project.teamSize)
    .filter((value): value is number => value !== null);
  const highlights: CareerHighlights = {
    yearsExperience: evidenceYears,
    yearsConsulting: consultingYears,
    yearsLeadership: leadershipYears,
    implementationProjects: highlightCount(
      [
        "implementation_project_count",
        "implementation_projects",
        "implementationCount",
      ],
      /implementation|greenfield|brownfield/i,
    ),
    rolloutProjects: highlightCount(
      ["rollout_project_count", "rollout_projects", "rolloutCount"],
      /rollout/i,
    ),
    greenfieldProjects: highlightCount(
      ["greenfield_project_count", "greenfield_projects"],
      /greenfield/i,
    ),
    brownfieldProjects: highlightCount(
      ["brownfield_project_count", "brownfield_projects"],
      /brownfield/i,
    ),
    amsProjects: highlightCount(
      ["ams_project_count", "ams_projects", "ams_support_project_count"],
      /\bams\b/i,
    ),
    supportProjects: highlightCount(
      ["support_project_count", "support_projects", "supportCount"],
      /support/i,
    ),
    primarySapModule,
    countries,
    industries,
    consultingBackground:
      truthy(
        sourceScopes,
        [
          "consulting_background",
          "is_from_consulting_firm",
          "consulting_experience",
        ],
        evidence,
      ) ||
      employmentTimeline.some((item) =>
        /consulting|consultancy/i.test(item.company),
      ),
    endUserBackground: truthy(
      sourceScopes,
      ["end_user_background", "end_user_experience", "end_user_project_count"],
      evidence,
    ),
    leadershipExperience: truthy(
      sourceScopes,
      [
        "leadership_experience",
        "lead_role_count",
        "manager_role_count",
        "team_lead",
      ],
      evidence,
    ),
    teamSize: teamSizes.length
      ? Math.max(...teamSizes)
      : numeric(sourceScopes, ["team_size", "largest_team_size"]),
    regionalExperience: allStrings(sourceScopes, [
      "regional_experience",
      "regions",
      "region",
      "country_coverage",
    ]),
    s4hana: truthy(
      sourceScopes,
      ["s4hana", "s4_hana", "s4hana_project_count", "s4_implementation_count"],
      evidence,
    ),
    ecc: truthy(
      sourceScopes,
      ["ecc", "ecc_projects", "ecc_project_count"],
      evidence,
    ),
    migration: truthy(
      sourceScopes,
      ["migration", "migration_experience", "migration_project_count"],
      evidence,
    ),
    treasury: truthy(
      sourceScopes,
      ["treasury", "treasury_experience"],
      evidence,
    ),
    banking: truthy(sourceScopes, ["banking", "banking_experience"], evidence),
    publicCloud: truthy(
      sourceScopes,
      ["public_cloud", "publicCloud"],
      evidence,
    ),
    privateCloud: truthy(
      sourceScopes,
      ["private_cloud", "privateCloud"],
      evidence,
    ),
  };
  const recruiterSignals = {
    availability: firstText(sourceScopes, [
      "availability",
      "availability_timeline",
      "availabilityTimeline",
      "available_from",
    ]),
    notice: firstText(sourceScopes, [
      "notice_period",
      "noticePeriod",
      "notice",
    ]),
    salary: firstText(sourceScopes, [
      "expected_salary",
      "expectedSalary",
      "salary_expectation",
    ]),
    travel: firstText(sourceScopes, [
      "travel",
      "travel_willingness",
      "willing_to_travel",
    ]),
    remote: firstText(sourceScopes, [
      "remote",
      "remote_preference",
      "work_arrangement",
    ]),
    visa: firstText(sourceScopes, [
      "visa",
      "visa_status",
      "work_authorization",
    ]),
    relocation: firstText(sourceScopes, [
      "relocation",
      "relocation_willingness",
      "willing_to_relocate",
    ]),
  };
  const identity = {
    name,
    profileTitle,
    currentTitle,
    currentCompany,
    headline,
    location,
    country,
  };
  // Equal weights preserve the established nine-section product definition. Credential
  // sections with source evidence but no usable normalized value earn partial, not full, credit.
  const completenessComponents: CompletenessComponent[] = [
    {
      key: "identity.name",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence(name),
        hasUsableEvidence(name),
      ),
    },
    {
      key: "identity.currentTitle",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence(currentTitle),
        hasUsableEvidence(currentTitle),
      ),
    },
    {
      key: "identity.currentCompany",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence(currentCompany),
        hasUsableEvidence(currentCompany),
      ),
    },
    {
      key: "employmentTimeline",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence(employmentTimeline),
        hasUsableEvidence(employmentTimeline),
      ),
    },
    {
      key: "projects",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence(projects),
        hasUsableEvidence(projects),
      ),
    },
    {
      key: "education",
      weight: 1,
      state: sectionEvidence.education.profileState,
    },
    {
      key: "skills",
      weight: 1,
      state: profileSectionState(
        hasUsableEvidence([...technicalSkills, ...sapModules]),
        hasUsableEvidence([...technicalSkills, ...sapModules]),
      ),
    },
    {
      key: "certifications",
      weight: 1,
      state: sectionEvidence.certifications.profileState,
    },
    {
      key: "languages",
      weight: 1,
      state: sectionEvidence.languages.profileState,
    },
  ];
  const completeness = calculateProfileCompleteness(completenessComponents);
  const missingSections = [
    ...completeness.missingKeys,
    ...completeness.partialKeys,
  ];
  const profileCompleteness = completeness.score;
  const sourceConfidence = numeric(sourceScopes, [
    "extraction_confidence",
    "data_confidence",
    "confidence",
    "profile_quality_score",
  ]);
  const dataConfidence = Math.max(
    0,
    Math.min(100, Math.round(sourceConfidence ?? profileCompleteness)),
  );
  const reviewRisks = [
    ...missingSections.map((section) => `${section} is missing or incomplete`),
    ...(highlights.yearsExperience === null
      ? ["Total SAP experience duration requires validation"]
      : []),
    ...(!primarySapModule ? ["Primary SAP module requires review"] : []),
  ];
  // Only claims carrying a concrete provenance path participate in traceability metrics.
  // Employment-derived summaries are excluded until their interval-level provenance is retained.
  const directlySupportedClaims = projects.reduce(
    (sum, project) =>
      sum +
      Object.values(project.fieldEvidence).filter(
        (field) =>
          (field?.evidenceState === "source_extracted" ||
            field?.evidenceState === "verified") &&
          field.provenance.some((item) =>
            Boolean(item.sourceRef || item.fieldPath),
          ),
      ).length,
    0,
  );
  const derivedClaims = projects.reduce(
    (sum, project) =>
      sum +
      Object.values(project.fieldEvidence).filter(
        (field) =>
          field?.evidenceState === "derived" &&
          field.provenance.some((item) =>
            Boolean(item.sourceRef || item.fieldPath),
          ),
      ).length,
    0,
  );
  const inferredClaims = projects.reduce(
    (sum, project) =>
      sum +
      Object.values(project.fieldEvidence).filter(
        (field) => field?.evidenceState === "inferred",
      ).length,
    0,
  );
  const traceableClaims = directlySupportedClaims + derivedClaims;
  const totalAuditableClaims = traceableClaims + inferredClaims;
  const sourceTraceability = totalAuditableClaims
    ? Math.round((traceableClaims / totalAuditableClaims) * 100)
    : 0;
  const evidenceQuality: EvidenceQualitySummary = {
    profileCompleteness,
    sourceTraceability,
    directlySupportedClaims,
    derivedClaims,
    inferredClaims,
    missingCriticalFields: missingSections.map((section) =>
      humanizeMissingSection(section),
    ),
  };
  const quality = {
    profileCompleteness,
    dataConfidence,
    missingSections,
    reviewRisks,
    evidenceQuality,
    sectionEvidence,
    completenessComponents,
    extraction: {
      experience: candidateExtractionSection(
        employmentTimeline,
        sourceScopes,
        /(?:employment|experience|career|internship|trainee|apprentice|volunteer)[\s\S]{0,560}/i,
        "resume.experience",
      ),
      projects: candidateExtractionSection(
        projects,
        sourceScopes,
        /(?:projects?|implementation|rollout|migration|upgrade|support|capstone)[\s\S]{0,560}/i,
        "resume.projects",
      ),
    },
  };
  const intelligence = buildIntelligence({
    raw,
    sourceScopes,
    identity,
    highlights,
    projects,
    timeline: employmentTimeline,
    technicalSkills,
    sapModules,
    quality,
  });
  const enterpriseProfile: EnterpriseCandidateProfile = {
    candidateId: firstText([raw], ["id", "candidate_id", "candidateId"]),
    identity,
    summary: "",
    professionalSummary,
    technicalSkills,
    sapModules,
    careerHighlights: highlights,
    experienceSummary,
    employmentTimeline,
    projects,
    education,
    certifications,
    languages,
    recruiterSignals,
    intelligence,
    quality,
  };
  enterpriseProfile.summary = buildSummary(identity, highlights);
  const legacyProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    role: project.role,
    modules: project.modules,
    location: project.country,
    description: project.responsibilities.join("; "),
    startDate: project.start,
    endDate: project.end,
    projectType: project.projectType || project.implementationType,
  }));
  const legacyEmployment = employmentTimeline.map((item) => ({
    id: item.id,
    company: item.company,
    title: item.title,
    startDate: item.start,
    endDate: item.end,
    description: "",
    current: item.current,
  }));
  const legacyEducation = education.map((item) => ({
    id: item.id,
    qualification: item.qualification,
    institution: item.institution,
    fieldOfStudy: item.fieldOfStudy,
    graduationYear: item.endYear,
  }));
  const result = {
    candidateName: name,
    current_title: currentTitle,
    currentTitle,
    current_company: currentCompany || null,
    currentCompany: currentCompany || null,
    headline,
    location: location || null,
    country: country || null,
    skills: stringList([...technicalSkills, ...sapModules]),
    technical_skills: technicalSkills,
    sapModules,
    work_experience: legacyEmployment,
    workExperience: legacyEmployment,
    employmentHistory: legacyEmployment,
    projectExperience: legacyProjects,
    projects: legacyProjects,
    education: legacyEducation,
    certifications,
    languages: languages.map((item) =>
      item.proficiency ? item : item.language,
    ),
    primary_module: primarySapModule,
    primaryModule: primarySapModule,
    implementationExperience: highlights.implementationProjects > 0,
    implementationProjectCount: highlights.implementationProjects,
    rolloutProjectCount: highlights.rolloutProjects,
    amsProjectCount: highlights.amsProjects,
    supportProjectCount: highlights.supportProjects,
    profileQualityScore:
      numeric(sourceScopes, ["profile_quality_score"]) ?? profileCompleteness,
    extractionConfidence: dataConfidence,
    enterpriseProfile,
  };
  if (stageTimings) {
    stageTimings.remainingProjectionMs = performance.now() - stageStartedAt;
    stageTimings.totalMs = performance.now() - totalStartedAt;
  }
  return result;
}

export function normalizeActualCandidateSchemaWithTimings(
  raw: CandidateSchemaRecord,
) {
  const timings: CandidateCanonicalStageTimings = {
    sourceScopesMs: 0,
    employmentMs: 0,
    projectConstructionMs: 0,
    projectLinkingMs: 0,
    identityResolutionMs: 0,
    educationAndSkillsMs: 0,
    remainingProjectionMs: 0,
    totalMs: 0,
  };
  return {
    projection: normalizeActualCandidateSchemaFresh(raw, timings),
    timings,
  };
}

export function normalizeActualCandidateSchema(
  raw: CandidateSchemaRecord,
): NormalizedCandidateProjection {
  const candidateId = String(raw.id || raw.candidate_id || "").trim();
  const updatedAt = String(
    raw.updated_at || raw.source_updated_at || "",
  ).trim();
  // Only database-backed records have a trustworthy invalidation marker. Test
  // fixtures and ad-hoc objects deliberately bypass this process cache.
  const cacheKey =
    candidateId && updatedAt
      ? `${CANDIDATE_CANONICAL_VERSION}:${candidateId}:${updatedAt}`
      : null;
  const cached = cacheKey ? normalizedProjectionCache.get(cacheKey) : null;
  if (cached) return cached;
  const persistedContainer = raw.parsed_json || raw.parsed_data;
  const stored =
    persistedContainer &&
    typeof persistedContainer === "object" &&
    !Array.isArray(persistedContainer)
      ? (persistedContainer as CandidateSchemaRecord).canonical_candidate
      : null;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const snapshot = stored as CandidateSchemaRecord;
    if (
      snapshot.version === CANDIDATE_CANONICAL_VERSION &&
      snapshot.payload &&
      typeof snapshot.payload === "object"
    ) {
      const persisted = snapshot.payload as ReturnType<
        typeof normalizeActualCandidateSchemaFresh
      >;
      // Preserve the immutable canonical snapshot and overlay only the
      // idempotently reconstructed Experience/Projects projections.
      const repaired = normalizeActualCandidateSchemaFresh({
        ...raw,
        parsed_json: null,
        parsed_data: null,
      });
      const result: NormalizedCandidateProjection = {
        ...persisted,
        work_experience: repaired.work_experience,
        workExperience: repaired.workExperience,
        employmentHistory: repaired.employmentHistory,
        projectExperience: repaired.projectExperience,
        projects: repaired.projects,
        enterpriseProfile: {
          ...persisted.enterpriseProfile,
          employmentTimeline: repaired.enterpriseProfile.employmentTimeline,
          projects: repaired.enterpriseProfile.projects,
          experienceSummary: repaired.enterpriseProfile.experienceSummary,
          careerHighlights: repaired.enterpriseProfile.careerHighlights,
          quality: {
            ...persisted.enterpriseProfile.quality,
            extraction: repaired.enterpriseProfile.quality.extraction,
          },
        },
      };
      if (cacheKey) normalizedProjectionCache.set(cacheKey, result);
      return result;
    }
  }
  const result = normalizeActualCandidateSchemaFresh(raw);
  if (cacheKey) normalizedProjectionCache.set(cacheKey, result);
  return result;
}
