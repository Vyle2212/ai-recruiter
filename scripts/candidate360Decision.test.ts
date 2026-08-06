import assert from "node:assert/strict";
import { buildCandidateJobDecision } from "../lib/candidate360Decision";
import type { Candidate360Profile } from "../lib/candidate360Types";

const profile = {
  enterpriseProfile: {
    identity: { currentTitle: "Senior SAP FICO Consultant", currentCompany: "Consulting Co", location: "Malaysia", country: "Malaysia" },
    summary: "SAP FICO consultant.", sapModules: ["FICO", "CO"], technicalSkills: ["S/4HANA"],
    languages: [{ language: "English", proficiency: "Professional" }],
    projects: [{ id: "p1", name: "Finance Transformation", client: "Evidence Client", role: "Lead Consultant", industry: "Banking", country: "Malaysia", projectType: "Implementation", implementationType: "Greenfield", environment: "S/4HANA", modules: ["FICO"], responsibilities: ["Led finance design workshops"], teamSize: 12, start: "2022", end: "2023", duration: "1 year" }],
    employmentTimeline: [{ id: "e1", company: "Consulting Co", title: "Senior SAP FICO Consultant", location: "Malaysia", companyType: "Consulting", modules: ["FICO"], achievements: [], start: "2020", end: "Present", duration: "6 years", current: true }],
    careerHighlights: { yearsExperience: 10, yearsConsulting: 6, yearsLeadership: null, implementationProjects: 3, rolloutProjects: 0, greenfieldProjects: 1, brownfieldProjects: 0, amsProjects: 0, supportProjects: 0, primarySapModule: "FICO", countries: ["Malaysia"], industries: ["Banking"], consultingBackground: true, endUserBackground: false, leadershipExperience: false, teamSize: 12, regionalExperience: [], s4hana: true, ecc: false, migration: false, treasury: false, banking: true, publicCloud: false, privateCloud: false },
    recruiterSignals: { availability: "", notice: "", salary: "", travel: "", remote: "", visa: "" },
    intelligence: {}, quality: { profileCompleteness: 80, dataConfidence: 80, missingSections: [], reviewRisks: [] }, education: [], certifications: [],
  },
} as unknown as Candidate360Profile;

const decision = buildCandidateJobDecision(profile, { id: "j1", title: "SAP FICO Lead", requirements: ["SAP FICO", "S/4HANA", "Malaysia", "Treasury"] });
assert.equal(decision.job.id, "j1");
assert.equal(decision.requirements.length, 4);
assert.ok(decision.requirements.some((item) => item.label === "Treasury" && item.status === "missing"));
assert.ok(decision.unknowns.some((item) => item.label === "Salary expectations"));
assert.ok(decision.overall.evidence.every((item) => item.source.length > 0));
assert.equal(decision.market.available, false);
assert.ok(decision.interviewFocus.some((item) => /Treasury/i.test(item.question)));

const noRequirements = buildCandidateJobDecision(profile, { id: "j2", title: "Unstructured role" });
assert.equal(noRequirements.overall.score, null);
assert.equal(noRequirements.overall.recommendation, "Job Required");

console.log("candidate360Decision tests passed");


