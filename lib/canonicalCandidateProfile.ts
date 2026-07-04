import { buildCandidateProfile } from "./candidateProfile";
import { evaluateResumeQualityGate, resolveCurrentCompany, sanitizeCompanyName, classifyCompanyCategory, resolveTrustedResumeName, isValidHumanName, duplicateFingerprint } from "./resumeQualityGate";

export type CompanyType = "Consulting Firm" | "In-house" | "Not disclosed";
export type BackgroundExperience = "Consulting Firm" | "In-house" | "Mixed (Consulting Firm + In-house)" | "Not disclosed";

export type CanonicalCandidateProfile = {
  displayName: string;
  exportName: string;
  needsManualReview: boolean;
  currentCompany: string;
  previousCompany: string;
  companyType: CompanyType;
  backgroundExperience: BackgroundExperience;
  sapYears: number;
  deliveryMetrics: {
    implementation: number;
    ams: number;
    rollout: number;
    greenfield: number;
    brownfield: number;
    migration: number;
    transformation: number;
    s4: number;
  };
  duplicateKey: string;
  parserQualityScore: number;
  allowedForRanking: boolean;
  allowedForExecutiveExport: boolean;
  identityReviewRequired: boolean;
  identityReviewReason: string;
  companyCategory: string;
  auditWarnings: string[];
};

type AnyRecord = Record<string, any>;

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function isIdentityReviewPlaceholder(value: any) {
  return /^(profile under review|review required|name requires validation|identity under review|needs manual name review|candidate\s*#?\d*|unknown candidate)$/i.test(clean(value));
}

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").replace(/[,.;:]+$/g, "").trim();
}

