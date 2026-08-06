import type { Candidate360Profile } from "./candidate360Types";
import { buildCandidateHiringOpinion } from "./candidate360Opinion";
import { normalizeEvidenceItems, normalizeEvidenceLabels, type EvidenceItem } from "./candidate360Evidence";
import { calibrateConclusionConfidence } from "./candidate360Confidence";

export type HiringAnalystAnswer = { answer: string; confidence: number | null; evidence: EvidenceItem[]; missingEvidence: string[]; nextAction: string | null };
const projectEvidence = (profile: Candidate360Profile, pattern: RegExp) => profile.enterpriseProfile.projects.filter((project) => pattern.test([project.name, project.client, project.role, project.projectType, project.implementationType, project.environment, ...project.modules, ...project.responsibilities].join(" ")));
const evidenceForProjects = (projects: Candidate360Profile["enterpriseProfile"]["projects"]): EvidenceItem[] => projects.slice(0, 6).map((project) => ({ label: project.name || project.client || "Project evidence", value: [project.role, project.implementationType || project.projectType].filter(Boolean).join(" · "), sourceType: "project", sourceRef: `enterpriseProfile.projects.${project.id}` }));
const insufficient = (missing: string[], nextAction = "Validate this evidence directly with the candidate."): HiringAnalystAnswer => ({ answer: "Insufficient evidence found in the source profile.", confidence: null, evidence: [], missingEvidence: normalizeEvidenceLabels(missing), nextAction });

