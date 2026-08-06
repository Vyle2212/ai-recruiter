import type { Candidate360Profile } from "./candidate360Types";
import { buildCandidateJobDecision, type CandidateJobDecision, type DecisionSignal } from "./candidate360Decision";
import { createEvidenceProvenance, normalizeEvidenceItems, normalizeEvidenceLabels, recruiterLabel, type EvidenceItem } from "./candidate360Evidence";
import { calibrateConclusionConfidence } from "./candidate360Confidence";

export type ExplainabilityStatus = "strong" | "established" | "developing" | "limited_evidence" | "not_enough_evidence" | "risk";
export type HiringDecisionState = "Interview" | "Hold" | "Reject" | "Need Validation" | "Job Required";
export type CandidateReadinessDecision = { decision: "Proceed to Recruiter Screening" | "Need Validation" | "Hold"; confidence: number | null; opinion: string; evidence: EvidenceItem[]; validationItems: string[]; nextAction: string | null };
export type RoleFitDecision = { decision: HiringDecisionState; confidence: number | null; hiringRisk: "Low" | "Moderate" | "High" | "Not Assessed"; evidence: EvidenceItem[]; mismatches: string[]; missingEvidence: string[]; nextAction: string | null };
export type ExplainableDecision = { label: string; status: ExplainabilityStatus; score: number | null; confidence: number | null; conclusion: string; why: string[]; evidence: EvidenceItem[]; missingEvidence: string[]; nextAction: string | null };
export type CandidateHiringOpinion = {
  mode: "candidate_readiness" | "job_fit";
  candidateReadiness: CandidateReadinessDecision;
  roleFit: RoleFitDecision;
  confirmedRisks: string[];
  validationItems: string[];
  confirmedMismatches: string[];
  finalDecision: HiringDecisionState;
  roleFitDecision: HiringDecisionState;
  confidence: number | null;
  hiringRisk: RoleFitDecision["hiringRisk"];
  headline: string;
  opinion: string[];
  strengths: string[];
  risks: string[];
  missingEvidence: string[];
  nextAction: string;
  validationFocus: string[];
  confidenceCalibration: { completeness: number; evidenceQuality: number; decisionConfidence: number | null };
  dimensions: ExplainableDecision[];
  jobDecision: CandidateJobDecision | null;
};

const unique = (items: string[]) => normalizeEvidenceLabels(items);
const confidenceNumber = (value: "High" | "Medium" | "Low") => value === "High" ? 90 : value === "Medium" ? 70 : 45;
const sourceType = (source: string): EvidenceItem["sourceType"] => source.includes("projects") ? "project" : source.includes("employment") ? "employment" : source.includes("job") || source.includes("requirement") ? "job_requirement" : source.includes("note") ? "recruiter_note" : source.includes("parsed") ? "parsed_resume" : "candidate_field";
const evidenceItem = (label: string, sourceRef: string, value?: string): EvidenceItem => { const source = sourceType(sourceRef); const cleanLabel = recruiterLabel(label); return { label: cleanLabel, ...(value ? { value } : {}), sourceType: source, sourceRef, provenance: createEvidenceProvenance({ claim: cleanLabel, sourceType: source, sourceRef, quotedValue: value, supports: [cleanLabel] }) }; };
const statusFor = (score: number | null, risk = false): ExplainabilityStatus => risk ? "risk" : score === null ? "not_enough_evidence" : score >= 85 ? "strong" : score >= 65 ? "established" : score >= 45 ? "developing" : "limited_evidence";
const verifiedAdverse = (value: string) => /job[- ]?hop|duplicate risk|verified career gap|confirmed mismatch|misrepresent|integrity concern/i.test(value);

function explainSignal(signal: DecisionSignal, nextAction: string): ExplainableDecision {
  const evidence = normalizeEvidenceItems(signal.evidence.map((item) => evidenceItem(item.text, item.source)));
  return { label: recruiterLabel(signal.label), status: statusFor(signal.score, signal.status === "missing" && evidence.length > 0), score: signal.score, confidence: confidenceNumber(signal.confidence), conclusion: signal.reason, why: evidence.length ? evidence.slice(0, 3).map((item) => item.label) : ["The current profile does not contain enough verified supporting signals."], evidence, missingEvidence: unique(signal.missingEvidence), nextAction };
}

