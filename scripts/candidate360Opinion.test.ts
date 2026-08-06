import assert from "node:assert/strict";
import { buildCandidateHiringOpinion, type ExplainableDecision, type HiringDecisionState } from "../lib/candidate360Opinion";
import type { Candidate360Profile } from "../lib/candidate360Types";

const metric = (key: string, label: string, score: number | null, evidence: string[] = []) => ({ key, label, score, confidence: score === null ? 0 : 85, evidence, reason: evidence.length ? `${label} is supported by normalized evidence.` : `${label} requires more verified evidence.` });
const profile = { candidateId: "c1", readiness: { readyForShortlist: true, needsRecruiterReview: false, needsCandidateConfirmation: false }, enterpriseProfile: {
  identity: { name: "Leonard", currentTitle: "Senior SAP FICO Consultant", currentCompany: "Consulting Co", location: "Malaysia", country: "Malaysia" }, summary: "SAP FICO consultant.", sapModules: ["FICO"], technicalSkills: ["S/4HANA"], languages: [{ language: "English", proficiency: "Professional" }],
  projects: [{ id: "p1", name: "Finance Transformation", client: "Evidence Client", role: "Lead Consultant", industry: "Banking", country: "Malaysia", projectType: "Implementation", implementationType: "Greenfield", environment: "S/4HANA", modules: ["FICO"], responsibilities: ["Led finance design workshops"], teamSize: 12, start: "2022", end: "2023", duration: "1 year" }],
  employmentTimeline: [], careerHighlights: { yearsExperience: 10, yearsConsulting: 6, yearsLeadership: null, implementationProjects: 3, rolloutProjects: 0, greenfieldProjects: 1, brownfieldProjects: 0, amsProjects: 2, supportProjects: 0, primarySapModule: "FICO", countries: ["Malaysia"], industries: ["Banking"], consultingBackground: true, endUserBackground: false, leadershipExperience: false, teamSize: 12, regionalExperience: [], s4hana: true, ecc: false, migration: false, treasury: false, banking: true, publicCloud: false, privateCloud: false },
  recruiterSignals: { availability: "", notice: "", salary: "", travel: "", remote: "", visa: "" }, education: [], certifications: [], quality: { profileCompleteness: 80, dataConfidence: 80, missingSections: ["education", "Education", "certification"], reviewRisks: [] },
  intelligence: { implementationAuthority: metric("implementationAuthority", "Implementation Authority", 86, ["3 implementations"]), financeDepth: metric("financeDepth", "Finance Depth", 82, ["FICO"]), consultingDna: metric("consultingDna", "Consulting DNA", 80, ["6 years consulting"]), leadershipReadiness: metric("leadershipReadiness", "Leadership Readiness", null) },
} } as unknown as Candidate360Profile;

const allowed: HiringDecisionState[] = ["Interview", "Hold", "Reject", "Need Validation", "Job Required"];
const candidateOpinion = buildCandidateHiringOpinion(profile, null);
assert.equal(candidateOpinion.mode, "candidate_readiness");
assert.equal(candidateOpinion.roleFitDecision, "Job Required");
assert.equal(candidateOpinion.finalDecision, "Job Required");
assert.equal(candidateOpinion.candidateReadiness.decision, "Need Validation");
assert.ok((candidateOpinion.candidateReadiness.confidence ?? 100) <= 55, "critical gaps cap readiness confidence");
assert.equal(candidateOpinion.roleFit.confidence, null);
assert.equal(candidateOpinion.roleFit.hiringRisk, "Not Assessed");
assert.deepEqual(candidateOpinion.validationItems.filter((item) => /education/i.test(item)), ["Education"]);
assert.ok(!candidateOpinion.confirmedRisks.includes("Education"));
assert.ok((candidateOpinion.confidence ?? 0) > 0);
assert.ok(candidateOpinion.strengths.some((item) => /implementation/i.test(item)));
assert.ok(candidateOpinion.missingEvidence.includes("Leadership ownership"));

const jobOpinion = buildCandidateHiringOpinion(profile, { id: "j1", title: "SAP FICO Lead", requirements: ["SAP FICO", "S/4HANA", "Malaysia", "Treasury"] });
assert.equal(jobOpinion.mode, "job_fit");
assert.ok(allowed.includes(jobOpinion.finalDecision));
assert.notEqual(jobOpinion.roleFitDecision, "Job Required");
assert.ok(jobOpinion.missingEvidence.some((item) => /Treasury/i.test(item)));
assert.equal(jobOpinion.confirmedMismatches.length, 0, "missing Treasury evidence is not a confirmed mismatch");
assert.equal(jobOpinion.roleFit.hiringRisk, "Low", "missing profile fields do not create high hiring risk");
assert.doesNotMatch(JSON.stringify(candidateOpinion), /engagement\\\(s\\\)/);
assert.ok(jobOpinion.opinion.some((item) => /not treated as negative facts/i.test(item)));
const allExplainable: ExplainableDecision[] = jobOpinion.dimensions;
assert.ok(allExplainable.every((item) => item.conclusion && item.why.length && item.nextAction));
assert.ok(allExplainable.flatMap((item) => item.evidence).every((item) => item.sourceType));

console.log("candidate360Opinion tests passed");




