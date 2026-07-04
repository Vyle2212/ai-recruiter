import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";
import { dedupeByCanonicalIdentity } from "./identityResolution";

export type AnyRecord = Record<string, any>;

export type CompareDimensionKey =
  | "overall"
  | "moduleFit"
  | "implementation"
  | "s4hana"
  | "industry"
  | "consulting"
  | "leadership"
  | "communication"
  | "technicalDepth"
  | "deliveryOwnership"
  | "careerStability"
  | "regional"
  | "availability"
  | "compensation"
  | "risk";

export type DimensionResult = {
  key: CompareDimensionKey;
  label: string;
  value: number | null;
  level: "Leading" | "Strong" | "Moderate" | "Validate" | "Unknown";
  evidence: string;
  risk: string;
  validation: string;
};

export type CandidateCompareSignal = {
  id: string;
  name: string;
  title: string;
  module: string;
  company: string;
  location: string;
  score: number;
  scoreLabel: string;
  text: string;
  dimensions: Record<CompareDimensionKey, DimensionResult>;
  raw: AnyRecord;
};

export type CompareCriterion = {
  key: CompareDimensionKey;
  label: string;
  winner: CandidateCompareSignal | null;
  leaderValue: number | null;
  advantage: string;
  risk: string;
  validation: string;
  candidateSummaries: Array<{ candidateId: string; name: string; level: string; evidence: string }>;
};

export type ExecutiveRecommendation = {
  recommended: CandidateCompareSignal | null;
  backup: CandidateCompareSignal | null;
  confidence: "High" | "Medium" | "Low";
  confidenceReason: string;
  reasons: string[];
  tradeOffs: string[];
  decision: string;
};

export type CompareInsight = {
  label: string;
  value: string;
  detail: string;
};

export const COMPARE_DIMENSIONS: Array<{ key: CompareDimensionKey; label: string }> = [
  { key: "overall", label: "Overall Match" },
  { key: "moduleFit", label: "SAP Module Fit" },
  { key: "implementation", label: "Implementation" },
  { key: "s4hana", label: "S/4HANA" },
  { key: "industry", label: "Industry Fit" },
  { key: "consulting", label: "Consulting Experience" },
  { key: "leadership", label: "Leadership" },
  { key: "communication", label: "Communication" },
  { key: "regional", label: "Regional Exposure" },
  { key: "deliveryOwnership", label: "Project Ownership" },
  { key: "technicalDepth", label: "Technical Depth" },
  { key: "careerStability", label: "Career Stability" },
  { key: "availability", label: "Availability" },
  { key: "compensation", label: "Salary Fit" },
  { key: "risk", label: "Delivery Risk" },
];

const SAP_MODULES = ["BTP", "FICO", "FI", "CO", "SD", "MM", "ABAP", "BASIS", "EWM", "TM", "S/4HANA", "CPI", "PI/PO", "SUCCESSFACTORS"];
const CONSULTING_FIRMS = ["accenture", "deloitte", "ey", "pwc", "kpmg", "ibm", "capgemini", "cbs", "ntt", "infosys", "tcs", "dxc", "fujitsu", "hitachi", "sap"];

