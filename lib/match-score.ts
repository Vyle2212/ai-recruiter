import {
  buildSapSearchIntent,
  derivePrimarySapModule,
  primarySapModuleCanSatisfySearch,
  sapDisplayLabel,
  sapRoleTypeForModules,
} from "@/lib/sapCanonicalModuleEngine";

type AnyObj = Record<string, any>;

const n = (v: any, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const s = (v: any) => String(v ?? "").trim();

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(x)));

function firstValue(obj: AnyObj, ...keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function parseArray(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return v.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function requiredYears(job: AnyObj): number {
  const explicit = n(firstValue(job, "years_required", "yearsRequired", "required_years", "requiredYears", "years", "min_years"));
  if (explicit > 0) return explicit;
  const text = `${job.title ?? ""} ${job.raw_jd ?? ""} ${job.description ?? ""} ${job.jd_text ?? ""}`;
  const nums = [...text.matchAll(/(\d{1,2})\+?\s*years?/gi)].map((m) => Number(m[1]));
  if (nums.length) return Math.max(...nums);
  if (/senior/i.test(text)) return 7;
  return 7;
}

function candidateYears(candidate: AnyObj): number {
  const direct = n(firstValue(candidate, "years", "yearsOfExperience", "years_of_experience"));
  if (direct > 0) return direct;
  const months = n(firstValue(candidate, "calculated_experience_months"));
  return months > 0 ? Math.floor(months / 12) : 0;
}

function locationFit(candidate: AnyObj, job: AnyObj) {
  const c = `${candidate.location ?? ""} ${candidate.current_location ?? ""}`.toLowerCase();
  const j = `${job.location ?? ""}`.toLowerCase();
  if (!j) return 70;
  return c && (j.includes(c) || c.includes(j)) ? 100 : 60;
}

function requiredModules(job: AnyObj): string[] {
  const explicit = [
    job.primary_module,
    job.required_primary_module,
    job.module,
    job.sap_module,
    ...parseArray(job.modules),
    ...parseArray(job.sap_modules),
  ].filter(Boolean);

  const intent = buildSapSearchIntent({
    rawKeyword: `${job.title ?? ""} ${job.job_title ?? ""} ${job.description ?? ""} ${job.requirements ?? ""} ${job.raw_jd ?? ""} ${job.jd_text ?? ""}`,
    explicitModules: explicit,
  });

  return intent.requiredModules;
}

function moduleFit(candidate: AnyObj, modules: string[]) {
  if (!modules.length) return clamp(n(firstValue(candidate, "module_authority_score", "module_authority"), 60));
  const primary = derivePrimarySapModule(candidate, {});
  const ok = modules.every((m) => primarySapModuleCanSatisfySearch(primary, m, candidate, {}));
  if (!ok) return 0;
  const authority = n(firstValue(candidate, "module_authority_score", "module_authority"));
  return clamp(authority || 88);
}

function projectFit(candidate: AnyObj, job: AnyObj) {
  const impl = n(candidate.implementation_project_count ?? candidate.implementationProjects);
  const authority = n(candidate.implementation_authority || candidate.implementation_authority_score);
  const s4 = n(candidate.s4hana_project_count ?? candidate.s4_implementation_count);
  const rollout = n(candidate.rollout_project_count);
  const migration = n(candidate.migration_project_count);

  let score = Math.min(100, impl * 10) * 0.4 + Math.min(100, s4 * 12) * 0.25 + Math.min(100, rollout * 12) * 0.2 + Math.min(100, migration * 8) * 0.15;
  if (authority > 0) score = Math.max(score, authority * 0.65);
  if (job.requires_s4hana && s4 === 0) score -= 12;
  if (job.requires_implementation && impl === 0) score -= 18;
  return clamp(score);
}

function consultingFit(candidate: AnyObj, job: AnyObj) {
  const consulting = n(firstValue(candidate, "consulting_dna_score", "consulting_dna"));
  const workshops = n(candidate.client_workshop_count) + n(candidate.business_process_workshop_count) + n(candidate.fit_gap_count) + n(candidate.blueprint_count);
  const regional = n(candidate.regional_delivery_score) + n(candidate.apac_project_count) + n(candidate.global_project_count);
  const presales = n(candidate.presales_count) + n(candidate.rfp_count) + n(candidate.proposal_count) + n(candidate.solutioning_count) + n(candidate.poc_count);
  let score = Math.min(100, consulting || workshops * 8) * 0.45 + Math.min(100, regional * 8) * 0.35 + Math.min(100, presales * 20) * 0.2;
  if (job.requires_workshop && workshops === 0) score -= 10;
  if ((job.requires_apac_delivery || job.requires_regional_delivery) && regional === 0) score -= 15;
  if (job.requires_presales && presales === 0) score -= 6;
  return clamp(score);
}

function confidence(candidate: AnyObj, years: number, finalScore: number) {
  const name = s(candidate.name).toLowerCase();
  const title = s(candidate.current_title || candidate.title || candidate.headline);
  if (years === 0) return "low";
  if (!name || name.includes("candidate name not detected") || name.includes("review required")) return "medium";
  if (!title) return "medium";
  return finalScore >= 75 ? "high" : "medium";
}

export function calculateMatchScore(candidate: AnyObj, job: AnyObj) {
  const years = candidateYears(candidate);
  const required = requiredYears(job);
  const modules = requiredModules(job);
  const primary = derivePrimarySapModule(candidate, {});

  const mFit = moduleFit(candidate, modules);
  const expFit = years >= required ? 100 : Math.max(0, (years / Math.max(required, 1)) * 100);
  const pFit = projectFit(candidate, job);
  const cFit = consultingFit(candidate, job);
  const locFit = locationFit(candidate, job);
  const brandFit = clamp(n(firstValue(candidate, "employer_reputation_score", "employer_reputation")) * 3.3);

  let score = mFit * 0.34 + expFit * 0.22 + pFit * 0.18 + cFit * 0.14 + locFit * 0.08 + brandFit * 0.04;

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (mFit >= 75) strengths.push(`Primary ${modules.map(sapDisplayLabel).join(" + ") || primary} authority confirmed`);
  else gaps.push(`Primary module is ${primary || "UNKNOWN"}; requested ${modules.map(sapDisplayLabel).join(" + ") || "SAP"} not confirmed as primary`);

  if (pFit >= 70) strengths.push(`Project delivery evidence: ${pFit}/100`);
  if (cFit >= 70) strengths.push(`Consulting DNA: ${cFit}/100`);
  if (years >= required) strengths.push(`Experience meets requirement: ${years} years`);
  else gaps.push(`Experience gap: requires ${required} years, candidate has ${years}`);

  let cap = 96;
  if (modules.length && mFit === 0) cap = 45;
  if (years === 0) cap = Math.min(cap, 70);
  if (s(candidate.name).toLowerCase().includes("candidate name not detected") || s(candidate.name).toLowerCase().includes("review required")) cap = Math.min(cap, 85);
  if (years < required) score -= Math.min(20, (required - years) * 2);

  const finalScore = clamp(Math.min(score, cap));
  const label = finalScore >= 85 ? "Strong match" : finalScore >= 70 ? "Good match" : finalScore >= 50 ? "Potential match" : "Weak match";

  return { score: finalScore, strengths: Array.from(new Set(strengths)), gaps: Array.from(new Set(gaps)), confidence: confidence(candidate, years, finalScore), label, roleType: sapRoleTypeForModules(modules) };
}

export function scoreCandidateForJob(job: AnyObj, candidate: AnyObj) {
  const r = calculateMatchScore(candidate, job);
  return { score: r.score, recommendation: r.label, label: r.label, strengths: r.strengths, gaps: r.gaps, confidence: r.confidence };
}

export function calculateMatch(candidate: AnyObj, job: AnyObj) { return calculateMatchScore(candidate, job); }
export const scoreCandidate = calculateMatchScore;
export const matchScore = calculateMatchScore;
export default calculateMatchScore;