function answerCandidateHiringQuestionRaw(profile: Candidate360Profile, job: Record<string, unknown> | null, question: string): HiringAnalystAnswer {
  const normalized = question.trim().toLocaleLowerCase();
  const enterprise = profile.enterpriseProfile;
  const highlights = enterprise.careerHighlights;
  const opinion = buildCandidateHiringOpinion(profile, job);
  if (!normalized) return insufficient(["Question"]);
  if (/greenfield/.test(normalized)) {
    const projects = projectEvidence(profile, /greenfield/i);
    if (!projects.length) return insufficient(["Greenfield project ownership"], "Ask the candidate to identify Greenfield projects and personal ownership.");
    const led = projects.filter((project) => /lead|manager|owner|architect/i.test(project.role));
    return { answer: led.length ? `${led.length} Greenfield project${led.length === 1 ? "" : "s"} contain explicit leadership or ownership evidence.` : `${projects.length} Greenfield project${projects.length === 1 ? " is" : "s are"} evidenced, but leadership ownership requires validation.`, confidence: led.length ? 90 : 70, evidence: normalizeEvidenceItems(evidenceForProjects(projects)), missingEvidence: led.length ? [] : ["Leadership ownership"], nextAction: "Validate delivery scope, project scale and personal ownership during screening." };
  }
  if (/treasury|\btrm\b/.test(normalized)) {
    const projects = projectEvidence(profile, /treasury|\btrm\b/i);
    const modules = enterprise.sapModules.filter((module) => /treasury|\btrm\b/i.test(module));
    const evidence = normalizeEvidenceItems([...modules.map((module) => ({ label: module, sourceType: "candidate_field" as const, sourceRef: "enterpriseProfile.sapModules" })), ...evidenceForProjects(projects)]);
    if (!evidence.length) return insufficient(["Treasury depth"], "Validate Treasury configuration and delivery depth during screening.");
    return { answer: `Treasury evidence is present across ${evidence.length} verified profile signal${evidence.length === 1 ? "" : "s"}.`, confidence: projects.length ? 88 : 68, evidence, missingEvidence: projects.length ? [] : ["Project-level Treasury ownership"], nextAction: "Validate configuration scope, implementation phase and business ownership." };
  }
  if (/implementation/.test(normalized)) {
    const projects = projectEvidence(profile, /implementation|greenfield|brownfield/i);
    const count = highlights.implementationProjects || projects.length;
    if (!count) return insufficient(["Implementation project history"]);
    const evidence = normalizeEvidenceItems([{ label: "Full-cycle implementations", value: String(count), sourceType: "candidate_field", sourceRef: "enterpriseProfile.careerHighlights.implementationProjects" }, ...evidenceForProjects(projects)]);
    return { answer: `${count} full-cycle implementation project${count === 1 ? " is" : "s are"} evidenced.`, confidence: projects.length ? 90 : 72, evidence, missingEvidence: projects.length ? [] : ["Project-level implementation ownership"], nextAction: "Validate personal ownership, implementation phases and delivery outcomes." };
  }
  if (/risk|concern/.test(normalized)) {
    const confirmed = opinion.confirmedRisks;
    const validation = opinion.validationItems;
    if (!confirmed.length && !validation.length) return { answer: "No confirmed adverse hiring risk is established in the current evidence.", confidence: opinion.confidence, evidence: opinion.roleFit.evidence, missingEvidence: [], nextAction: "Continue standard recruiter screening." };
    return { answer: confirmed.length ? `${confirmed.length} confirmed hiring risk${confirmed.length === 1 ? " requires" : "s require"} review. Missing information is listed separately as validation work.` : "No confirmed adverse hiring risk is established. The profile contains validation items that should be resolved during screening.", confidence: opinion.confidence, evidence: opinion.roleFit.evidence, missingEvidence: validation, nextAction: opinion.roleFit.nextAction || opinion.candidateReadiness.nextAction };
  }
  if (/missing|gap|evidence/.test(normalized)) return opinion.validationItems.length ? { answer: `${opinion.validationItems.length} evidence area${opinion.validationItems.length === 1 ? " requires" : "s require"} validation.`, confidence: opinion.confidence, evidence: [], missingEvidence: opinion.validationItems, nextAction: "Resolve these items during recruiter screening before submission." } : { answer: "No material evidence gap is currently registered.", confidence: opinion.confidence, evidence: opinion.candidateReadiness.evidence, missingEvidence: [], nextAction: "Continue standard recruiter screening." };
  if (/interview question|interview focus/.test(normalized)) return opinion.validationFocus.length ? { answer: opinion.validationFocus.map((item, index) => `${index + 1}. ${item}`).join("\n"), confidence: opinion.confidence, evidence: opinion.roleFit.evidence, missingEvidence: opinion.validationItems, nextAction: "Use these questions in the next recruiter or hiring-manager interview." } : insufficient(["Interview focus"], "Select a structured Job or add verified evidence to generate focused questions.");
  if (/senior manager|principal consultant|fit|suitable|role/.test(normalized)) return { answer: opinion.mode === "job_fit" ? `${opinion.roleFit.decision}. ${opinion.headline}` : `${opinion.candidateReadiness.decision}. This is a candidate-readiness opinion; role fit requires a selected Job.`, confidence: opinion.mode === "job_fit" ? opinion.roleFit.confidence : opinion.candidateReadiness.confidence, evidence: opinion.mode === "job_fit" ? opinion.roleFit.evidence : opinion.candidateReadiness.evidence, missingEvidence: opinion.validationItems, nextAction: opinion.mode === "job_fit" ? opinion.roleFit.nextAction : opinion.candidateReadiness.nextAction };
  return insufficient(["Evidence relevant to this question"], "Rephrase the question around skills, projects, implementation delivery, risks or Job requirements.");
}

export function answerCandidateHiringQuestion(profile: Candidate360Profile, job: Record<string, unknown> | null, question: string): HiringAnalystAnswer {
  const answer = answerCandidateHiringQuestionRaw(profile, job, question);
  const assessment = calibrateConclusionConfidence({ evidence: answer.evidence, completeness: profile.enterpriseProfile.quality.profileCompleteness, missingEvidence: answer.missingEvidence, criticalFields: answer.missingEvidence });
  return { ...answer, confidence: answer.evidence.length ? Math.min(answer.confidence ?? 100, assessment.confidence ?? 100) : null };
}