function records(raw: AnyRecord) {
  const sources = [raw?.currentExperience, raw?.current_experience, raw?.latestExperience, raw?.latest_experience, raw?.workExperience, raw?.work_experience, raw?.experience, raw?.experiences, raw?.employmentHistory, raw?.employment_history, raw?.positions, raw?.jobs, raw?.parsedProfile?.experience, raw?.parsedProfile?.workExperience, raw?.parsedResume?.experience, raw?.resume?.experience];
  return sources.flatMap((source) => Array.isArray(source) ? source : source && typeof source === "object" ? [source] : []).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function recordCompany(record: AnyRecord) {
  return sanitizeCompanyName(record?.company || record?.companyName || record?.company_name || record?.employer || record?.organization || record?.organisation || record?.client || record?.account);
}

function normalizeCandidateName(raw: AnyRecord, parsedName = "") {
  const rawName = raw?.name || raw?.candidate_name || raw?.full_name || raw?.display_name;
  const rawNameIsPlaceholder = isIdentityReviewPlaceholder(rawName);
  const trusted = resolveTrustedResumeName({ ...raw, parsedProfile: raw?.parsedProfile || raw?.profile, parsedResume: raw?.parsedResume || raw?.parsed_resume || raw?.resume });
  if (trusted.name && trusted.confidence >= 80 && !(rawNameIsPlaceholder && trusted.source === "email")) return { name: trusted.name, needsManualReview: trusted.confidence < 88, source: trusted.source };
  if (!rawNameIsPlaceholder && parsedName && isValidHumanName(parsedName, { source: "header" })) return { name: clean(parsedName), needsManualReview: false, source: "parser" };
  return { name: "", needsManualReview: true, source: "unresolved" };
}

export function extractCurrentCompany(raw: AnyRecord) {
  return resolveCurrentCompany(raw);
}

export function extractPreviousCompany(raw: AnyRecord, currentCompany = "") {
  const work = records(raw).map(recordCompany).filter(Boolean);
  return work.find((company) => company.toLowerCase() !== currentCompany.toLowerCase()) || "";
}

function isConsultingCompany(company: string) {
  const category = classifyCompanyCategory(company);
  return category === "Consulting" || category === "Big4" || category === "SI";
}

function isEnterpriseCompany(company: string) {
  const category = classifyCompanyCategory(company);
  return ["End User", "Government", "Manufacturing", "Healthcare", "Retail", "Banking", "Energy", "Telecommunication"].includes(category);
}

export function classifyCompany(company: string): CompanyType {
  if (!company || company === "Not disclosed") return "Not disclosed";
  if (isConsultingCompany(company)) return "Consulting Firm";
  if (isEnterpriseCompany(company)) return "In-house";
  return "In-house";
}

export function classifyBackground(raw: AnyRecord, currentCompany: string): BackgroundExperience {
  const companies = Array.from(new Set([currentCompany, ...records(raw).map(recordCompany)].map(sanitizeCompanyName).filter((item) => item && item !== "Not disclosed")));
  if (!companies.length) return "Not disclosed";
  const consulting = companies.some(isConsultingCompany);
  const enterprise = companies.some((company) => isEnterpriseCompany(company) || !isConsultingCompany(company));
  if (consulting && enterprise) return "Mixed (Consulting Firm + In-house)";
  if (consulting) return "Consulting Firm";
  return "In-house";
}

function sapEmployerLooksExplicit(raw: AnyRecord) {
  const text = textOf(raw.raw_text || raw.resume_text || raw.raw_cv || raw.rawText || raw.parsed_resume || "");
  return /\b(SAP\s+(Malaysia|SE)|worked\s+at\s+SAP|SAP\s+employee|employer\s*[:\-]\s*SAP)\b/i.test(text);
}

function zeroIfDefaultMetric(raw: AnyRecord, value: number, keys: string[], evidencePattern: RegExp) {
  if (value !== 1) return value;
  const explicit = keys.some((key) => Number(raw?.[key]) === 1);
  const text = textOf(raw.raw_text || raw.resume_text || raw.raw_cv || raw.rawText || raw.resumeText || raw.profileText || raw.summary || "");
  if (explicit && evidencePattern.test(text)) return value;
  return 0;
}


export function buildCanonicalCandidateProfile(raw: AnyRecord): CanonicalCandidateProfile {
  const parsed = buildCandidateProfile(raw);
  const nameResult = normalizeCandidateName(raw, parsed.name);
  let currentCompany = extractCurrentCompany(raw);
  if (/^sap$/i.test(currentCompany) && !sapEmployerLooksExplicit(raw)) currentCompany = "Not disclosed";
  const previousCompany = extractPreviousCompany(raw, currentCompany);
  const companyType = classifyCompany(currentCompany);
  const backgroundExperience = classifyBackground(raw, currentCompany);
  const rawName = raw?.name || raw?.candidate_name || raw?.full_name || raw?.display_name;
  const hasReviewPlaceholderName = isIdentityReviewPlaceholder(rawName);
  const qualityGate = evaluateResumeQualityGate({ ...raw, name: nameResult.name || raw?.name, currentCompany, current_company: currentCompany, company: currentCompany });
  const identityReviewRequired = hasReviewPlaceholderName || nameResult.needsManualReview || qualityGate.needsManualReview;
  const identityReviewReason = hasReviewPlaceholderName ? "Profile name is an internal review placeholder" : nameResult.needsManualReview ? "Name requires validation" : qualityGate.needsManualReview ? "Parser quality below export threshold" : "";
  const warnings: string[] = [...(parsed.extractionWarnings || []), ...qualityGate.warnings, ...qualityGate.rejectionReasons];
  if (hasReviewPlaceholderName) warnings.push("Profile under review placeholder name");
  if (nameResult.needsManualReview) warnings.push("Name requires manual review");
  if (currentCompany === "Not disclosed" && records(raw).some((item) => recordCompany(item))) warnings.push("Current company not resolved despite work history");
  return {
    displayName: nameResult.name,
    exportName: identityReviewRequired || !qualityGate.allowedForExecutiveExport ? "" : nameResult.name,
    needsManualReview: identityReviewRequired,
    currentCompany,
    previousCompany,
    companyType,
    backgroundExperience,
    sapYears: parsed.years || 0,
    deliveryMetrics: {
      implementation: zeroIfDefaultMetric(raw, parsed.implementationProjects || 0, ["implementationProjects", "implementation_projects", "implementation_project_count"], new RegExp("\\b1\\s+(?:full\\s+cycle\\s+|end[-\\s]?to[-\\s]?end\\s+)?implementations?\\s+projects?\\b", "i")),
      ams: zeroIfDefaultMetric(raw, parsed.amsProjects || 0, ["amsProjects", "ams_projects", "ams_support_project_count"], new RegExp("\\b1\\s+(?:ams|support)\\s+projects?\\b", "i")),
      rollout: zeroIfDefaultMetric(raw, parsed.rolloutProjects || 0, ["rolloutProjects", "rollout_projects", "rollout_project_count"], new RegExp("\\b1\\s+roll[-\\s]?out\\s+projects?\\b", "i")),
      greenfield: parsed.greenfieldProjects || 0,
      brownfield: parsed.brownfieldProjects || 0,
      migration: Number(raw?.migration_projects || raw?.migrationProjectCount || 0) || 0,
      transformation: parsed.selectiveTransformationProjects || 0,
      s4: zeroIfDefaultMetric(raw, parsed.s4hanaProjects || parsed.s4ImplementationProjects || 0, ["s4hanaProjects", "s4hana_projects", "s4hana_project_count", "s4_implementation_count"], new RegExp("\\b1\\s+(?:s\\/?4hana|s4hana|s\\/4\\s+hana)\\s+(?:implementation\\s+)?projects?\\b", "i")),
    },
    duplicateKey: qualityGate.duplicateKey || duplicateFingerprint(raw),
    parserQualityScore: qualityGate.parserQualityScore,
    allowedForRanking: qualityGate.allowedForRanking,
    allowedForExecutiveExport: qualityGate.allowedForExecutiveExport && !identityReviewRequired && Boolean(nameResult.name),
    identityReviewRequired,
    identityReviewReason,
    companyCategory: qualityGate.companyCategory,
    auditWarnings: warnings,
  };
}

export function validateCanonicalCandidateProfile(profile: CanonicalCandidateProfile) {
  const issues: string[] = [];
  if (profile.needsManualReview || !profile.displayName) issues.push("Missing names");
  if (!profile.allowedForRanking) issues.push("Parser quality below ranking threshold");
  if (profile.currentCompany === "Not disclosed") issues.push("Missing employer");
  if (!["Consulting Firm", "In-house", "Not disclosed"].includes(profile.companyType)) issues.push("Invalid company type");
  if (profile.sapYears < 0 || profile.sapYears > 35) issues.push("Invalid SAP years");
  if (!["Consulting Firm", "In-house", "Mixed (Consulting Firm + In-house)", "Not disclosed"].includes(profile.backgroundExperience)) issues.push("Invalid background");
  return issues;
}