function textOf(value: any): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function clean(value: any, fallback = "Not confirmed") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function firstValue(candidate: AnyRecord, keys: string[], fallback: any = "") {
  for (const key of keys) {
    const value = candidate[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return fallback;
}

function n(value: any, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numeric(candidate: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = n(candidate[key], 0);
    if (value > 0) return value;
  }
  return 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function hasValue(candidate: AnyRecord, keys: string[]) {
  return Boolean(firstValue(candidate, keys));
}

function stripBadCandidateNameSuffix(value: string) {
  const cleaned = clean(value, "").replace(/\s+(age|current location|availability|notice period|salary|current company|location|professional summary)$/i, "").trim();
  return cleaned;
}

function isInvalidCandidateName(value: string): boolean {
  const normalized = stripBadCandidateNameSuffix(value).toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return true;
  const invalidTokens = ["current location", "location", "petaling jaya", "malaysia", "selangor", "kuala lumpur", "unknown", "not disclosed", "protected", "age", "unnamed candidate", "name pending validation", "name not disclosed", "name requires review", "profile requires review", "requires review", "requires validation",
    "needs manual name review", "hajar iexora"];
  if (invalidTokens.some((token) => normalized === token || normalized.startsWith(token + ","))) return true;
  if (/^candidate\s*#?\d+$/i.test(normalized) || /\b(location|address|city|country|current company|current role|job title|availability|notice period|age)\b/i.test(normalized)) return true;
  if (/\d/.test(normalized) || normalized.length > 70) return true;
  return false;
}

function looksLikePersonName(value: string): boolean {
  const normalized = stripBadCandidateNameSuffix(value);
  if (isInvalidCandidateName(normalized)) return false;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;
  return parts.every((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
}

function readableEmailName(value: any) {
  const local = clean(value, "").split("@")[0]?.replace(/[._+-]+/g, " ").replace(/\s+/g, " ").trim();
  return looksLikePersonName(local) ? local.replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

function candidateName(candidate: AnyRecord) {
  return buildCanonicalCandidateProfile(candidate).displayName || "";
}

function cleanCompanyField(value: any) {
  const text = clean(value, "").replace(/[,.;:]+$/g, "");
  if (!text) return "";
  const lower = text.toLowerCase();
  if (["current location", "location", "age", "unknown", "not disclosed", "protected", "not classified", "needs validation", "sap sd"].includes(lower)) return "";
  if (/\b(age|current location|availability|notice period|job title|current role|sap consultant|candidate #|name pending)\b/i.test(text)) return "";
  return text.length <= 90 ? text : "";
}

function experienceItems(candidate: AnyRecord): AnyRecord[] {
  const sources = [candidate.currentExperience, candidate.current_experience, candidate.latestExperience, candidate.latest_experience, candidate.workExperience, candidate.work_experience, candidate.experience, candidate.experiences, candidate.employmentHistory, candidate.employment_history, candidate.positions, candidate.jobs, candidate.parsedProfile?.experience, candidate.parsedProfile?.workExperience, candidate.parsedResume?.experience, candidate.resume?.experience];
  return sources.flatMap((source) => Array.isArray(source) ? source : source && typeof source === "object" ? [source] : []).filter((item) => item && typeof item === "object") as AnyRecord[];
}

function experienceCompany(record: AnyRecord) {
  return cleanCompanyField(record.company || record.companyName || record.company_name || record.employer || record.organization || record.organisation || record.client || record.account);
}

function currentExperience(record: AnyRecord) {
  const end = clean(record.endDate || record.end_date || record.to || record.until || record.period, "").toLowerCase();
  return !end || /present|current|now|ongoing|till date|to date/.test(end);
}

function companyFromText(candidate: AnyRecord) {
  const text = textOf(candidate);
  const known = text.match(/\b(Capgemini Services|Wipro Technologies|Telekom Malaysia Berhad|Orisoft Technology Sdn Bhd|Petronas Digital|Petronas Trading|Petronas|Accenture|Deloitte|PwC|KPMG|EY|IBM Consulting|NTT DATA|TCS|Infosys|HCLTech|DXC|Fujitsu|Hitachi|ABeam|TDI APJ|BASF|DKSH|Shell|BP|Nestle|Unilever|Toyota|Malaysia Airports)\b/i)?.[1];
  if (known) return cleanCompanyField(known);
  return "";
}

function candidateCompany(candidate: AnyRecord) {
  const direct = cleanCompanyField(firstValue(candidate, ["current_company", "currentCompany", "currentEmployer", "current_employer", "employer", "company"]));
  if (direct) return direct;
  const records = experienceItems(candidate);
  const current = records.find((record) => currentExperience(record) && experienceCompany(record));
  if (current) return experienceCompany(current);
  const first = records.find((record) => experienceCompany(record));
  if (first) return experienceCompany(first);
  return companyFromText(candidate) || "Not disclosed";
}
function cleanIdentityField(value: any, fallback: string) {
  const text = clean(value, "");
  if (!text) return fallback;
  if (text.length > 90) return fallback;
  if (/[.]{2,}|\b(the domain of|responsible for|experience in|worked on|project scope|implemented)\b/i.test(text)) return fallback;
  return text;
}

function isGenericRole(value: any) {
  const text = clean(value, "").toLowerCase();
  return !text || /^(sap candidate|candidate|consultant|engineer|sap consultant|sap engineer|profile under review|role to verify)$/i.test(text);
}

function candidateTitle(candidate: AnyRecord) {
  const priorityKeys = [
    "current_position",
    "currentPosition",
    "current_job_title",
    "currentJobTitle",
    "current_title",
    "currentTitle",
    "current_employer_role",
    "employer_role",
    "headline",
    "resume_headline",
    "title",
    "position",
    "role",
  ];
  for (const key of priorityKeys) {
    const value = cleanIdentityField(candidate[key], "");
    if (value && !isGenericRole(value)) return value;
  }
  const module = clean(firstValue(candidate, ["primary_module", "primaryModule", "module", "sap_module", "primarySapModule", "sapModule"]), "SAP").replace(/^SAP\s+/i, "");
  const seniority = clean(firstValue(candidate, ["seniority", "seniority_level", "level"]), "Senior");
  if (/architect/i.test(textOf(candidate))) return `Enterprise SAP ${module} Architect`;
  return `${seniority} SAP ${module} Consultant`;
}

function candidateModule(candidate: AnyRecord, text: string) {
  const explicit = clean(firstValue(candidate, ["primary_module", "primaryModule", "module", "sap_module", "primarySapModule", "sapModule"]), "").replace(/^SAP\s+/i, "").toUpperCase();
  const title = candidateTitle(candidate).toUpperCase();
  const functionalTitle = /\b(FI|FICO|CO|MM|SD|PP|PM|QM|EWM|TM|SUCCESSFACTORS|HCM|BASIS|ABAP)\b/.test(title);
  const titleHasBtp = /\b(BTP|BUSINESS TECHNOLOGY PLATFORM|CPI|INTEGRATION SUITE|CAP|RAP)\b/.test(title);
  if (explicit && !["UNKNOWN", "SAP UNKNOWN", "N/A", "NA", "SAP"].includes(explicit)) {
    if (["CPI", "INTEGRATION SUITE", "SAP BUILD", "CAP", "RAP", "EXTENSION SUITE", "API MANAGEMENT", "EVENT MESH", "CLOUD FOUNDRY"].includes(explicit)) return "BTP";
    if (explicit === "BTP" && functionalTitle && !titleHasBtp) return title.match(/\b(FICO|FI|CO|MM|SD|PP|PM|QM|EWM|TM|SUCCESSFACTORS|HCM|BASIS|ABAP)\b/)?.[1] || "UNKNOWN";
    if (["UI5", "GATEWAY"].includes(explicit)) return "FIORI";
    if (["BW/4", "BW4", "DATASPHERE"].includes(explicit)) return "BW";
    return explicit;
  }
  if (!functionalTitle && countMatches(text, ["cpi", "integration suite", "sap build", "cap", "rap", "extension suite", "api management", "event mesh", "cloud foundry"])) return "BTP";
  if (titleHasBtp) return "BTP";
  if (countMatches(text, ["ui5", "gateway", "fiori"])) return "FIORI";
  if (countMatches(text, ["bw/4", "bw4", "datasphere", "bw"])) return "BW";
  const found = SAP_MODULES.find((module) => text.includes(module.toLowerCase()));
  return found || "UNKNOWN";
}

function scoreLevel(value: number | null): DimensionResult["level"] {
  if (value === null) return "Unknown";
  if (value >= 84) return "Leading";
  if (value >= 72) return "Strong";
  if (value >= 58) return "Moderate";
  return "Validate";
}

function dimension(key: CompareDimensionKey, label: string, value: number | null, evidence: string, risk: string, validation: string): DimensionResult {
  const score = value === null ? null : clamp(value);
  return { key, label, value: score, level: scoreLevel(score), evidence, risk, validation };
}

function buildDimension(candidate: AnyRecord, key: CompareDimensionKey, label: string, text: string, module: string): DimensionResult {
  const title = candidateTitle(candidate).toLowerCase();
  const years = numeric(candidate, ["years", "experience_years", "total_years", "years_experience", "sap_years"]);
  const implementationCount = numeric(candidate, ["implementation_project_count", "implementationProjects", "implementation_projects", "implementation_count", "implementation", "implementations"]);
  const s4Count = numeric(candidate, ["s4hana_project_count", "s4_implementation_count", "s4hanaProjects", "s4hana_projects", "s4_count", "s4hana_count"]);
  const baseScore = numeric(candidate, ["searchFit", "search_fit", "matchScore", "match_score", "finalScore", "calibratedScore", "score", "profile_quality_score", "quality_score"]);
  const implementationAuthority = numeric(candidate, ["implementationAuthority", "implementation_authority", "implementation_authority_score"]);
  const technicalDepth = numeric(candidate, ["technicalDepth", "technical_depth", "moduleDepth", "module_depth", "roleComplexity", "role_complexity"]);
  const consultingDNA = numeric(candidate, ["consultingDNA", "consulting_dna", "consulting_dna_score"]);
  const moduleAuthority = numeric(candidate, ["moduleAuthority", "module_authority", "module_authority_score", "sapModuleScore", "sap_module_score"]);

  if (key === "overall") {
    return dimension(key, label, baseScore || null, baseScore ? "Search fit score supports recruiter review." : "Not enough validated evidence yet.", "Overall suitability may shift after recruiter screening.", "Validate missing submission blockers before final ranking.");
  }

  if (key === "moduleFit") {
    const moduleHits = module !== "SAP" && module !== "UNKNOWN" ? countMatches(text, [module, "sap " + module]) : countMatches(text, SAP_MODULES);
    const value = moduleAuthority || (moduleHits ? 72 + moduleHits * 7 : baseScore || null);
    return dimension(key, label, value, value && module !== "UNKNOWN" ? "SAP " + module + " alignment is supported by profile evidence." : "Primary SAP module needs recruiter confirmation.", "Module depth may be broader than the client mandate.", "Confirm module depth against the job requirement.");
  }

  if (key === "implementation") {
    const hits = countMatches(text, ["implementation", "greenfield", "rollout", "go-live", "go live", "blueprint", "full cycle", "full-cycle"]);
    const value = implementationAuthority || (implementationCount ? 76 + implementationCount * 5 : hits ? 58 + hits * 6 : null);
    return dimension(key, label, value, value ? "Implementation delivery is referenced in the available profile." : "Implementation ownership is not clearly evidenced.", "Full-cycle accountability may be unproven.", "Validate personal ownership from design through go-live or hypercare.");
  }

  if (key === "s4hana") {
    const hits = countMatches(text, ["s/4", "s4hana", "s4 hana", "s/4hana"]);
    const value = s4Count ? 78 + s4Count * 5 : hits ? 70 : null;
    return dimension(key, label, value, value ? "S/4HANA exposure is referenced." : "S/4HANA ownership is not confirmed.", "Transformation relevance may need validation.", "Confirm S/4HANA scope, phase, and ownership.");
  }

  if (key === "industry") {
    const industry = firstValue(candidate, ["industry", "industries", "domain", "sector"]);
    return dimension(key, label, industry ? 72 : null, industry ? "Industry: " + clean(textOf(industry)) + "." : "Industry context is not confirmed.", "Client industry alignment may require positioning work.", "Confirm relevant industry exposure during screening.");
  }

  if (key === "consulting") {
    const hits = countMatches(text, ["consultant", "consulting", "advisory", "workshop", ...CONSULTING_FIRMS]);
    const value = consultingDNA || (hits ? 64 + hits * 5 : null);
    return dimension(key, label, value, value ? "Consulting or client-service background appears in the profile." : "Consulting exposure is not explicit.", "Client-facing maturity may need confirmation.", "Confirm direct client ownership and stakeholder engagement.");
  }

  if (key === "leadership") {
    const hits = countMatches(text + " " + title, ["lead", "manager", "principal", "head", "director", "team lead", "workstream", "ownership"]);
    return dimension(key, label, hits ? 60 + hits * 7 : null, hits ? "Leadership responsibility is referenced in the profile." : "Leadership scope is not yet evidenced.", "People or workstream leadership may be overstated.", "Confirm team size, governance role, and decision authority.");
  }

  if (key === "communication") {
    const hits = countMatches(text, ["workshop", "presentation", "stakeholder", "steering", "training", "business users", "client-facing", "client facing"]);
    return dimension(key, label, hits ? 64 + hits * 5 : null, hits ? "Stakeholder or workshop delivery is referenced in the profile." : "Communication evidence is not available before interview.", "Client communication quality remains untested.", "Assess communication clarity during recruiter screen.");
  }

  if (key === "technicalDepth") {
    const hits = countMatches(text, ["architecture", "integration", "cpi", "api", "odata", "fiori", "abap", "cloud", "extension", "btp"]);
    const value = technicalDepth || (hits ? 52 + hits * 6 : null);
    return dimension(key, label, value, value ? "Architecture and integration evidence is visible in the profile." : "Architecture evidence is not strongly confirmed.", "Depth may be narrower than the role requires.", "Screen for hands-on depth versus advisory exposure.");
  }

  if (key === "deliveryOwnership") {
    const hits = countMatches(text, ["delivery", "ownership", "responsible", "governance", "program", "programme", "workstream"]);
    const value = implementationAuthority || (hits ? 58 + hits * 6 : null);
    return dimension(key, label, value, value ? "Delivery ownership language is present." : "Delivery accountability is not confirmed.", "Ownership may be contributor-level rather than lead-level.", "Confirm delivery accountability and escalation ownership.");
  }

  if (key === "careerStability") {
    return dimension(key, label, years ? Math.min(88, 50 + years * 2) : null, years ? String(years) + " years of experience recorded." : "Career tenure requires confirmation.", "Frequent moves or gaps cannot be assessed from current data.", "Confirm tenure, latest employer, and reason for movement.");
  }

  if (key === "regional") {
    const location = firstValue(candidate, ["country", "location", "current_location", "region", "display_location"]);
    const hits = countMatches(text, ["regional", "apac", "asean", "singapore", "malaysia", "thailand", "vietnam", "indonesia", "philippines", "australia", "japan", "china", "india"]);
    return dimension(key, label, location || hits ? 62 + hits * 5 : null, location ? "Location: " + clean(location) + "." : "Regional delivery evidence is not clear.", "Regional fit may require client-specific validation.", "Confirm markets covered and remote or travel readiness.");
  }

  if (key === "availability") {
    const availability = firstValue(candidate, ["availability", "available_from", "openStatus", "open_status", "notice_period"]);
    return dimension(key, label, availability ? 72 : null, availability ? "Availability recorded: " + clean(availability) + "." : "Availability is not confirmed.", "Submission timing may be blocked.", "Confirm availability before client submission.");
  }

  if (key === "compensation") {
    const compensation = firstValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "current_salary", "salary"]);
    return dimension(key, label, compensation ? 70 : null, compensation ? "Compensation data exists for recruiter review." : "Compensation is not confirmed.", "Package mismatch could become a late-stage risk.", "Confirm current and expected package during screening.");
  }

  const missingContact = !hasValue(candidate, ["email", "phone", "mobile", "contact_email", "contact_phone"]);
  const missingAvailability = !hasValue(candidate, ["availability", "available_from", "openStatus", "open_status"]);
  const missingCompensation = !hasValue(candidate, ["expected_salary", "expectedSalary", "salary_expectation", "current_salary", "salary"]);
  const riskPenalty = (missingContact ? 25 : 0) + (missingAvailability ? 15 : 0) + (missingCompensation ? 12 : 0) + (implementationCount || implementationAuthority ? 0 : 20);
  return dimension(key, label, 100 - riskPenalty, riskPenalty ? "Submission blockers remain open." : "Core submission blockers appear lower.", missingContact ? "Contact path is not available." : "Risk should still be checked against client mandate.", "Resolve contact, availability, salary, and implementation ownership before release.");
}

export function normalizeCompareCandidate(candidate: AnyRecord): CandidateCompareSignal {
  const text = textOf(candidate).toLowerCase();
  const module = candidateModule(candidate, text);
  const dimensions = Object.fromEntries(
    COMPARE_DIMENSIONS.map(({ key, label }) => [key, buildDimension(candidate, key, label, text, module)])
  ) as Record<CompareDimensionKey, DimensionResult>;

  const scored = Object.values(dimensions).filter((item) => item.value !== null) as Array<DimensionResult & { value: number }>;
  const baseScore = numeric(candidate, ["searchFit", "search_fit", "matchScore", "match_score", "finalScore", "calibratedScore", "score", "profile_quality_score", "quality_score"]);
  const evidenceScore = scored.length ? scored.reduce((sum, item) => sum + item.value, 0) / scored.length : baseScore || 45;
  const canonicalProfile = buildCanonicalCandidateProfile(candidate);
  const parserQuality = Number(candidate.parser_quality_score ?? candidate.profile_quality_score ?? candidate.quality_score ?? canonicalProfile.parserQualityScore ?? 0);
  const qualityCappedScore = canonicalProfile.allowedForRanking ? (baseScore ? baseScore * 0.45 + evidenceScore * 0.55 : evidenceScore) : Math.min(45, parserQuality);
  const score = clamp(qualityCappedScore);

  return {
    id: clean(firstValue(candidate, ["id", "candidate_id", "email", "name"], candidateName(candidate))),
    name: canonicalProfile.displayName || candidateName(candidate),
    title: candidateTitle(candidate),
    module,
    company: canonicalProfile.currentCompany,
    location: clean(firstValue(candidate, ["display_location", "location", "country", "current_location"]), "Location to verify"),
    score,
    scoreLabel: score >= 85 ? "Strong Match" : score >= 72 ? "Shortlist Review" : score >= 58 ? "Conditional" : "Hold",
    text,
    dimensions,
    raw: candidate,
  };
}

function submissionDecisionScore(candidate: CandidateCompareSignal) {
  const value = (key: CompareDimensionKey) => candidate.dimensions[key].value ?? 42;
  const implementation = value("implementation");
  const moduleFit = value("moduleFit");
  const ownership = value("deliveryOwnership");
  const consulting = value("consulting");
  const availability = value("availability");
  const compensation = value("compensation");
  const risk = value("risk");
  const s4hana = value("s4hana");
  return (
    implementation * 0.22 +
    moduleFit * 0.2 +
    ownership * 0.16 +
    consulting * 0.12 +
    s4hana * 0.1 +
    availability * 0.08 +
    compensation * 0.06 +
    risk * 0.06
  );
}

export function rankCompareCandidates(candidates: CandidateCompareSignal[]) {
  return dedupeByCanonicalIdentity(candidates).filter((candidate) => buildCanonicalCandidateProfile(candidate.raw || candidate).allowedForRanking).sort((a, b) => {
    const aProfile = buildCanonicalCandidateProfile(a.raw || a);
    const bProfile = buildCanonicalCandidateProfile(b.raw || b);
    if (aProfile.needsManualReview !== bProfile.needsManualReview) return aProfile.needsManualReview ? 1 : -1;
    return submissionDecisionScore(b) - submissionDecisionScore(a);
  });
}

export function compareCriteria(candidates: CandidateCompareSignal[]): CompareCriterion[] {
  return COMPARE_DIMENSIONS.map(({ key, label }) => {
    const ranked = [...candidates].sort((a, b) => (b.dimensions[key].value ?? -1) - (a.dimensions[key].value ?? -1));
    const topValue = ranked[0]?.dimensions[key].value ?? null;
    const secondValue = ranked[1]?.dimensions[key].value ?? null;
    const winner = topValue === null || (secondValue !== null && Math.abs(topValue - secondValue) < 7) ? null : ranked[0];
    const weakest = [...candidates].sort((a, b) => (a.dimensions[key].value ?? 101) - (b.dimensions[key].value ?? 101))[0];
    return {
      key,
      label,
      winner,
      leaderValue: winner ? winner.dimensions[key].value : topValue,
      advantage: winner ? winner.dimensions[key].evidence : "Comparable evidence. Recruiter validation should decide this factor.",
      risk: weakest ? weakest.dimensions[key].risk : "Risk cannot be assessed without candidates.",
      validation: winner ? winner.dimensions[key].validation : "Validate this criterion during recruiter screening.",
      candidateSummaries: candidates.map((candidate) => ({
        candidateId: candidate.id,
        name: candidate.name,
        level: candidate.dimensions[key].level,
        evidence: candidate.dimensions[key].evidence,
      })),
    };
  });
}

export function confidenceFor(candidates: CandidateCompareSignal[]): ExecutiveRecommendation["confidence"] {
  const known = candidates.flatMap((candidate) => Object.values(candidate.dimensions)).filter((item) => item.value !== null).length;
  const total = candidates.length * Object.keys(candidates[0]?.dimensions || {}).length;
  const ratio = total ? known / total : 0;
  if (ratio >= 0.78) return "High";
  if (ratio >= 0.52) return "Medium";
  return "Low";
}

export function buildStrengths(candidate: CandidateCompareSignal) {
  return Object.entries(candidate.dimensions)
    .filter(([, result]) => (result.value ?? 0) >= 70)
    .sort((a, b) => (b[1].value ?? 0) - (a[1].value ?? 0))
    .slice(0, 4)
    .map(([label, result]) => ({ label, text: result.evidence }));
}

export function buildRisks(candidate: CandidateCompareSignal) {
  return Object.entries(candidate.dimensions)
    .filter(([, result]) => result.value === null || (result.value ?? 0) < 62)
    .slice(0, 4)
    .map(([label, result]) => ({ label, text: result.validation }));
}

export function buildExecutiveRecommendation(ranked: CandidateCompareSignal[]): ExecutiveRecommendation {
  const recommended = ranked[0] || null;
  const backup = ranked[1] || null;
  const confidence = confidenceFor(ranked);
  if (!recommended) {
    return { recommended: null, backup: null, confidence: "Low", confidenceReason: "Select at least two candidates to generate a recommendation.", reasons: [], tradeOffs: [], decision: "Select candidates to compare." };
  }

  const wins = COMPARE_DIMENSIONS.filter(({ key }) => backup ? (recommended.dimensions[key].value ?? -1) >= (backup.dimensions[key].value ?? -1) : true).slice(0, 4);
  const backupWins = backup ? COMPARE_DIMENSIONS.filter(({ key }) => (backup.dimensions[key].value ?? -1) > (recommended.dimensions[key].value ?? -1)).slice(0, 3) : [];
  const reasons = wins.map(({ key, label }) => label + ": " + recommended.dimensions[key].evidence);
  const tradeOffs = backupWins.length
    ? backupWins.map(({ key, label }) => backup!.name + " may be stronger on " + label.toLowerCase() + ": " + backup!.dimensions[key].evidence)
    : backup
      ? [backup.name + " remains a credible backup if new screening evidence changes availability, package, or ownership confidence."]
      : ["No backup candidate selected yet."];

  return {
    recommended,
    backup,
    confidence,
    confidenceReason: confidence === "High" ? "Most comparison fields have usable evidence." : confidence === "Medium" ? "Recommendation is useful, with several fields still requiring recruiter validation." : "Several critical fields are missing and should be validated before submission.",
    reasons,
    tradeOffs,
    decision: backup ? "Submit " + recommended.name + " first after recruiter validation. Keep " + backup.name + " as backup until screening evidence changes the ranking." : "Submit " + recommended.name + " first after recruiter validation." ,
  };
}

export function buildInsights(ranked: CandidateCompareSignal[], criteria: CompareCriterion[]): CompareInsight[] {
  const leader = ranked[0];
  const backup = ranked[1];
  if (!leader) return [];
  const leaderCriteria = criteria.filter((criterion) => criterion.winner?.id === leader.id);
  const risk = buildRisks(leader)[0];
  return [
    {
      label: "Biggest Advantage",
      value: leaderCriteria[0]?.label || "Overall evidence",
      detail: leaderCriteria[0]?.advantage || leader.name + " has the strongest available comparison profile.",
    },
    {
      label: "Biggest Risk",
      value: risk?.label || "Recruiter validation",
      detail: risk?.text || "Validate implementation ownership, availability, and salary before client submission.",
    },
    {
      label: "Best Use Case",
      value: "SAP " + leader.module + " shortlist lead",
      detail: "Use " + leader.name + " first when the client values SAP " + leader.module + " depth, delivery evidence, and lower submission risk.",
    },
    {
      label: "Best Client Fit",
      value: leader.company === "Confidential" ? "Enterprise SAP client" : leader.company,
      detail: backup ? leader.name + " is the lead option; " + backup.name + " is the backup if the client prioritizes a different trade-off." : "Add another candidate to expose trade-offs.",
    },
    {
      label: "Likely Interview Focus",
      value: "Ownership and stakeholder scope",
      detail: "Screen personal delivery ownership, client-facing accountability, salary expectations, and notice period.",
    },
  ];
}

export function compactLevel(value: number | null) {
  if (value === null) return "Unknown";
  if (value >= 76) return "Strong";
  if (value >= 58) return "Moderate";
  return "Needs validation";
}

export function rankingStatus(index: number) {
  if (index === 0) return "Ready";
  if (index === 1) return "Strong Backup";
  if (index === 2) return "Shortlist Review";
  return "Hold";
}
