function candidateDimensions(profile: Candidate360Profile): ExplainableDecision[] {
  const intelligence = profile.enterpriseProfile.intelligence;
  return [intelligence.implementationAuthority, intelligence.financeDepth, intelligence.consultingDna, intelligence.leadershipReadiness].map((metric) => {
    const evidence = normalizeEvidenceItems(metric.evidence.map((item) => evidenceItem(item, `enterpriseProfile.intelligence.${metric.key}`)));
    return { label: recruiterLabel(metric.label), status: statusFor(metric.score), score: metric.score, confidence: metric.score === null ? null : metric.confidence, conclusion: metric.reason || "This dimension is based on normalized candidate evidence.", why: evidence.length ? evidence.slice(0, 3).map((item) => item.label) : ["The source profile does not contain enough verified signals for this dimension."], evidence, missingEvidence: metric.score === null ? [recruiterLabel(metric.label)] : [], nextAction: metric.score === null ? `Validate ${metric.label.toLocaleLowerCase()} during recruiter screening.` : "Review cited evidence before final leveling." };
  });
}

function readinessEvidence(profile: Candidate360Profile) {
  const h = profile.enterpriseProfile.careerHighlights;
  return normalizeEvidenceItems([
    ...(h.primarySapModule ? [evidenceItem("Primary SAP module", "enterpriseProfile.careerHighlights.primarySapModule", h.primarySapModule)] : []),
    ...(h.yearsExperience ? [evidenceItem("SAP experience", "enterpriseProfile.careerHighlights.yearsExperience", `${h.yearsExperience} years`)] : []),
    ...(h.implementationProjects ? [evidenceItem("Full-cycle implementations", "enterpriseProfile.careerHighlights.implementationProjects", String(h.implementationProjects))] : []),
    ...(h.yearsConsulting ? [evidenceItem("Consulting experience", "enterpriseProfile.careerHighlights.yearsConsulting", `${h.yearsConsulting} years`)] : []),
  ]);
}

