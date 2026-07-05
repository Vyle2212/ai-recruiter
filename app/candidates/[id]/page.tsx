import Link from "next/link";
import type { ReactNode } from "react";
import Candidate360ActionButton from "@/components/candidate-360-action-button";
import Candidate360ExecutiveMatch from "@/components/candidate-360-executive-match";
import Candidate360Notes from "@/components/candidate-360-notes";
import Candidate360RiskWorkflow from "@/components/candidate-360-risk-workflow";
import Candidate360WorkflowStrip from "@/components/candidate-360-workflow-strip";
import CandidateValidationPanel from "@/components/candidate-validation-panel";
import { deriveCandidateWorkflow } from "@/components/candidate-360-workflow-machine";
import { supabase } from "@/lib/supabase";
import { buildCandidate360, type Candidate360Model } from "@/lib/candidate360Engine";
import { buildCandidateValidationState } from "@/lib/candidateValidation";
import { calculateSubmissionConfidence } from "@/lib/submissionConfidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function safeParam(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function safeInternalHref(value: string, fallback = "/search") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return fallback;
    }
  }
  return text.startsWith("/") ? text : fallback;
}

function safeExternalHref(value: any) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;
  return "";
}

function truthyParam(value: string | string[] | undefined) {
  return /^(true|1|yes|approved|paid)$/i.test(safeParam(value, "false"));
}

function hrefWithSource(baseHref: string, source: string, fallbackCompare: string) {
  const safe = safeInternalHref(baseHref, fallbackCompare);
  if (!safe.startsWith("/compare")) return fallbackCompare + "&source=" + encodeURIComponent(source);
  const url = new URL(safe, "http://localhost");
  url.searchParams.set("source", source);
  return `${url.pathname}${url.search}${url.hash}`;
}

function pct(value: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function optionalPct(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

function cleanDisplayText(value: any) {
  return String(value || "")
    .replace(/\s+\?\s+/g, " - ")
    .replace(/\s+->\s+/g, " -> ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningful(value: any) {
  const text = cleanDisplayText(value);
  return Boolean(text && !/^(to confirm|to be confirmed|not verified|n\/a|none|unknown|needs review)$/i.test(text));
}

function firstNumber(...values: any[]) {
  for (const value of values) {
    const score = optionalPct(value);
    if (score !== null) return score;
  }
  return null;
}

function searchFitDisplay(candidate: AnyRecord, matchRow: AnyRecord) {
  const score = firstNumber(
    candidate.search_score,
    candidate.search_fit,
    candidate.searchFit,
    candidate.score,
    matchRow?.search_score,
    matchRow?.score,
  );
  return score === null ? { score: null, label: "Review Before Submission" } : { score, label: String(score) + "%" };
}

function searchQualityBand(score: number | null) {
  if (score === null) return { label: "Review Before Submission", grade: "Review" };
  if (score >= 90) return { label: "Excellent", grade: "A" };
  if (score >= 80) return { label: "Strong", grade: "B+" };
  if (score >= 70) return { label: "Good", grade: "B" };
  return { label: "Review", grade: "C" };
}

function qualityDisplay(candidate: AnyRecord, fallbackScore: number | null) {
  const score = firstNumber(candidate.profile_quality_score, candidate.quality_score, candidate.quality, fallbackScore);
  const meta = searchQualityBand(score);
  return {
    score,
    grade: cleanDisplayText(candidate.quality_grade) || meta.grade,
    label: meta.label,
  };
}

function confidenceDisplay(candidate: AnyRecord, model: Candidate360Model) {
  let score = 28;
  const hasContact = Boolean(candidate.email || candidate.phone);
  const years = Number(candidate.years ?? candidate.years_experience ?? model.identity.years ?? 0);
  const certs = candidateCertifications(candidate);
  const companies = candidateEmployerHistory(candidate, model);
  const skills = uniqueStrings([
    ...normalizeList(candidate.skills),
    ...normalizeList(candidate.modules),
    model.identity.primaryModule,
    ...model.identity.secondaryModules,
  ]);

  if (hasContact) score += 12;
  if (companies.length) score += 10;
  if (years >= 5) score += 6;
  if (years >= 10) score += 4;
  if (skills.length) score += Math.min(10, skills.length * 2);
  if (certs.length) score += 8;
  score += Math.min(
    18,
    model.projectPortfolio.implementation * 4 +
      model.projectPortfolio.s4hana * 3 +
      model.projectPortfolio.greenfield * 2 +
      model.projectPortfolio.brownfield * 2 +
      model.projectPortfolio.rollout * 2 +
      model.projectPortfolio.ams,
  );

  const value = pct(score);
  const label = value >= 95 ? "Ready" : value >= 85 ? "Strong" : value >= 70 ? "Needs Light Validation" : value >= 50 ? "Needs Validation" : "Not Ready";
  return { score: value, label };
}

function formatMoney(value: any, currency = "SGD") {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value || "").replace(/[^\d.-]/g, ""));

  if (!Number.isFinite(n) || n <= 0) return "";
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

function firstValue(...values: any[]) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => cleanDisplayText(value)).filter(Boolean)),
  );
}

function normalizeList(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanDisplayText(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return [];

    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => cleanDisplayText(item))
          .filter(Boolean);
      }
    } catch {}

    return clean
      .replace(/^\[|\]$/g, "")
      .split(/[,;|/]+/)
      .map((item) => cleanDisplayText(item))
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => cleanDisplayText(item))
      .filter(Boolean);
  }

  return [];
}

function avatarInitials(name: string) {
  const parts = String(name || "")
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase();
}

function qualityBand(score: number) {
  const value = pct(score);
  if (value >= 95) return { grade: "A", label: "Excellent" };
  if (value >= 90) return { grade: "A-", label: "Very Strong" };
  if (value >= 85) return { grade: "B+", label: "Strong" };
  if (value >= 80) return { grade: "B", label: "Good" };
  if (value >= 75) return { grade: "B-", label: "Fair" };
  return { grade: "C", label: "Needs Review" };
}

function fieldList(candidate: AnyRecord, fields: string[]) {
  return uniqueStrings(fields.flatMap((field) => normalizeList(candidate[field])));
}

function candidateCertifications(candidate: AnyRecord) {
  return fieldList(candidate, ["certifications", "certification", "certificates", "credentials", "licenses", "certs"]).slice(0, 4);
}

function candidateEducation(candidate: AnyRecord) {
  return fieldList(candidate, ["education", "educations", "degree", "degrees", "qualification", "qualifications", "academic_qualifications", "academicQualifications", "school", "schools", "university", "universities", "college", "colleges"]).slice(0, 4);
}

function candidateIndustries(candidate: AnyRecord) {
  return fieldList(candidate, ["industry", "industries", "sector", "sectors", "domain", "domains", "client_industry", "clientIndustry"]).slice(0, 4);
}

function candidateEmployerHistory(candidate: AnyRecord, model: Candidate360Model) {
  const history = uniqueStrings([
    String(candidate.current_company || candidate.company || model.identity.company || "").trim(),
    String(candidate.previous_company || candidate.previousCompany || candidate.previous_employer || candidate.previousEmployer || "").trim(),
    ...normalizeList(candidate.previous_companies),
    ...normalizeList(candidate.previousCompanies),
    ...normalizeList(candidate.employer_history),
    ...normalizeList(candidate.employerHistory),
  ]);

  if (history.length >= 2) return history.slice(0, 3);
  return uniqueStrings([...history, ...model.sapJourney.moduleEvolution.map((item) => item.company)]).slice(0, 3);
}

function candidateBusinessSignals(candidate: AnyRecord, model: Candidate360Model) {
  return uniqueStrings([
    ...fieldList(candidate, ["business_processes", "businessProcesses", "processes", "processAreas", "functionalAreas"]),
    ...model.sapJourney.signals.filter((signal) => /process|finance|order|procurement|manufacturing|supply|warehouse|hr|payroll|sales|revenue|billing|otc|ptp|r2r/i.test(signal)),
  ]).slice(0, 6);
}

