import { createHash } from "node:crypto";
import { CANDIDATE_CANONICAL_VERSION, normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";
import { SEARCH_CONCEPTS } from "./candidateSearchConcepts";

export const CANDIDATE_PARSER_VERSION = "candidate-parser-v2";
export const CANDIDATE_NORMALIZATION_VERSION = CANDIDATE_CANONICAL_VERSION;

export type CapabilityVerification = "VERIFIED" | "SUPPORTED" | "MENTION_ONLY" | "NOT_FOUND";
export type CapabilityProvenance = "DIRECT_STRUCTURED" | "EXPLICIT_SOURCE_TEXT" | "PROJECT_CONTEXT" | "INFERRED";
export type DomainEvidenceClass = "PRIMARY" | "STRONG" | "SUPPORTED" | "EXPOSURE" | "UNVERIFIED";

const text = (value: unknown) => String(value ?? "").normalize("NFKC").trim();
const list = (value: unknown) => Array.isArray(value) ? value : [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizedName = (value: unknown) => text(value).toLowerCase().replace(/\b(?:mr|mrs|ms|dr)\.?\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const normalizedPhone = (value: unknown) => text(value).replace(/\D/g, "");
const normalizedUrl = (value: unknown) => text(value).toLowerCase().replace(/\?.*$/, "").replace(/\/$/, "");

function sourceNarrative(raw: Record<string, any>) {
  return [raw.raw_text, raw.resume_text, raw.raw_cv, raw.summary, raw.experience, raw.work_experience]
    .flatMap((value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.map((item) => JSON.stringify(item)) : [])
    .join("\n");
}

function implementationSourceState(raw: Record<string, any>) {
  const contexts = sourceNarrative(raw).split(/(?<=[.!?\n])\s+/).filter((part) => /\bimplement(?:ations?|ed|ing)?\b/i.test(part));
  if (contexts.some((part) => /\b(?:full[- ]?(?:life[- ]?)?cycle|end[- ]?to[- ]?end|greenfield|brownfield)\b.{0,160}\bimplement|\bimplement.{0,160}\b(?:full[- ]?(?:life[- ]?)?cycle|end[- ]?to[- ]?end|greenfield|brownfield)\b/i.test(part)
    && /\b(?:lead|led|owner|owned|responsible|architect|manager|consultant|delivered|executed|completed)\b/i.test(part))) return "VERIFIED";
  if (contexts.some((part) => /\b(?:project|role|consultant|lead|team|participat|involv|responsib|deliver|execut|configur|implement(?:ed|ing))\b/i.test(part))) return "SUPPORTED";
  return contexts.length ? "MENTION_ONLY" : "NOT_FOUND";
}

function capability(name: string, projects: any[], aggregateCount: number, raw: Record<string, any>) {
  const matching = projects.filter((project) => new RegExp(name === "implementation" ? "implementation|greenfield|brownfield" : name, "i")
    .test([project.projectType, project.implementationType, project.role, project.name, ...(project.responsibilities || [])].join(" ")));
  const ownership = matching.some((project) => /\b(?:lead|owner|architect|manager|full[- ]?cycle|end[- ]?to[- ]?end)\b/i
    .test([project.role, ...(project.responsibilities || [])].join(" ")));
  if (ownership) return { capability: name, provenance: "DIRECT_STRUCTURED" as const, confidence: "HIGH", verification: "VERIFIED" as const, evidenceCount: matching.length };
  if (matching.length) return { capability: name, provenance: "PROJECT_CONTEXT" as const, confidence: "MEDIUM", verification: "SUPPORTED" as const, evidenceCount: matching.length };
  if (name === "implementation") {
    const sourceState = implementationSourceState(raw);
    if (sourceState === "VERIFIED") return { capability: name, provenance: "EXPLICIT_SOURCE_TEXT" as const, confidence: "HIGH", verification: "VERIFIED" as const, evidenceCount: 1 };
    if (sourceState === "SUPPORTED") return { capability: name, provenance: "EXPLICIT_SOURCE_TEXT" as const, confidence: "MEDIUM", verification: "SUPPORTED" as const, evidenceCount: 1 };
  }
  if (aggregateCount > 0) return { capability: name, provenance: "EXPLICIT_SOURCE_TEXT" as const, confidence: "LOW", verification: "MENTION_ONLY" as const, evidenceCount: aggregateCount };
  return { capability: name, provenance: "INFERRED" as const, confidence: "LOW", verification: "NOT_FOUND" as const, evidenceCount: 0 };
}

const LEGACY_DOMAIN_ALIASES: Record<string, string[]> = {
  FICO: ["FICO", "FI/CO", "FI CO", "SAP FI", "SAP CO"], MM: ["SAP MM", "MM"],
  SD: ["SAP SD", "SD"], ABAP: ["SAP ABAP", "ABAP"], BW: ["SAP BW", "BW", "BI/BW"],
  BASIS: ["SAP BASIS", "BASIS"], HCM: ["SAP HCM", "HCM", "SUCCESSFACTORS"],
  PP: ["SAP PP", "PP"], PS: ["SAP PS", "PS"], ARIBA: ["SAP ARIBA", "ARIBA"], TRM: ["SAP TRM", "TRM"],
  JAVA: ["JAVA", "J2EE", "JAVA EE"], MICROSERVICES: ["MICROSERVICES", "MICRO SERVICES", "SPRING CLOUD"],
  DATA_ENGINEERING: ["DATA ENGINEER", "DATA ENGINEERING", "ETL ENGINEER"],
  AZURE_DATABRICKS: ["AZURE DATABRICKS", "DATABRICKS", "AZURE DATA FACTORY"],
  FINANCE: ["FINANCE", "FINANCIAL REPORTING", "IFRS"], IFRS: ["IFRS", "INTERNATIONAL FINANCIAL REPORTING STANDARDS"],
};
const DOMAIN_ALIASES: Record<string, string[]> = Object.fromEntries(
  SEARCH_CONCEPTS.map((concept) => [concept.id, [...new Set([concept.label, ...concept.aliases, ...(concept.roleAliases || [])].map((value) => value.toUpperCase()))]]),
);
for (const [domain, aliases] of Object.entries(LEGACY_DOMAIN_ALIASES)) {
  DOMAIN_ALIASES[domain] = [...new Set([...(DOMAIN_ALIASES[domain] || []), ...aliases])];
}
const ROLE_WORDS = "consultant|lead|specialist|architect|manager|analyst|developer|advisor|owner";
const RESPONSIBILITY_WORDS = /\b(?:configur(?:e|ed|ation|ing)|customiz(?:e|ed|ation|ing)|implement(?:ation|ed|ing)?|business process|process design|solution design|responsib|deliver(?:ed|y)?|workshop|blueprint)\b/i;
const escaped = (value: string) => value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&").replace(/\s+/g, "\\s*");

function domainClass(raw: Record<string, any>, profile: any, aliases: string[]): DomainEvidenceClass {
  const alias = aliases.map(escaped).join("|");
  const explicit = new RegExp(`\\b(?:${alias})\\b`, "i");
  const role = new RegExp(`(?:\\b(?:${alias})\\b.{0,45}\\b(?:${ROLE_WORDS})\\b|\\b(?:${ROLE_WORDS})\\b.{0,45}\\b(?:${alias})\\b)`, "i");
  const title = text(profile.identity?.currentTitle);
  const importedTitles = [raw.current_title, raw.currentTitle, raw.title, raw.headline].map(text).filter(Boolean);
  const employment = list(profile.employmentTimeline).map((item: any) => `${text(item.title)} ${text(item.summary)} ${list(item.responsibilities).join(" ")}`);
  const projects = list(profile.projects).map((item: any) => `${text(item.role)} ${text(item.name)} ${text(item.description)} ${list(item.responsibilities).join(" ")}`);
  const certifications = list(profile.certifications).map((item: any) => typeof item === "string" ? item : `${text(item.title || item.name)} ${text(item.issuer)}`);
  const narrative = sourceNarrative(raw);
  const evidenceTexts = [...employment, ...projects, ...certifications, narrative];
  const occurrences = evidenceTexts.reduce((sum, value) => sum + (String(value).match(new RegExp(`\\b(?:${alias})\\b`, "gi"))?.length || 0), 0);
  const roleContexts = [title, ...importedTitles, ...employment, ...projects].filter((value) => role.test(value));
  const responsibilityContexts = [...employment, ...projects].filter((value) => explicit.test(value) && RESPONSIBILITY_WORDS.test(value));
  const modules = new Set([...list(profile.sapModules), ...list(profile.technicalSkills)].map((item) => text(item).toUpperCase()));
  const moduleMention = aliases.some((value) => modules.has(value.replace(/^SAP\s+/i, "").toUpperCase()))
    || (aliases.includes("FICO") && (modules.has("FICO") || modules.has("FI") || modules.has("CO")));
  if (role.test(title)) return "PRIMARY";
  if (roleContexts.length >= 2 || (roleContexts.length >= 1 && responsibilityContexts.length >= 1)) return "STRONG";
  if (roleContexts.length >= 1 || responsibilityContexts.length >= 1 || occurrences >= 3) return "SUPPORTED";
  if (moduleMention || occurrences > 0) return "EXPOSURE";
  return "UNVERIFIED";
}

function domainImplementationClass(raw: Record<string, any>, profile: any, aliases: string[]) {
  const alias = aliases.map(escaped).join("|");
  const domain = new RegExp("\\b(?:" + alias + ")\\b", "i");
  const implementation = /\b(?:implement(?:ation|ations|ed|ing)?|greenfield|brownfield|full[- ]?(?:life[- ]?)?cycle|end[- ]?to[- ]?end|rollout|roll[- ]out)\b/i;
  const ownership = /\b(?:lead|led|owner|owned|responsib|architect|manager|consultant|deliver(?:ed|y)?|execut(?:ed|ion)|configur(?:e|ed|ation|ing))\b/i;
  const structuredContexts = [
    ...list(profile.employmentTimeline).map((item: any) => [text(item.title), text(item.summary), ...list(item.responsibilities)].join(" ")),
    ...list(profile.projects).map((item: any) => [text(item.role), text(item.name), text(item.description), ...list(item.responsibilities)].join(" ")),
  ];
  const sourceContexts = sourceNarrative(raw).split(/(?<=[.!?\n])\s+/);
  const matching = [...structuredContexts, ...sourceContexts].filter((context) => domain.test(context) && implementation.test(context));
  if (matching.some((context) => ownership.test(context))) return "VERIFIED" as const;
  return matching.length ? "SUPPORTED" as const : "UNVERIFIED" as const;
}

export function classifyCandidateDomains(raw: Record<string, any>, profile: any): Record<string, DomainEvidenceClass> {
  return Object.fromEntries(Object.entries(DOMAIN_ALIASES).map(([domain, aliases]) => [domain, domainClass(raw, profile, aliases)]));
}

export function classifyCandidateDomainImplementation(raw: Record<string, any>, profile: any) {
  return Object.fromEntries(Object.entries(DOMAIN_ALIASES).map(([domain, aliases]) => [
    domain,
    domainImplementationClass(raw, profile, aliases),
  ]));
}

function legacyFicoRelevance(value: DomainEvidenceClass, profile: any) {
  if (value === "PRIMARY") return "PRIMARY_FICO";
  if (value === "STRONG") return "STRONG_FICO";
  if (value === "SUPPORTED" || value === "EXPOSURE") return "FICO_EXPOSURE";
  return list(profile.sapModules).length ? "RELATED_SAP" : "NO_FICO";
}

function seniority(profile: any) {
  const title = text(profile.identity?.currentTitle);
  if (/\b(?:senior|sr\.?|lead|principal|manager|architect|head|director)\b/i.test(title)) return { level: "VERIFIED_SENIOR", confidence: "HIGH" };
  if (profile.careerHighlights?.leadershipExperience) return { level: "SUPPORTED_SENIOR", confidence: "MEDIUM" };
  const years = Number(profile.experienceSummary?.totalCareerYears || 0);
  if (years >= 8) return { level: "SUPPORTED_SENIOR", confidence: "MEDIUM" };
  if (years > 0 && years <= 5) return { level: "NOT_SENIOR", confidence: "MEDIUM" };
  return { level: "UNKNOWN", confidence: "LOW" };
}

function locationEvidence(profile: any) {
  const location = text(profile.identity?.location);
  const country = text(profile.identity?.country);
  if (location && country && !location.toLowerCase().includes(country.toLowerCase()) && !country.toLowerCase().includes(location.toLowerCase())) return "CONFLICTING";
  if (country) return "VERIFIED";
  if (location) return "SUPPORTED";
  return "UNKNOWN";
}

export function canonicalIdentityKey(raw: Record<string, any>, profile: any) {
  const email = text(raw.normalized_email || raw.email).toLowerCase();
  const phone = normalizedPhone(raw.normalized_phone || raw.phone);
  const linkedin = normalizedUrl(raw.linkedin_url || raw.linkedinUrl);
  const document = text(raw.cv_hash || raw.document_fingerprint || raw.resume_hash);
  const name = normalizedName(profile.identity?.name);
  const employment = list(profile.employmentTimeline).map((item: any) => `${normalizedName(item.company)}|${normalizedName(item.title)}|${text(item.start)}`).sort().join(";");
  const education = list(profile.education).map((item: any) => `${normalizedName(item.institution)}|${normalizedName(item.qualification)}`).sort().join(";");
  const strong = email ? `email:${email}` : phone.length >= 8 ? `phone:${phone}` : linkedin ? `linkedin:${linkedin}` : document ? `document:${document}` : "";
  const composite = name ? `name:${name}|employment:${employment}|education:${education}|location:${normalizedName(profile.identity?.location)}` : "";
  return strong || composite || `source:${text(raw.id || raw.candidate_id || raw.source_record_id)}`;
}

export function buildCanonicalCandidateSnapshot(raw: Record<string, any>, sourceRecordId?: string) {
  const payload = normalizeActualCandidateSchema(raw);
  const profile = payload.enterpriseProfile;
  const projects = list(profile.projects);
  const capabilities = {
    implementation: capability("implementation", projects, Number(profile.careerHighlights?.implementationProjects || 0), raw),
    rollout: capability("rollout", projects, Number(profile.careerHighlights?.rolloutProjects || 0), raw),
    ams: capability("ams", projects, Number(profile.careerHighlights?.amsProjects || 0), raw),
    greenfield: capability("greenfield", projects, Number(profile.careerHighlights?.greenfieldProjects || 0), raw),
  };
  const identityKey = canonicalIdentityKey(raw, profile);
  const domainEvidence = classifyCandidateDomains(raw, profile);
  const domainImplementationEvidence = classifyCandidateDomainImplementation(raw, profile);
  return {
    parser_version: CANDIDATE_PARSER_VERSION,
    normalization_version: CANDIDATE_NORMALIZATION_VERSION,
    version: CANDIDATE_NORMALIZATION_VERSION,
    processed_at: new Date().toISOString(),
    canonicalized_at: new Date().toISOString(),
    source_record_id: sourceRecordId || text(raw.id || raw.candidate_id) || null,
    canonical_candidate_id: `canonical-${hash(identityKey).slice(0, 32)}`,
    identity_status: profile.identity?.name ? "RESOLVED" : "NEEDS_REVIEW",
    identity_key_source: identityKey.split(":")[0],
    domain_evidence: domainEvidence,
    domain_implementation_evidence: domainImplementationEvidence,
    fico_relevance: legacyFicoRelevance(domainEvidence.FICO, profile),
    seniority: seniority(profile),
    location_evidence: locationEvidence(profile),
    capabilities,
    payload,
  };
}