export function buildCandidateHiringOpinion(profile: Candidate360Profile, job: Record<string, unknown> | null): CandidateHiringOpinion {
  const enterprise = profile.enterpriseProfile;
  const h = enterprise.careerHighlights;
  const jobDecision = job ? buildCandidateJobDecision(profile, job) : null;
  const evidence = readinessEvidence(profile);
  const validationItems = unique([...enterprise.quality.missingSections, !h.leadershipExperience ? "Leadership ownership" : "", !enterprise.education.length ? "Education" : "", !enterprise.certifications.length ? "Certifications" : "", !enterprise.recruiterSignals.availability ? "Availability" : "", !enterprise.recruiterSignals.salary ? "Salary expectations" : ""]);
  const confirmedRisks = unique(enterprise.quality.reviewRisks.filter(verifiedAdverse));
  const readinessAssessment = calibrateConclusionConfidence({ evidence, completeness: enterprise.quality.profileCompleteness, missingEvidence: validationItems, criticalFields: ["Leadership ownership", "Availability", "Salary expectations", "Employment history"] });
  const readinessConfidence = readinessAssessment.confidence ?? 0;
  const readinessDecision: CandidateReadinessDecision["decision"] = readinessConfidence >= 65 && evidence.length >= 2 ? "Proceed to Recruiter Screening" : evidence.length ? "Need Validation" : "Hold";
  const role = enterprise.identity.currentTitle || h.primarySapModule || "SAP consulting";
  const strengths = unique([
    h.primarySapModule ? `${h.primarySapModule} is the primary evidenced SAP module` : "",
    h.implementationProjects ? `${h.implementationProjects} full-cycle implementation project${h.implementationProjects === 1 ? " is" : "s are"} evidenced` : "",
    h.amsProjects ? `${h.amsProjects} AMS engagement${h.amsProjects === 1 ? " is" : "s are"} evidenced` : "",
    h.yearsConsulting ? `${h.yearsConsulting} years of consulting experience are evidenced` : h.consultingBackground ? "Consulting background is evidenced" : "",
    h.countries.length ? `Delivery exposure includes ${h.countries.slice(0, 3).join(", ")}` : "",
  ]);
  const candidateReadiness: CandidateReadinessDecision = { decision: readinessDecision, confidence: readinessConfidence, opinion: `${enterprise.identity.name || "The candidate"} appears suitable for consideration in ${role} opportunities. ${strengths.slice(0, 3).join(". ")}${strengths.length ? "." : ""}`, evidence, validationItems, nextAction: readinessDecision === "Proceed to Recruiter Screening" ? "Proceed to recruiter screening and validate the unresolved evidence areas." : "Validate core profile evidence before progression." };

  if (!jobDecision) {
    const roleFit: RoleFitDecision = { decision: "Job Required", confidence: null, hiringRisk: "Not Assessed", evidence: [], mismatches: [], missingEvidence: [], nextAction: "Select a structured Job to calculate role-specific fit." };
    return { mode: "candidate_readiness", candidateReadiness, roleFit, confirmedRisks, validationItems, confirmedMismatches: [], finalDecision: "Job Required", roleFitDecision: "Job Required", confidence: readinessConfidence, hiringRisk: "Not Assessed", headline: candidateReadiness.opinion, opinion: [candidateReadiness.opinion], strengths, risks: confirmedRisks, missingEvidence: validationItems, nextAction: candidateReadiness.nextAction || "Validate candidate readiness.", validationFocus: validationItems.slice(0, 5), confidenceCalibration: { completeness: readinessAssessment.completeness, evidenceQuality: readinessAssessment.evidenceQuality, decisionConfidence: readinessAssessment.confidence }, dimensions: candidateDimensions(profile), jobDecision: null };
  }

  const score = jobDecision.overall.score;
  const preliminaryRoleConfidence = confidenceNumber(jobDecision.overall.confidence);
  const confirmedMismatches = unique(jobDecision.requirements.filter((item) => item.status === "missing" && item.evidence.length > 0).map((item) => item.label));
  const missingEvidence = unique([...jobDecision.requirements.filter((item) => item.status !== "matched" && item.evidence.length === 0).flatMap((item) => item.missingEvidence), ...jobDecision.unknowns.flatMap((item) => item.missingEvidence)]);
  const roleEvidence = normalizeEvidenceItems(jobDecision.overall.evidence.map((item) => evidenceItem(item.text, item.source)));
  const roleAssessment = calibrateConclusionConfidence({ evidence: roleEvidence, completeness: enterprise.quality.profileCompleteness, missingEvidence, criticalFields: missingEvidence });
  const roleConfidence = roleAssessment.confidence === null ? null : Math.min(preliminaryRoleConfidence, roleAssessment.confidence);
  const roleDecision: RoleFitDecision["decision"] = score === null || roleConfidence === null || roleConfidence < 55 ? "Need Validation" : confirmedMismatches.length >= 2 && score < 45 ? "Reject" : score >= 72 ? "Interview" : score >= 55 ? "Hold" : "Need Validation";
  const roleRisk: RoleFitDecision["hiringRisk"] = confirmedMismatches.length >= 2 || confirmedRisks.length >= 2 ? "High" : confirmedMismatches.length || confirmedRisks.length ? "Moderate" : "Low";
  const nextAction = roleDecision === "Interview" ? `Run a focused screening interview for ${jobDecision.job.title}.` : roleDecision === "Hold" ? "Hold progression until priority evidence is validated." : roleDecision === "Reject" ? "Reject only against the cited confirmed must-have mismatches." : "Validate missing must-have evidence before making a role decision.";
  const roleFit: RoleFitDecision = { decision: roleDecision, confidence: roleConfidence, hiringRisk: roleRisk, evidence: roleEvidence, mismatches: confirmedMismatches, missingEvidence, nextAction };
  const opinion = [`${enterprise.identity.name || "The candidate"} is assessed against ${jobDecision.job.title}.`, jobDecision.overall.reason, strengths.length ? `Relevant strengths include ${strengths.slice(0, 4).join(", ")}.` : "No verified requirement strength is currently established.", confirmedMismatches.length ? `Confirmed mismatches: ${confirmedMismatches.join(", ")}.` : "No confirmed must-have mismatch is established.", missingEvidence.length ? `${missingEvidence.slice(0, 4).join(", ")} require validation and are not treated as negative facts.` : "No material role evidence gap is registered."];
  return { mode: "job_fit", candidateReadiness, roleFit, confirmedRisks, validationItems: unique([...validationItems, ...missingEvidence]), confirmedMismatches, finalDecision: roleDecision, roleFitDecision: roleDecision, confidence: roleConfidence, hiringRisk: roleRisk, headline: roleDecision === "Interview" ? "Proceed to interview." : roleDecision === "Hold" ? "Hold pending focused validation." : roleDecision === "Reject" ? "Do not progress against this Job." : "More verified role evidence is required.", opinion, strengths, risks: confirmedRisks, missingEvidence, nextAction, validationFocus: unique(jobDecision.interviewFocus.map((item) => item.question)).slice(0, 5), confidenceCalibration: { completeness: roleAssessment.completeness, evidenceQuality: roleAssessment.evidenceQuality, decisionConfidence: roleAssessment.confidence }, dimensions: [explainSignal(jobDecision.overall, nextAction), ...jobDecision.breakdown.map((item) => explainSignal(item, item.score === null ? `Validate ${item.label.toLocaleLowerCase()} evidence.` : "Review cited evidence during screening."))], jobDecision };
}