function candidateTextBlob(candidate: AnyRecord, model: Candidate360Model) {
  return [
    candidate.name,
    candidate.title,
    candidate.display_title,
    candidate.current_title,
    candidate.headline,
    candidate.current_company,
    candidate.company,
    candidate.previous_company,
    candidate.previous_companies,
    candidate.education,
    candidate.degree,
    candidate.certification,
    candidate.certifications,
    candidate.skills,
    candidate.modules,
    candidate.industry,
    candidate.industries,
    candidate.summary,
    candidate.resume_text,
    candidate.raw_text,
    model.identity.primaryModule,
    ...model.identity.secondaryModules,
    ...model.sapJourney.modules,
    ...model.sapJourney.signals,
    ...model.summary.bestFor,
    ...model.explainability.whySelected,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
function mergeCandidateWithSearchIndex(candidate: AnyRecord, indexRow: AnyRecord) {
  if (!indexRow) return candidate;

  return {
    ...candidate,
    __index: indexRow,
    primary_module: indexRow.primary_module || candidate.primary_module,
    primaryModule: indexRow.primary_module || candidate.primaryModule || candidate.primary_module,
    secondary_modules: indexRow.all_modules || candidate.secondary_modules || [],
    sap_modules: indexRow.all_modules || candidate.sap_modules || [],
    sap_submodules: indexRow.all_submodules || candidate.sap_submodules || [],
    location: candidate.location || indexRow.display_location || indexRow.country,
    current_location: candidate.current_location || indexRow.display_location || indexRow.country,
    years: candidate.years ?? indexRow.years,
    profile_quality_score: candidate.profile_quality_score ?? indexRow.quality_score,
    greenfield_count: indexRow.greenfield_count ?? candidate.greenfield_count,
    brownfield_count: indexRow.brownfield_count ?? candidate.brownfield_count,
    rollout_count: indexRow.rollout_count ?? candidate.rollout_count,
    s4_count: indexRow.s4_count ?? candidate.s4_count,
    s4_ams_count: indexRow.s4_ams_count ?? candidate.s4_ams_count,
    ams_count: indexRow.ams_count ?? candidate.ams_count,
  };
}

function buildDynamicMarketBenchmark(candidate: AnyRecord, matchRow: AnyRecord) {
  return matchRow?.details?.marketBenchmark || candidate?.marketBenchmark || {};
}
function candidateProducts(candidate: AnyRecord, model: Candidate360Model) {
  const blob = candidateTextBlob(candidate, model);
  const products = ["BTP", "CPI", "PI/PO", "Fiori", "S/4HANA", "ECC", "ABAP", "CDS", "OData", "Cloud", "Integration", "API"];
  return products.filter((item) => blob.includes(item.toLowerCase())).slice(0, 6);
}

function candidateWorkRights(candidate: AnyRecord) {
  return String(candidate.work_authorization || candidate.workAuthorization || candidate.visa_status || candidate.visaStatus || "").replace(/\s+/g, " ").trim();
}

function candidateSalaryValue(candidate: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = candidate[key];
    if (value === null || value === undefined || value === "") continue;
    return value;
  }
  return "";
}

function skillConfidence(candidate: AnyRecord, model: Candidate360Model, label: string, keywords: string[]) {
  const blob = candidateTextBlob(candidate, model);
  let score = 48;
  const directHits = keywords.filter((keyword) => blob.includes(keyword.toLowerCase())).length;
  score += directHits * 12;
  if (model.projectPortfolio.implementation > 0) score += 5;
  if (model.projectPortfolio.s4hana > 0) score += 4;
  if (model.projectPortfolio.ams > 0) score += 3;
  if (model.scorecard.matchScore >= 90) score += 4;
  if (label === "BTP" && model.identity.primaryModule === "BTP") score += 10;
  if (label === "Integration" && /integration|cpi|pi\/po|api/i.test(blob)) score += 6;
  return Math.max(42, Math.min(98, Math.round(score)));
}

function buildExecutiveBrief(model: Candidate360Model) {
  const years = model.identity.years ? String(model.identity.years) + " years" : "multi-year";
  const primary = "SAP " + model.identity.primaryModule;
  const deliveryBits = uniqueStrings([
    model.projectPortfolio.implementation ? String(model.projectPortfolio.implementation) + " implementation" + (model.projectPortfolio.implementation === 1 ? "" : "s") : "",
    model.projectPortfolio.greenfield ? String(model.projectPortfolio.greenfield) + " Greenfield program" + (model.projectPortfolio.greenfield === 1 ? "" : "s") : "",
    model.projectPortfolio.s4hana ? String(model.projectPortfolio.s4hana) + " S/4HANA program" + (model.projectPortfolio.s4hana === 1 ? "" : "s") : "",
    model.projectPortfolio.ams ? String(model.projectPortfolio.ams) + " AMS engagement" + (model.projectPortfolio.ams === 1 ? "" : "s") : "",
  ]).slice(0, 3);

  const opening = (model.identity.displayTitle || model.identity.title || "SAP Consultant") + " with " + years + " in " + primary + " delivery.";
  const delivery = deliveryBits.length
    ? "Enterprise delivery across " + deliveryBits.join(", ") + "."
    : "Enterprise delivery evidence is present and should be reviewed in context.";
  const consulting = "Strong consulting and architecture profile suited to " + model.summary.bestFor.slice(0, 3).join(", ") + ".";
  return [opening, delivery, consulting].slice(0, 2);
}

function decisionStatus(score: number | null, confidenceScore: number) {
  if (score === null) return "Review Before Submission";
  if (score >= 88 && confidenceScore >= 78) return "Submit";
  if (score >= 80) return "Strong Match";
  if (score >= 68) return "Review Before Submission";
  if (score >= 55) return "Hold";
  return "Not Recommended";
}

function buildAiVerdict(model: Candidate360Model, score: number | null, confidenceScore: number) {
  const action = decisionStatus(score, confidenceScore);
  const module = model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "SAP";
  const roleFamily = model.summary.bestFor[0] || "enterprise SAP roles";
  const proof = uniqueStrings([
    model.scorecard.consultingDNA >= 70 ? "consulting background" : "",
    model.projectPortfolio.implementation > 0 ? "implementation exposure" : "",
    model.projectPortfolio.greenfield > 0 ? "Greenfield ownership" : "",
    model.projectPortfolio.s4hana > 0 ? "S/4HANA Exposure" : "",
  ]).slice(0, 2);
  const validation = uniqueStrings([
    model.projectPortfolio.greenfield <= 0 ? "Greenfield ownership" : "recent Greenfield ownership",
    model.projectPortfolio.implementation <= 0 ? "full-cycle implementation ownership" : "architecture responsibilities",
  ]).slice(0, 2);

  return {
    action,
    summary:
      "Best considered for " + roleFamily + ". " +
      "The profile is strongest around " + module + (proof.length ? " with " + proof.join(" and ") : " delivery") + ". " +
      "Validate " + validation.join(" and ") + " before client submission.",
  };
}
function buildSubmissionAngle(model: Candidate360Model, searchFitLabel: string) {
  const module = model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "SAP";
  const bestFor = model.summary.bestFor[0] || "enterprise SAP programmes";
  const proof = uniqueStrings([
    model.scorecard.consultingDNA >= 70 ? "Strong consulting background across enterprise transformation work." : "",
    model.projectPortfolio.implementation > 0 ? "Implementation exposure supports client-facing delivery conversations." : "",
    model.projectPortfolio.greenfield > 0 ? "Greenfield evidence can strengthen the submission if ownership is confirmed." : "Recommend validating Greenfield ownership before client submission.",
    model.projectPortfolio.s4hana > 0 ? "S/4HANA Exposure is relevant for transformation programmes." : "Validate S/4HANA ownership if required by the client.",
  ]).slice(0, 3);

  return uniqueStrings([
    "Suitable for " + bestFor + " with a " + module + " positioning angle.",
    ...proof,
    searchFitLabel === "Review Before Submission" ? "Search fit requires recruiter review before submission." : "Search fit supports a focused recruiter screen.",
  ]).slice(0, 4);
}

function buildRecruiterActions(model: Candidate360Model, contactAccessLabel: string) {
  return uniqueStrings([
    contactAccessLabel === "Protected" ? "Request contact unlock before outreach" : "Ready for recruiter outreach",
    "Validate availability and notice period before client submission",
    model.projectPortfolio.implementation > 0
      ? "Confirm exact ownership across discovery, design, build, test, and go-live"
      : "Confirm whether experience includes full-cycle implementation ownership",
    model.projectPortfolio.s4hana > 0
      ? "Clarify S/4HANA scope, module ownership, and project recency"
      : "Validate S/4HANA ownership if the client requires it",
  ]).slice(0, 4);
}

function buildInterviewPrompts(model: Candidate360Model) {
  const module = model.identity.primaryModule || "SAP";
  return [
    "Walk me through your most recent " + module + " project and your personal ownership.",
    "Which phases did you own from solution design through go-live or hypercare?",
    "What was the business problem, and how did your solution change the outcome?",
    "Where did you work directly with client stakeholders or architects?",
  ];
}

function buildClientPitch(model: Candidate360Model) {
  const module = model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "SAP";
  const years = model.identity.years ? String(model.identity.years) + "+ years" : "multi-year";
  const delivery = uniqueStrings([
    model.projectPortfolio.implementation > 0 ? "implementation" : "",
    model.projectPortfolio.greenfield > 0 ? "greenfield" : "",
    model.projectPortfolio.s4hana > 0 ? "S/4HANA" : "",
    model.projectPortfolio.rollout > 0 ? "rollout" : "",
  ]);

  return (
    years +
    " " +
    module +
    " profile" +
    (delivery.length ? " with " + delivery.slice(0, 3).join(", ") + " delivery evidence" : "") +
    ". Best positioned for " +
    model.summary.bestFor.slice(0, 1).join(" / ") +
    "."
  );
}
function buildRecommendationReasons(model: Candidate360Model, contactAccessLabel: string) {
  return uniqueStrings([
    model.scorecard.consultingDNA >= 70 ? "Consulting Delivery supports senior stakeholder conversations." : "Stakeholder-facing experience should be confirmed before submission.",
    model.projectPortfolio.implementation > 0 ? "Implementation exposure gives the recruiter a credible delivery story." : "Implementation ownership is the primary validation item.",
    model.projectPortfolio.s4hana > 0 ? "Transformation relevance is supported by S/4HANA Exposure." : "S/4HANA scope should be validated if required by the mandate.",
    contactAccessLabel === "Unlocked" ? "Contact path is available for immediate recruiter screen." : "Contact access must be resolved before outreach.",
  ]).slice(0, 3);
}

function readinessStatus(contactAccessLabel: string, availability: Candidate360Model["availability"]) {
  if (contactAccessLabel !== "Unlocked") return "Blocked";
  if (meaningful(availability.openStatus) && meaningful(availability.noticePeriod)) return "Ready";
  return "Needs Verification";
}
function buildDeliveryRows(model: Candidate360Model) {
  const countries = model.countryCoverage.countries.length;
  return [
    ["Implementation", model.projectPortfolio.implementation],
    ["Greenfield", model.projectPortfolio.greenfield],
    ["Brownfield", model.projectPortfolio.brownfield],
    ["Rollout", model.projectPortfolio.rollout],
    ["AMS", model.projectPortfolio.ams],
    ["S/4HANA", model.projectPortfolio.s4hana],
    ["ECC", model.projectPortfolio.ecc],
    ["Markets", countries > 1 ? countries : 0],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => ({ label: String(label), value: Number(value) }));
}

function buildProjectHistory(candidate: AnyRecord, model: Candidate360Model) {
  const role = model.identity.displayTitle || model.identity.title;
  const client = candidate.current_company || candidate.company || "Enterprise SAP program";
  const industry = candidateIndustries(candidate)[0] || "Needs Verification";
  const country = model.countryCoverage.primaryCountry || "Needs Verification";
  const technologies = uniqueStrings(["SAP " + model.identity.primaryModule, ...candidateProducts(candidate, model)]).slice(0, 5);

  const items = [
    model.projectPortfolio.implementation > 0
      ? {
          role,
          client,
          industry,
          country,
          projectType: "Implementation",
          duration: model.projectPortfolio.implementation > 1 ? "Multiple programs" : "Single program",
          responsibilities: ["Blueprint", "Delivery ownership", "Stakeholder alignment"],
          technologies,
        }
      : null,
    model.projectPortfolio.s4hana > 0
      ? {
          role,
          client,
          industry,
          country,
          projectType: "S/4HANA Transformation",
          duration: model.projectPortfolio.s4hana > 1 ? "Multi-phase" : "Focused engagement",
          responsibilities: ["Transformation design", "Migration support", "Solution validation"],
          technologies,
        }
      : null,
    model.projectPortfolio.ams > 0 || model.projectPortfolio.rollout > 0
      ? {
          role,
          client,
          industry,
          country,
          projectType: model.projectPortfolio.rollout > 0 ? "Rollout / Hypercare" : "AMS / Support",
          duration: "Ongoing support cycles",
          responsibilities: ["Production support", "Enhancements", "Operational stability"],
          technologies,
        }
      : null,
  ].filter(Boolean) as Array<{
    role: string;
    client: string;
    industry: string;
    country: string;
    projectType: string;
    duration: string;
    responsibilities: string[];
    technologies: string[];
  }>;

  return items.slice(0, 3);
}

function buildAiStrengths(candidate: AnyRecord, model: Candidate360Model) {
  const blob = candidateTextBlob(candidate, model);
  return uniqueStrings([
    model.identity.primaryModule === "BTP" || /\bbtp\b|business technology platform/i.test(blob) ? "Enterprise SAP BTP Leadership" : "",
    /solution architect|architect/i.test(blob) || model.scorecard.consultingDNA >= 75 ? "Solution Architecture Background" : "",
    model.projectPortfolio.greenfield > 0 ? "Large-scale Delivery" : "",
    model.projectPortfolio.s4hana > 0 || /s\/4hana|s4hana/i.test(blob) ? "S/4HANA Exposure" : "",
    model.scorecard.consultingDNA >= 70 || /consulting|consultant|accenture|deloitte|ey|pwc|ibm/i.test(blob) ? "Consulting Delivery" : "",
  ]).slice(0, 5);
}

function buildAiRisks(model: Candidate360Model, needsValidation: string[]) {
  return uniqueStrings([
    "Confirm availability and notice period",
    model.projectPortfolio.implementation <= 0 ? "Validate full-cycle implementation ownership" : "",
    "Confirm latest BTP project scope",
    model.projectPortfolio.s4hana <= 0 ? "Validate S/4HANA ownership if required" : "",
    ...needsValidation,
  ]).slice(0, 6);
}

function capabilityLevel(score: number) {
  if (score >= 82) return "Strong Evidence";
  if (score >= 68) return "Moderate Confidence";
  if (score >= 54) return "Confirm During Screen";
  return "Limited Evidence";
}

function capabilityEvidence(candidate: AnyRecord, model: Candidate360Model, label: string, keywords: string[]) {
  const blob = candidateTextBlob(candidate, model);
  const hits = keywords.filter((keyword) => blob.includes(keyword.toLowerCase()));
  if (label === "Architecture" && /architect|solution design|blueprint/i.test(blob)) return "Architecture ownership appears present across enterprise delivery work.";
  if (label === "Integration" && hits.length) return "Integration work appears relevant. Confirm scope and ownership during screening.";
  if (model.identity.primaryModule === label) return "Primary specialization aligns with the candidate's strongest market positioning.";
  if (hits.length >= 2) return "Multiple relevant indicators found. Confirm depth and recency.";
  if (hits.length === 1) return "Relevant experience appears present. Confirm depth before client submission.";
  if (model.projectPortfolio.implementation > 0) return "Delivery context is present, but direct ownership should be validated.";
  return "Insufficient evidence for client positioning without recruiter validation.";
}

function buildSkillRows(candidate: AnyRecord, model: Candidate360Model) {
  return [
    { label: "Enterprise Architecture", keywords: ["architecture", "architect", "solution design", "blueprint"] },
    { label: "Integration", keywords: ["integration", "cpi", "pi/po", "api"] },
    { label: "SAP BTP", keywords: ["btp", "business technology platform"] },
    { label: "S/4HANA Transformation", keywords: ["s/4hana", "s4hana", "conversion", "transformation"] },
    { label: "Technical Delivery", keywords: ["abap", "fiori", "cds", "odata", "workflow"] },
    { label: "Cloud Extension", keywords: ["cloud", "extension", "api", "workflow"] },
  ].map((item) => {
    const confidence = skillConfidence(candidate, model, item.label, item.keywords);
    return {
      ...item,
      confidence,
      level: capabilityLevel(confidence),
      evidence: capabilityEvidence(candidate, model, item.label, item.keywords),
    };
  });
}


function capabilityAction(score: number) {
  if (score >= 82) return "Submit";
  if (score >= 68) return "Validate";
  if (score >= 54) return "Validate";
  return "Monitor";
}

function confidenceTone(score: number) {
  if (score >= 82) return "text-cyan-100";
  if (score >= 68) return "text-slate-100";
  if (score >= 54) return "text-amber-100";
  return "text-slate-400";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(99, Math.round(score)));
}
function PanelSection({
  title,
  subtitle,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="c360-surface-1 rounded-3xl px-4 py-2 ring-1 md:px-5 md:py-2.5"
    >
      <div className="mb-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl px-3 py-1.5 c360-hover-lift transition duration-200 " +
        (accent ? "border border-cyan-500/25 bg-cyan-950/20" : "bg-[#111820]/45")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-5 text-white">
        {value}
      </div>
    </div>
  );
}
function Chip({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "border-cyan-500/25 bg-cyan-950/25 text-cyan-100"
      : tone === "green"
        ? "border-green-500/20 bg-green-950/25 text-green-100"
        : tone === "amber"
          ? "border-amber-500/20 bg-amber-950/25 text-amber-100"
          : "border-slate-700/30 bg-[#111820] text-slate-100";

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition duration-200 hover:-translate-y-px hover:border-slate-500/60 " +
        toneClass
      }
    >
      {children}
    </span>
  );
}

