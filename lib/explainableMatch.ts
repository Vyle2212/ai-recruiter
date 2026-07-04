import { parseSearchIntent, type SearchIntent } from "./searchIntentParser";

export type MatchExplanation = {
  overallScore: number;
  moduleFit: number;
  experienceFit: number;
  deliveryFit: number;
  locationFit: number;
  signalFit: number;
  readinessFit: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  gaps: string[];
};

type AnyRecord = Record<string, any>;

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function textOf(value: any) {
  return JSON.stringify(value || "").toLowerCase();
}

function getModule(candidate: AnyRecord) {
  return String(candidate.primaryModule || candidate.primary_module || candidate.requiredModule || "").toUpperCase();
}

function getSecondary(candidate: AnyRecord) {
  const raw = candidate.secondaryModules || candidate.secondary_modules || [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).toUpperCase());
  return String(raw).split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
}

function getYears(candidate: AnyRecord) {
  return n(candidate.years || candidate.yearsOfExperience || candidate.experience_years);
}

function getImplementation(candidate: AnyRecord) {
  return n(candidate.implementationProjects || candidate.implementation_projects || candidate.implementation);
}

function getS4(candidate: AnyRecord) {
  return n(candidate.s4hanaProjects || candidate.s4hana_projects || candidate.s4hana);
}

function hasContact(candidate: AnyRecord) {
  return Boolean(candidate.email || candidate.phone || candidate.mobile);
}

export function explainCandidateMatch(candidate: AnyRecord, intentOrQuery: SearchIntent | string): MatchExplanation {
  const intent = typeof intentOrQuery === "string" ? parseSearchIntent(intentOrQuery) : intentOrQuery;
  const primary = getModule(candidate);
  const secondary = getSecondary(candidate);
  const years = getYears(candidate);
  const implementation = getImplementation(candidate);
  const s4hana = getS4(candidate);
  const text = textOf(candidate);

  const moduleAuthority = n(candidate.moduleAuthority || candidate.primaryModuleAuthority || candidate.module_authority_score || candidate.score, 60);
  const implementationAuthority = n(candidate.implementationAuthority || candidate.implementation_authority_score || candidate.score, 60);
  const roleFit = n(candidate.roleFit || candidate.moduleFit || candidate.score, 60);

  const requiredPrimary = String(intent.primaryModule || "").toUpperCase();
  const secondaryHit = Boolean(requiredPrimary && secondary.includes(requiredPrimary));
  const moduleMismatch = Boolean(requiredPrimary && primary !== requiredPrimary && !secondaryHit);

  let moduleFit = 70;
  if (requiredPrimary) {
    if (primary === requiredPrimary) moduleFit = clamp(Math.max(moduleAuthority, roleFit), 75, 98);
    else if (secondaryHit) moduleFit = requiredPrimary === "BTP" ? 55 : 62;
    else moduleFit = requiredPrimary === "BTP" ? 25 : 35;
  }

  const requiredYears = intent.minYears || n(candidate.requiredYears || candidate.required_years, 7);
  const experienceFit = years >= requiredYears ? 100 : clamp((years / Math.max(requiredYears, 1)) * 100, 25, 86);

  const deliveryFit = clamp(implementationAuthority * 0.55 + Math.min(implementation * 7, 28) + Math.min(s4hana * 4, 18), 30, 98);

  const location = String(candidate.location || candidate.current_location || "").toLowerCase();
  const locationFit = intent.country ? (location.includes(intent.country.toLowerCase()) ? 100 : 52) : 80;

  const signalHits = intent.signals.filter((signal) => text.includes(signal.toLowerCase().replace("s/4hana", "s4hana")) || text.includes(signal.toLowerCase()));
  const signalFit = intent.signals.length ? clamp((signalHits.length / intent.signals.length) * 100, 35, 100) : 82;

  const readinessFit = clamp((hasContact(candidate) ? 86 : 58) + (n(candidate.profileQualityScore || candidate.profile_quality_score, 75) - 75) * 0.35, 35, 96);

  let overallScore = clamp(moduleFit * 0.28 + experienceFit * 0.18 + deliveryFit * 0.24 + locationFit * 0.12 + signalFit * 0.1 + readinessFit * 0.08, 0, 99);

  // Hard recruiter gate: wrong primary module must not be rescued by years/project authority.
  if (moduleMismatch) overallScore = Math.min(overallScore, requiredPrimary === "BTP" ? 52 : 58);
  else if (requiredPrimary === "BTP" && primary !== "BTP") overallScore = Math.min(overallScore, 65);

  const reasons: string[] = [];
  const gaps: string[] = [];

  if (intent.primaryModule && primary === intent.primaryModule) reasons.push(`Primary SAP module match: ${primary}.`);
  else if (intent.primaryModule && secondary.includes(intent.primaryModule)) reasons.push(`${intent.primaryModule} appears as secondary module.`);
  else if (intent.primaryModule) gaps.push(`Primary module is ${primary || "not clear"}, not ${intent.primaryModule}.`);

  if (years) reasons.push(`${years} years SAP experience.`);
  if (implementation) reasons.push(`${implementation} implementation program(s).`);
  if (s4hana) reasons.push(`${s4hana} S/4HANA program(s).`);
  if (intent.country && locationFit === 100) reasons.push(`Location aligned with ${intent.country}.`);
  if (signalHits.length) reasons.push(`Relevant signals: ${signalHits.slice(0, 5).join(", ")}.`);
  if (!hasContact(candidate)) gaps.push("Contact details require unlock or recruiter validation.");
  if (moduleFit < 65) gaps.push("Module alignment needs recruiter review.");
  if (experienceFit < 75) gaps.push("Experience is below preferred threshold.");

  return {
    overallScore,
    moduleFit,
    experienceFit,
    deliveryFit,
    locationFit,
    signalFit,
    readinessFit,
    confidence: overallScore >= 82 ? "high" : overallScore >= 65 ? "medium" : "low",
    reasons,
    gaps,
  };
}