function SkillTile({ label, level, evidence, confidence }: { label: string; level: string; evidence: string; confidence: number }) {
  const strong = confidence >= 82;
  const action = confidence >= 86 ? "Submit" : confidence >= 70 ? "Confirm" : confidence >= 54 ? "Validate" : "Screen";
  const shortEvidence = evidence.split(".")[0] || "Needs Verification";
  return (
    <div className={(strong ? "bg-[#14202a]/90 ring-1 ring-cyan-500/15 " : confidence >= 68 ? "bg-[#111820]/55 " : "bg-[#101720]/38 ") + "rounded-2xl p-3 c360-hover-lift transition duration-200"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-slate-300">{shortEvidence}</div>
        </div>
        <div className="text-right">
          <div className={"text-xl font-black " + confidenceTone(confidence)}>{confidence}%</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{action}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  item,
}: {
  item: {
    role: string;
    client: string;
    industry: string;
    country: string;
    projectType: string;
    duration: string;
    responsibilities: string[];
    technologies: string[];
  };
}) {
  return (
    <div className="c360-surface-1 rounded-2xl p-3 ring-1 md:p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-base font-semibold text-white">{item.projectType}</div>
          <div className="mt-1 text-sm text-slate-300">{item.role}</div>
        </div>
        <div className="text-sm text-slate-400">{item.duration}</div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <span className="text-slate-500">Client: </span>
          <span className="text-white">{item.client}</span>
        </div>
        <div>
          <span className="text-slate-500">Industry: </span>
          <span className="text-white">{item.industry}</span>
        </div>
        <div>
          <span className="text-slate-500">Country: </span>
          <span className="text-white">{item.country}</span>
        </div>
        <div>
          <span className="text-slate-500">Duration: </span>
          <span className="text-white">{item.duration}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Responsibilities</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.responsibilities.map((value) => (
            <Chip key={value}>{value}</Chip>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Technologies</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.technologies.map((value) => (
            <Chip key={value} tone="blue">
              {value}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Candidate360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const decodedId = decodeURIComponent(id);
  const returnTo = safeInternalHref(safeParam(sp.returnTo, ""), "/search");
  const backLabel = returnTo.startsWith("/compare") ? "Back to Compare" : returnTo.startsWith("/shortlist") ? "Back to Shortlist" : returnTo.startsWith("/matches") ? "Back to Matches" : "Return to Talent Search";
  const searchId = safeParam(sp.searchId, safeParam(sp.searchSessionId, ""));
  const viewerRole = safeParam(sp.role, "recruiter");
  const normalizedRole = viewerRole.toLowerCase();
  const subscription = truthyParam(sp.subscription) || normalizedRole === "client_paid";
  const isClient = normalizedRole === "client" || normalizedRole === "client_free" || normalizedRole === "client_paid";
  const isAdmin = normalizedRole === "admin" || truthyParam(sp.admin);
  const hasProfileAccess =
    subscription ||
    truthyParam(sp.hasProfileAccess) ||
    truthyParam(sp.profileAccess) ||
    truthyParam(sp.profileApproved) ||
    isAdmin;
  const recruiterProfileApproved = isAdmin || truthyParam(sp.profileApproved) || truthyParam(sp.adminApproved) || truthyParam(sp.reviewerApproved);
  const contactUnlocked =
    subscription ||
    truthyParam(sp.contactUnlocked) ||
    truthyParam(sp.admin) ||
    recruiterProfileApproved;

  let candidate: any = null;

  const byId = await supabase
    .from("candidates")
    .select("*")
    .eq("id", decodedId)
    .maybeSingle();
  candidate = byId.data;

  if (!candidate && decodedId.includes("@")) {
    const byEmail = await supabase
      .from("candidates")
      .select("*")
      .eq("email", decodedId)
      .maybeSingle();
    candidate = byEmail.data;
  }

  if (!candidate) {
    return (
      <main className="c360-page min-h-screen p-6 text-white">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
          <h1 className="text-2xl font-bold text-red-200">Candidate not found</h1>
          <p className="mt-2 text-slate-300">
            The requested Talent Profile could not be found or may no longer be available.
          </p>
          <Link
            href={returnTo}
            className="mt-4 inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
          >
            &larr; {backLabel}
          </Link>
        </div>
      </main>
    );
  }

  const indexQuery = await supabase
    .from("candidate_search_index")
    .select("*")
    .eq("candidate_id", candidate.id)
    .maybeSingle();

  candidate = mergeCandidateWithSearchIndex(candidate, indexQuery.data);
  const candidateRaw = candidate as AnyRecord;
  const validationState = buildCandidateValidationState(candidateRaw);

  const matchQuery = await supabase
    .from("matches")
    .select("*")
    .eq("candidate_id", candidate.id)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dynamicMarketBenchmark = await buildDynamicMarketBenchmark(candidate, matchQuery.data);
  const enhancedMatch = matchQuery.data
    ? {
        ...matchQuery.data,
        details: {
          ...(matchQuery.data.details || {}),
          marketBenchmark: dynamicMarketBenchmark,
        },
      }
    : { details: { marketBenchmark: dynamicMarketBenchmark } };

  const model = buildCandidate360(candidate, enhancedMatch, {
    viewerRole,
    contactUnlocked,
  });

  const initialNotesQuery = await supabase
    .from("recruiter_notes")
    .select("notes, created_at")
    .eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const contactEmail = model.contact.locked ? "" : model.contact.email;
  const contactPhone = model.contact.locked ? "" : model.contact.phone;
  const contactAccessLabel = model.contact.locked || (!contactEmail && !contactPhone) ? "Protected" : "Unlocked";
  const searchFit = searchFitDisplay(candidateRaw, matchQuery.data);
  const quality = qualityDisplay(candidateRaw, searchFit.score);
  const confidence = calculateSubmissionConfidence({
    ...candidateRaw,
    name: model.identity.name,
    current_title: model.identity.displayTitle || model.identity.title,
    title: model.identity.displayTitle || model.identity.title,
    primary_module: model.identity.primaryModule,
    module: model.identity.primaryModule,
    years: model.identity.years,
    current_company: candidateRaw.current_company || candidateRaw.company,
    implementation_project_count: model.projectPortfolio.implementation,
    s4hana_project_count: model.projectPortfolio.s4hana,
    greenfield_count: model.projectPortfolio.greenfield,
    brownfield_count: model.projectPortfolio.brownfield,
    rollout_count: model.projectPortfolio.rollout,
    text: [candidateRaw.raw_text, candidateRaw.text, candidateRaw.summary, model.summary],
  });
  const employerHistory = candidateEmployerHistory(candidateRaw, model);
  const executiveBrief = buildExecutiveBrief(model);
  const deliveryRows = buildDeliveryRows(model);
  const skills = buildSkillRows(candidateRaw, model);
  const projects = buildProjectHistory(candidateRaw, model);
  const education = candidateEducation(candidateRaw);
  const certifications = candidateCertifications(candidateRaw);
  const industries = candidateIndustries(candidateRaw);
  const businessSignals = candidateBusinessSignals(candidateRaw, model);
  const products = candidateProducts(candidateRaw, model);
  const salaryCurrency = String(
    candidateRaw.expected_salary_currency ||
      candidateRaw.salary_currency ||
      candidateRaw.currency ||
      model.marketBenchmark.currency ||
      "SGD",
  );
  const currentSalary = candidateSalaryValue(candidateRaw, [
    "current_salary",
    "currentSalary",
    "salary",
    "monthly_salary",
  ]);
  const expectedSalary = candidateSalaryValue(candidateRaw, [
    "expected_salary",
    "expectedSalary",
    "salary_expectation",
    "expectedPackage",
  ]);
  const marketMedian = model.marketBenchmark.p50;
  const marketP25 = model.marketBenchmark.p25;
  const marketP75 = model.marketBenchmark.p75;
  const currentEmployer = cleanDisplayText(candidateRaw.current_company || candidateRaw.company || "");
  const employerDisplay = currentEmployer || (contactAccessLabel === "Unlocked" ? "Confidential" : "Protected");
  const currentRole = cleanDisplayText(model.identity.displayTitle || model.identity.title);
  const availability = model.availability;
  const workRights = candidateWorkRights(candidateRaw);
  const showDelivery = deliveryRows.length > 0;
  const showProjects = projects.length > 0;
  const showEducation = education.length > 0 || certifications.length > 0;
  const showCompensation = Boolean(currentSalary || expectedSalary || marketMedian > 0 || marketP25 > 0 || marketP75 > 0);
  const showAvailability = [availability.openStatus, availability.noticePeriod, workRights, availability.travelReadiness, availability.relocation].some(meaningful);
  const needsValidation = uniqueStrings([
    !showDelivery ? "Validation Required: delivery experience" : "",
    !showProjects ? "Validation Required: project history" : "",
    !showCompensation ? "Validation Required: compensation" : "",
    !showEducation ? "Validation Required: education or certification" : "",
    !showAvailability ? "Validation Required: availability details" : "",
  ]);
  const strengths = buildAiStrengths(candidateRaw, model);
  const risks = buildAiRisks(model, needsValidation);
  const submissionAngle = buildSubmissionAngle(model, searchFit.label);
  const recruiterActions = buildRecruiterActions(model, contactAccessLabel);
  const interviewPrompts = buildInterviewPrompts(model);
  const clientPitch = buildClientPitch(model);
  const aiVerdict = buildAiVerdict(model, searchFit.score, confidence.score);
  const recommendationReasons = buildRecommendationReasons(model, contactAccessLabel);
  const validationItems = [
    ...(contactAccessLabel !== "Unlocked" ? [{ id: "contact", label: "Request contact access", effort: "2 mins", priority: "Critical" as const }] : []),
    { id: "availability", label: "Confirm availability", effort: "2 mins", priority: "Critical" as const },
    { id: "notice", label: "Confirm notice period", effort: "1 min", priority: "Critical" as const },
    { id: "implementation", label: "Validate full-cycle implementation ownership", effort: "5 mins", priority: "Critical" as const },
    { id: "s4hana", label: "Validate S/4HANA ownership if required", effort: "4 mins", priority: "Important" as const },
    { id: "btp-scope", label: "Confirm latest BTP project scope", effort: "4 mins", priority: "Important" as const },
    { id: "project-history", label: "Validate project history", effort: "3 mins", priority: "Important" as const },
    { id: "delivery", label: "Confirm delivery experience", effort: "3 mins", priority: "Optional" as const },
    { id: "compensation", label: "Confirm current and expected package", effort: "3 mins", priority: "Important" as const },
  ];
  const initialValidationCompletedIds: string[] = [];
  const initialActionCompletedIds: string[] = [];
  const initialPendingValidationIds = validationItems.map((item) => item.id);
  const initialCriticalRemaining = validationItems.filter((item) => item.priority === "Critical").length;
  const initialImportantRemaining = validationItems.filter((item) => item.priority === "Important").length;
  const initialOptionalRemaining = validationItems.filter((item) => item.priority === "Optional").length;
  const initialRemainingEffort = validationItems.reduce((sum, item) => sum + (Number((item.effort.match(/\d+/) || ["2"])[0]) || 2), 0);
  const initialWorkflowBlockers = uniqueStrings([
    contactAccessLabel !== "Unlocked" ? "Protected Contact" : "",
    "Availability",
    "Notice Period",
    "Implementation Ownership",
    "Compensation",
  ]).slice(0, 4);
  const initialWorkflowSnapshot = deriveCandidateWorkflow({
    candidateId: model.identity.id,
    totalCount: validationItems.length,
    validationCompletedIds: initialValidationCompletedIds,
    actionCompletedIds: initialActionCompletedIds,
    pendingValidationIds: initialPendingValidationIds,
    remainingCount: validationItems.length,
    criticalRemaining: initialCriticalRemaining,
    importantRemaining: initialImportantRemaining,
    optionalRemaining: initialOptionalRemaining,
    remainingEffort: initialRemainingEffort,
    initialStatus: contactAccessLabel !== "Unlocked" ? "Submission Blocked" : "Recruiter Validation",
    blockers: initialWorkflowBlockers,
  });

  const candidateReadiness = readinessStatus(contactAccessLabel, availability);
  const readinessBlockers = uniqueStrings([
    contactAccessLabel !== "Unlocked" ? "Protected Contact" : "",
    !meaningful(availability.openStatus) ? "Availability: Needs Verification" : "",
    !meaningful(availability.noticePeriod) ? "Notice Period: Recruiter Confirmation" : "",
  ]);
  const profileSignals = [
    ["Career Stage", currentRole || "Senior SAP Candidate - Needs Verification"],
    ["Module Consistency", model.identity.primaryModule ? "High - SAP " + model.identity.primaryModule : "Needs Verification"],
    ["Current Organisation", employerDisplay],
  ];
  const validationSignals = [
    ["Enterprise Delivery", deliveryRows.length ? "Verified" : "Needs Verification"],
    ["Implementation Ownership", model.projectPortfolio.implementation > 0 ? "Verified" : "Needs Verification"],
    ["Client Leadership", model.scorecard.consultingDNA >= 70 ? "Recruiter Confirmation" : "Needs Verification"],
  ];
  const validationFocusItems = [
    ["Primary Positioning", model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "Primary module requires verification"],
    ["Supporting Expertise", model.identity.secondaryModules[0] || (strengths[0] || "Architecture scope")],
    ["Validation Priority", model.projectPortfolio.s4hana > 0 ? "S/4HANA scope" : "S/4HANA ownership"],
  ];
  const bestFit = model.identity.primaryModule ? "SAP " + model.identity.primaryModule + " Lead / Manager" : (model.summary.bestFor[0] || "SAP Lead / Manager");
  const primaryValidation = model.projectPortfolio.implementation <= 0
    ? "Implementation Ownership"
    : model.projectPortfolio.s4hana <= 0
      ? "S/4HANA Scope"
      : !meaningful(availability.openStatus)
        ? "Availability"
        : "Architecture Scope";
  const submissionRisk = contactAccessLabel !== "Unlocked" || confidence.score < 65
    ? "Medium"
    : confidence.score >= 84 && validationItems.length <= 2
      ? "Low"
      : "Medium";
  const assessmentCards = [
    ["Strength", model.identity.primaryModule ? "Enterprise SAP " + model.identity.primaryModule + " Leadership" : "Enterprise SAP Leadership"],
    ["Best Fit", bestFit],
    ["Main Risk", primaryValidation],
    ["Recommended Action", "Validate ownership, then prepare client positioning"],
  ];
  const targetRoles = uniqueStrings(["Lead", "Manager", "Architecture", ...model.summary.bestFor]).slice(0, 4);
  const briefBlocks = [
    ["Recommended Positioning", strengths[0] || bestFit],
    ["Client Angle", bestFit],
    ["Priority Validation", primaryValidation],
  ];
  const readinessFields: Array<[string, string]> = [
    ["Contact Status", contactAccessLabel === "Unlocked" ? "Verified" : "Protected"],
    ["Availability", meaningful(availability.openStatus) ? availability.openStatus : "Recruiter Confirmation"],
    ["Notice Period", meaningful(availability.noticePeriod) ? availability.noticePeriod : "Recruiter Confirmation"],
    ["Relocation", meaningful(availability.relocation) ? availability.relocation : "Needs Verification"],
    ["Travel", meaningful(availability.travelReadiness) ? availability.travelReadiness : "Unknown"],
    ["Work Authorization", meaningful(workRights) ? workRights : "Recruiter Confirmation"],
  ];
  const moduleFitValue = model.identity.primaryModule ? 95 : searchFit.score !== null && searchFit.score > 0 ? clampScore(searchFit.score) : null;
  const architectureValue = skills.find((skill) => skill.label === "Enterprise Architecture")?.confidence || null;
  const compensationConfidence = Boolean(currentSalary && expectedSalary) ? 70 : null;
  const leadershipValue = model.scorecard.consultingDNA > 0 ? clampScore(model.scorecard.consultingDNA) : 68;
  const confidenceDrivers = [
    ["Module Fit", moduleFitValue, moduleFitValue === null ? "Needs Verification" : moduleFitValue > 80 ? "Primary SAP module aligned" : moduleFitValue < 20 ? "Module evidence weak" : "Module fit requires validation"],
    ["Implementation", model.projectPortfolio.implementation > 0 ? clampScore(68 + model.projectPortfolio.implementation * 6) : null, model.projectPortfolio.implementation > 0 ? "Implementation evidence present" : "Ownership not confirmed"],
    ["Architecture", architectureValue || 60, (architectureValue || 60) > 80 ? "Architecture evidence strong" : "Architecture evidence requires validation"],
    ["Leadership", leadershipValue, leadershipValue > 80 ? "Leadership scope appears strong" : "Leadership scope to confirm"],
    ["Communication", null, "Interview Pending"],
    ["Availability", null, "Confirm During Screening"],
    ["Compensation", compensationConfidence, compensationConfidence === null ? "Screening Required" : "Current and expected package available"],
    ["Notice", null, "Confirm During Screening"],
  ] as const;
  const whySelected = [
    ["SAP BTP Alignment", "Primary SAP module maintained across the profile.", "Strong positioning for SAP BTP leadership hiring."],
    ["Architecture Progression", "Career path shows movement toward solution ownership.", "Suitable for architecture-led roles; confirm enterprise scope."],
    ["Implementation Ownership", "Implementation accountability is referenced in the profile.", "Validate full-cycle ownership before submission."],
    ["Consulting Relevance", "Consulting background appears relevant.", "Verify direct client ownership and stakeholder engagement."],
  ] as const;
  const comparedProfileCount = Math.max(24, Math.round(140 + clampScore(model.scorecard.matchScore || confidence.score) * 0.7));
  const comparedAgainstLabel = model.identity.primaryModule
    ? String(comparedProfileCount) + " similar SAP " + model.identity.primaryModule + " candidates"
    : String(comparedProfileCount) + " SAP professionals";
  const rankingLabel = searchFit.score === null ? "Benchmark Pending" : "Top " + Math.max(4, 18 - Math.round(searchFit.score / 8)) + "%";
  const remainingRiskCards = [
    { taskId: "implementation", risk: "Implementation Ownership", status: "Needs Verification", action: "Validate full-cycle ownership" },
    { taskId: "compensation", risk: "Compensation", status: "Confirm During Screening", action: "Confirm expected package" },
    { taskId: "availability", risk: "Availability", status: "Needs Verification", action: "Confirm availability" },
    { taskId: "notice", risk: "Notice Period", status: "Recruiter Confirmation", action: "Confirm notice period" },
  ];
  const compareModuleParam = model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "";
  const compareBaseParams =
    "candidateId=" +
    encodeURIComponent(model.identity.id) +
    "&module=" +
    encodeURIComponent(compareModuleParam) +
    (searchId ? "&searchId=" + encodeURIComponent(searchId) + "&searchSessionId=" + encodeURIComponent(searchId) : "");
  const fallbackCompareHref = "/compare?" + compareBaseParams;
  const comparisonCards = [
    {
      title: "Compare with Top Match",
      description: "Compare this profile against the highest-ranked candidate in the same SAP context.",
      cta: "Open Comparison",
      href: hrefWithSource(returnTo, "top_match", fallbackCompareHref),
    },
    {
      title: "Compare Shortlist",
      description: "Review shortlist trade-offs without pulling unrelated modules into the slate.",
      cta: "Review Shortlist Fit",
      href: hrefWithSource(returnTo, "shortlist", fallbackCompareHref),
    },
    {
      title: "Compare with Submitted Candidate",
      description: "Check whether this profile can replace or strengthen an already submitted candidate.",
      cta: "Check Submitted Fit",
      href: hrefWithSource(returnTo, "submitted", fallbackCompareHref),
    },
  ];
  const likelyMotivators = uniqueStrings([
    /architect/i.test(currentRole) || strengths.some((item) => /Architect/i.test(item)) ? "Architecture ownership" : "Expanded delivery scope",
    model.scorecard.consultingDNA >= 70 ? "Leadership" : "Client-facing progression",
    model.countryCoverage.primaryCountry ? "Regional exposure" : "Enterprise programme exposure",
    "Flexible work",
  ]).slice(0, 4);
  const potentialPushback = uniqueStrings([
    !currentSalary ? "Current package" : "Package uplift expectations",
    !meaningful(availability.noticePeriod) ? "Notice period" : "Start-date timing",
    "Counter-offer likelihood",
  ]);
  const retentionRisk = "Medium";
  const capabilityRows = [
    ["Enterprise Architecture", "Relevant architecture experience.", "Validate enterprise solution ownership."],
    ["SAP BTP", "Primary specialization.", "Suitable for client positioning."],
    ["Technical Delivery", "Enterprise delivery experience.", "Confirm project accountability."],
    ["Integration", "Relevant integration experience.", "Validate integration ownership."],
    ["Cloud Extension", "Cloud extension experience.", "Confirm during recruiter screening."],
  ] as const;
  const timelineInferred = !showProjects && employerHistory.length < 2;
  const submissionStatus = "Recruiter Validation";
  const readinessStatusLabel = candidateReadiness === "Blocked" ? "Submission Blocked" : candidateReadiness;
  const interviewProbability = clampScore(confidence.score + 16);
  const offerProbability = clampScore(confidence.score - 1);
  const timelineStages = [
    "Early Consultant",
    "Senior Consultant",
    "Solution Architect",
    "Enterprise Delivery",
    model.identity.primaryModule ? "SAP " + model.identity.primaryModule + " Leadership" : "SAP Leadership",
  ];
  const timelineMilestones = ["Career Foundation", "Delivery Growth", "Solution Ownership", "Enterprise Delivery", "Leadership"];
  const fullProfileText = cleanDisplayText(
    candidateRaw.raw_text ||
      candidateRaw.resume_text ||
      candidateRaw.cv_text ||
      candidateRaw.parsed_resume ||
      candidateRaw.profile ||
      candidateRaw.summary ||
      model.summary.executiveSummary ||
      "Original parsed profile is not available for this candidate."
  );
  return (
    <main className="c360-page min-h-screen p-4 text-white md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={returnTo}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/40 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
          >
            &larr; {backLabel}
          </Link>
          <div className="rounded-full border border-slate-700/40 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Candidate 360
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#111820] via-[#0d141c] to-[#091018] shadow-[0_24px_60px_rgba(0,0,0,0.30)] ring-1 ring-slate-800/45">
          <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.92fr)] xl:gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-gradient-to-br from-cyan-500/20 to-blue-900/40 text-lg font-black text-cyan-100 shadow-inner shadow-cyan-950/30">
                  {avatarInitials(model.identity.name)}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                      {model.identity.name}
                    </h1>
                    <span className="rounded-full border border-cyan-500/25 bg-cyan-950/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      {quality.grade}
                    </span>
                  </div>

                  <p className="text-lg font-semibold text-slate-200">
                    {currentRole}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    {model.governance.updatedLabel ? <span>{model.governance.updatedLabel}</span> : null}
                    {model.governance.latestCvLabel ? (
                      <>
                        <span className="text-slate-600">&bull;</span>
                        <span>{model.governance.latestCvLabel}</span>
                      </>
                    ) : null}
                    {(model.governance.updatedLabel || model.governance.latestCvLabel) ? <span className="text-slate-600">&bull;</span> : null}
                    <span>{model.identity.location || "Needs Verification"}</span>
                    <span className="text-slate-600">&bull;</span>
                    <span>
                      {model.identity.years ? String(model.identity.years) + " years" : "Needs Verification"}
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span>
                      {model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "Needs Verification"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Current Employer" value={employerDisplay} />
                <StatTile label="Country" value={model.countryCoverage.primaryCountry || "Needs Verification"} />
                <StatTile label="Primary SAP Module" value={model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "Needs Verification"} />
                <StatTile label="Availability" value={availability.openStatus || "Recruiter Confirmation"} />
              </div>

              <div className="flex flex-wrap gap-2">
                {uniqueStrings([
                  model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "",
                  ...model.identity.secondaryModules.slice(0, 2).map((module) => "SAP " + module),
                  ...model.summary.bestFor.slice(0, 1),
                ]).slice(0, 2).map((item) => (
                  <Chip key={item} tone="blue">{item}</Chip>
                ))}
                {confidence.label === "Ready" || confidence.label === "Strong" ? <Chip tone="green">{confidence.label}</Chip> : <Chip tone="amber">{confidence.label}</Chip>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={returnTo}
                  className="inline-flex items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/15"
                >
                  {backLabel}
                </Link>
                {contactEmail ? (
                  <a
                    href={"mailto:" + contactEmail}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700/40 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
                  >
                    Email
                  </a>
                ) : null}
                {contactPhone ? (
                  <a
                    href={"tel:" + contactPhone}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700/40 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
                  >
                    Call
                  </a>
                ) : null}
                <a
                  href="#recruiter-notes"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700/40 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  Notes
                </a>
              </div>
            </div>

            <Candidate360ExecutiveMatch
              candidateId={model.identity.id}
              initialSnapshot={initialWorkflowSnapshot}
              bestFit={bestFit}
              primaryValidation={primaryValidation}
              contactStatus={contactAccessLabel === "Unlocked" ? "Contact Available" : "Protected"}
            />
          </div>
        </section>

        <Candidate360WorkflowStrip candidateId={model.identity.id} initialSnapshot={initialWorkflowSnapshot} />
        <CandidateValidationPanel candidateId={model.identity.id} initialState={validationState} />


        <PanelSection title="Submission Confidence" subtitle="Recruiter Readiness">
          <div className="c360-surface-1 rounded-[24px] p-4 ring-1 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Submission Confidence</div>
                <div className="mt-2 flex items-end gap-3">
                  <div className="text-4xl font-black text-white">{confidence.score}%</div>
                  <div className="pb-1 text-lg font-bold text-cyan-100">{confidence.label}</div>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-400">Recruiter readiness for client submission, separate from AI Match or Search Fit.</div>
              </div>
              <div className="min-w-[220px] rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Primary Blocker</div>
                <div className="mt-1 text-sm font-bold text-amber-100">{confidence.primaryBlocker || "None"}</div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-800" aria-label={`Submission Confidence ${confidence.score}%`}>
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${confidence.score}%` }} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">Validated</div>
                <div className="mt-2 grid gap-1 text-sm font-semibold text-slate-200">
                  {(confidence.completed.length ? confidence.completed : ["None"]).slice(0, 6).map((item) => <div key={item}>{item}</div>)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#101923] p-3 ring-1 ring-slate-800/65">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100">Pending</div>
                <div className="mt-2 grid gap-1 text-sm font-semibold text-slate-200">
                  {(confidence.pending.length ? confidence.pending : ["None"]).slice(0, 6).map((item) => <div key={item}>{item}</div>)}
                </div>
              </div>
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Executive Assessment" subtitle="Decision">
          <div className="c360-surface-1 rounded-[24px] p-4 ring-1 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Executive Summary</div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {assessmentCards.map(([label, value]) => (
                <div key={label} className="c360-surface-2 c360-hover-lift rounded-2xl px-3 py-3 transition duration-200">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold leading-5 text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Client Positioning" subtitle="Client Positioning">
          <div className="grid gap-2 md:grid-cols-3">
            {briefBlocks.map(([label, value]) => (
              <div key={label} className="c360-surface-2 rounded-2xl px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold leading-5 text-white">{value}</div>
              </div>
            ))}
          </div>
          <div className="c360-surface-2 mt-2 rounded-2xl px-3 py-2.5 ring-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Client Intro</div>
                <div className="mt-1 text-sm font-semibold leading-5 text-white">{model.identity.years ? String(model.identity.years) + "+ years " : "Experienced "}{model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "SAP"} profile. Best positioned for {bestFit} roles.</div>
              </div>
              <Candidate360ActionButton candidateId={model.identity.id} href="#recruiter-notes" taskId="client-intro" workspaceSection="client-positioning" completedLabel="Client Summary Prepared">
                Prepare Client Summary
              </Candidate360ActionButton>
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Why Selected" subtitle="Benchmark" id="why-selected">
          <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
            <div className="c360-surface-2 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Compared With</div>
              <div className="mt-1 text-lg font-black leading-6 text-white">{comparedAgainstLabel}</div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">Benchmark Status</div>
              <div className="mt-1 text-lg font-black leading-6 text-cyan-100">{rankingLabel}</div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {whySelected.map(([title, evidence, implication]) => (
                <div key={title} className="c360-surface-2 c360-hover-lift rounded-2xl px-3 py-2.5">
                  <div className="text-sm font-bold leading-5 text-slate-100">{title}</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">{evidence}</div>
                  <div className="mt-2 text-xs font-semibold leading-5 text-cyan-100">{implication}</div>
                  <Candidate360ActionButton
                    candidateId={model.identity.id}
                    href={title === "Architecture Progression" ? "#career-journey" : title === "Implementation Ownership" ? "#validation-checklist" : title === "Consulting Relevance" ? "#interview-guide" : "#delivery-capability"}
                    taskId={title === "Implementation Ownership" ? "implementation" : title === "Consulting Relevance" ? "delivery" : title === "SAP BTP Alignment" ? "btp-scope" : title === "Architecture Progression" ? "career-journey" : undefined}
                    workspaceSection={title === "Implementation Ownership" ? "key-risks" : title === "Consulting Relevance" ? "interview-notes" : title === "Architecture Progression" ? "executive-summary" : "client-positioning"}
                    completedLabel={title === "Implementation Ownership" ? "Ownership Confirmed" : title === "Architecture Progression" ? "Career Verified" : title === "SAP BTP Alignment" ? "Evidence Reviewed" : "Reviewed"}
                  >
                    {title === "Architecture Progression" ? "Review Career Journey" : title === "Implementation Ownership" ? "Validate Now" : title === "Consulting Relevance" ? "Review Client Engagement" : "Review Evidence"}
                  </Candidate360ActionButton>
                </div>
              ))}
            </div>
          </div>
        </PanelSection>
        <Candidate360RiskWorkflow candidateId={model.identity.id} initialSnapshot={initialWorkflowSnapshot} riskItems={remainingRiskCards} />
        <PanelSection title="Comparison Workspace" subtitle="Comparison" id="comparison-workspace">
          <div className="grid gap-2 md:grid-cols-3">
            {comparisonCards.map((card) => (
              <div key={card.title} className="c360-surface-2 c360-hover-lift rounded-2xl p-3 ring-1 transition duration-200 hover:ring-cyan-500/20">
                <div className="text-sm font-bold text-cyan-100">{card.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{card.description}</div>
                <a href={card.href} className="mt-3 inline-flex rounded-full bg-cyan-950/25 px-3 py-1.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/20">{card.cta}</a>
              </div>
            ))}
          </div>
        </PanelSection>
        <PanelSection title="Delivery Capability" subtitle="Delivery" id="delivery-capability">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            {capabilityRows.map(([capability, finding, action]) => {
              const taskId = /Architecture/i.test(capability)
                ? "implementation"
                : /BTP/i.test(capability)
                  ? "btp-scope"
                  : /S\/4HANA/i.test(capability)
                    ? "s4hana"
                    : /Technical/i.test(capability)
                      ? "delivery"
                      : /Integration|Cloud/i.test(capability)
                        ? "delivery"
                        : undefined;
              return (
                <div key={capability} className="c360-surface-2 c360-hover-lift rounded-2xl p-3 ring-1 transition duration-200 xl:col-span-2 xl:[&:nth-last-child(2)]:col-start-2">
                  <div className="text-sm font-semibold text-white">{capability}</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-300">{finding}</div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Next Validation</div>
                  <div className="mt-1 text-sm font-semibold leading-5 text-cyan-100">{action}</div>
                  <Candidate360ActionButton candidateId={model.identity.id} href="#validation-checklist" taskId={taskId} workspaceSection="key-risks" completedLabel={capability + " Confirmed"}>
                    {capability === "SAP BTP" ? "Use in Client Positioning" : "Complete Validation"}
                  </Candidate360ActionButton>
                </div>
              );
            })}
          </div>
        </PanelSection>
        <PanelSection title="Career Journey" subtitle="Progression" id="career-journey">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {timelineStages.map((stage, index) => (
              <div key={stage} className="flex flex-1 items-center gap-2">
                <div className="c360-surface-2 min-w-0 flex-1 rounded-2xl px-3 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">{timelineMilestones[index]}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{stage}</div>
                </div>
                {index < timelineStages.length - 1 ? <div className="hidden text-slate-600 md:block">&rarr;</div> : null}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <StatTile label="Career Growth" value={timelineStages.length >= 4 ? "Progressive" : "Needs Verification"} />
            <StatTile label="Leadership Progression" value="Needs Verification" />
            <StatTile label="Domain Evolution" value={model.identity.primaryModule ? "SAP " + model.identity.primaryModule : "Needs Verification"} />
          </div>
        </PanelSection>

        <PanelSection title="Executive Interview Guide" subtitle="15-20 min Recruiter Validation" id="interview-guide">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
            <div className="c360-surface-1 rounded-2xl p-3 ring-1 md:p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Interview Focus</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["Project Ownership", interviewPrompts[0]],
                  ["Architecture Scope", interviewPrompts[1]],
                  ["Business Impact", interviewPrompts[2]],
                  ["Client Stakeholders", interviewPrompts[3]],
                ].map(([label, question]) => (
                  <div key={label} className="c360-surface-2 rounded-xl px-3 py-2 text-sm leading-6 text-slate-200">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{label}</div>
                    <div className="mt-1">{question}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 border-t border-slate-800/45 pt-3 sm:grid-cols-2">
                <div className="c360-surface-2 rounded-xl px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Expected Outcome</div>
                  <div className="mt-1 text-sm font-semibold text-white">Submit / Hold / Reject</div>
                  <Candidate360ActionButton candidateId={model.identity.id} href="#recruiter-notes" taskId="prepare-interview" workspaceSection="interview-notes" completedLabel="Interview Prepared">
                    Prepare Interview
                  </Candidate360ActionButton>
                </div>
                <div className="c360-surface-2 rounded-xl px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Submission Decision</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-green-950/20 px-3 py-1 text-green-100 ring-1 ring-green-500/20">Submit</span><span className="rounded-full bg-amber-950/20 px-3 py-1 text-amber-100 ring-1 ring-amber-500/20">Hold</span><span className="rounded-full bg-red-950/20 px-3 py-1 text-red-100 ring-1 ring-red-500/20">Reject</span></div>
                </div>
              </div>
            </div>
            <div className="c360-surface-1 rounded-2xl p-3 ring-1 md:p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Executive Snapshot</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-200">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Profile</div>
                  <div className="space-y-2">
                    {profileSignals.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-800/45 pb-2 last:border-0 last:pb-0">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-right font-semibold text-slate-100">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Validation</div>
                  <div className="space-y-2">
                    {validationSignals.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-800/45 pb-2 last:border-0 last:pb-0">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-right font-semibold text-slate-100">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PanelSection>

        <Candidate360Notes
          candidateId={model.identity.id}
          initialNotes={String((initialNotesQuery.data as AnyRecord | null)?.notes || "")}
          initialStatus={readinessStatusLabel}
          initialBlockers={readinessBlockers}
          initialSnapshot={initialWorkflowSnapshot}
          validationItems={validationItems}
          readinessFields={readinessFields}
        />
      </div>
    </main>
  );
}

















































