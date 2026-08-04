import assert from "node:assert/strict";
import fs from "node:fs";
import { buildBackgroundAiExtractionQueue } from "../lib/backgroundAiExtractionQueue";
import { buildAiExtractionReview, classifyFieldChange } from "../lib/aiExtractionReviewFlow";
import { buildAiExtractionApplyPlan } from "../lib/aiExtractionApplyPlan";
import { loadCachedBackgroundAiResults } from "./exportAiExtractionReview";
import { extractAiCandidateProfile, createMockAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";

function candidate(overrides: Record<string, any> = {}) {
  return {
    id: "queue-1",
    name: "Queue Candidate",
    display_name: "Queue Candidate",
    current_title: "",
    current_company: "",
    email: "",
    phone: "",
    country: "Malaysia",
    raw_text: `Queue Candidate
Email: queue@example.com
Kuala Lumpur Malaysia
SAP FICO implementation support migration UAT SIT project evidence
Worked on finance configuration and reporting across implementation, support, migration, cutover, hypercare, user training, defect triage, data conversion, integration testing, finance configuration, reporting, business process workshops, documentation, production support, and SAP project delivery for multiple enterprise stakeholders.`,
    ...overrides,
  };
}

function ai(overrides: Record<string, any> = {}) {
  return {
    candidateId: "queue-1",
    displayName: "Queue Candidate",
    isNameValid: true,
    nameConfidence: 96,
    nameEvidence: "Queue Candidate",
    currentTitle: "SAP FICO Consultant",
    title: "SAP FICO Consultant",
    isTitleValid: true,
    titleConfidence: 92,
    titleEvidence: "SAP FICO Consultant",
    currentEmployer: "Deloitte Consulting",
    currentCompany: "Deloitte Consulting",
    isEmployerValid: true,
    employerConfidence: 88,
    currentEmployerEvidence: "Employer: Deloitte Consulting",
    email: "queue@example.com",
    phone: "",
    contactConfidence: 95,
    contactEvidence: "Email: queue@example.com",
    normalizedCountry: "Malaysia",
    primarySapModule: "FICO",
    sap: { primarySapModule: { value: "FICO", confidence: 92, evidence: "SAP FICO Consultant" } },
    ...overrides,
  } as any;
}

async function main() {
const candidates = [
  candidate(),
  candidate({ id: "keep-1", name: "Existing Ready", display_name: "Existing Ready", current_title: "SAP FICO Consultant", current_company: "Deloitte Consulting", sap_modules: ["FICO"], email: "ready@example.com", raw_text: "Existing Ready\nSAP FICO Consultant\nDeloitte Consulting\nEmail ready@example.com\nMalaysia\nSAP FICO implementation support migration UAT SIT" }),
  candidate({ id: "reupload-1", name: "Profile Under Review", display_name: "Profile Under Review", raw_text: "x SAP" }),
];

const queue = buildBackgroundAiExtractionQueue(candidates, { sampleMixed: true, limit: 3, noOpenAI: true });
assert.equal(queue.queueItems.every((item) => item.reasonForAiQueue), true, "queue items include reasons");
assert.equal(queue.queueItems.some((item) => item.candidateId === "keep-1"), false, "keep_existing records are excluded from AI queue");
assert.equal(queue.queueItems.some((item) => item.candidateId === "reupload-1"), false, "reupload records are excluded from AI queue");
assert.equal(queue.options.noOpenAI, true, "noOpenAI is defaulted for queue audit");

const dirtyEmployer = classifyFieldChange("currentCompany", "", "", "yahoo.com PROFESSIONAL EXPERIENCES CIMB Bank Berhad", ai({ currentEmployer: "yahoo.com PROFESSIONAL EXPERIENCES CIMB Bank Berhad", isEmployerValid: false, currentEmployerEvidence: "yahoo.com PROFESSIONAL EXPERIENCES CIMB Bank Berhad" }));
assert.equal(dirtyEmployer.decision, "reject", "AI review rejects dirty employer");

const fakeIdentity = classifyFieldChange("displayName", "", "", "HP ALM, Service Now", ai({ displayName: "HP ALM, Service Now", isNameValid: false, nameEvidence: "HP ALM, Service Now" }));
assert.equal(fakeIdentity.decision, "reject", "AI review rejects fake identity");

const moduleConflict = classifyFieldChange("primarySapModule", "", "FICO", "MM", ai({ currentTitle: "SAP FICO Consultant", primarySapModule: "MM", sap: { primarySapModule: { value: "MM", confidence: 90, evidence: "MM" } } }));
assert.equal(moduleConflict.decision, "conflict", "AI review detects module conflict");

const keepExisting = classifyFieldChange("email", "valid@example.com", "", "other@example.com", ai({ email: "other@example.com", contactConfidence: 70, contactEvidence: "Email: other@example.com" }));
assert.equal(keepExisting.decision, "risky_needs_review", "AI lower-confidence contact does not overwrite existing valid contact automatically");

const review = buildAiExtractionReview([candidate()], [ai()], { limit: 1, noOpenAI: true });
assert.equal(review.safeChanges.length > 0, true, "review produces safe changes when AI evidence is clean");
assert.equal(review.rejectedChanges.length, 0, "clean AI result has no rejected changes");

const plan = buildAiExtractionApplyPlan([candidate()], [ai()], { limit: 1, noOpenAI: true });
assert.equal(plan.items.every((item) => item.proposedFieldUpdates.every((field: any) => field.riskLevel === "safe")), true, "safe apply plan includes only safe_accept fields");
assert.equal(plan.mode.includes("no DB writes"), true, "apply plan is dry-run only");

const nullishRaw: any = {
  identity: { fullName: null, alternateNames: [] },
  contact: { email: undefined, phone: null, linkedInUrl: null },
  location: { city: null, country: null },
  role: { currentTitle: null, seniorityLevel: "" },
  employer: { currentEmployer: null, currentCompanyStartDate: null, currentCompanyEndDate: null, currentCompanyYearsExperience: null, currentCompanyTenureText: null, previousEmployer: null, previousCompanyStartDate: null, previousCompanyEndDate: null, previousCompanyYearsExperience: null, previousCompanyTenureText: null, employerHistory: [] },
  clientProjects: { clientCompanies: [], projectCompanies: [], projectHistory: [], clientVsEmployerDecision: "", clientVsEmployerEvidence: "" },
  sap: { primarySapModule: null, secondarySapModules: [], sapModules: [], sapSkills: [], functionalSkills: [], technicalSkills: [], integrationSkills: [], businessProcesses: [], projectTypes: [], s4hanaEvidence: "", eccEvidence: "", riseEvidence: "" },
  experience: { totalYearsExperience: null, sapYearsExperience: null, implementationCount: 0, rolloutCount: 0, supportCount: 0, amsExperience: false, employmentHistory: [], projectHistory: [] },
  compensation: { currentSalary: null, expectedSalary: null, salaryCurrency: "", salaryPeriod: "", noticePeriod: null, availability: null, compensationEvidence: "" },
  quality: { extractionConfidenceOverall: 0, fieldCompletenessScore: 0, rawTextQuality: "", evidenceSummary: {} },
};
const nullishValidated = await extractAiCandidateProfile(candidate({ id: "nullish-ai" }), createMockAiExtractionProvider(nullishRaw));
assert.equal(Array.isArray(nullishValidated.reviewReasons), true, "AI field null does not crash validation");
assert.equal(nullishValidated.reviewReasons.some((reason) => /normalized_null_or_invalid_field/.test(reason)), true, "null fields are normalized with warnings");
const nullishReview = buildAiExtractionReview([candidate({ id: "nullish-ai" })], [nullishValidated], { limit: 1, noOpenAI: true });
assert.equal(nullishReview.summary.aiExtractionAvailable, 1, "review can handle null AI fields");
const nullishPlan = buildAiExtractionApplyPlan([candidate({ id: "nullish-ai" })], [nullishValidated], { limit: 1, noOpenAI: true });
assert.equal(nullishPlan.summary.totalReviewed, 1, "apply plan can handle null AI fields");
const cachePath = "reports/background-ai-extraction-results.test.json";
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(cachePath, JSON.stringify({ results: [ai(), ai({ candidateId: "unmatched-cache" })] }, null, 2));
const cached = loadCachedBackgroundAiResults(cachePath);
assert.equal(cached.loaded, true, "background AI result cache can be loaded");
assert.equal(cached.results.length, 2, "cache loader returns cached AI results");
const cachedReview = buildAiExtractionReview([candidate()], cached.results, { limit: 1, noOpenAI: true, aiResultsPath: cachePath, aiResultsFileLoaded: cached.loaded } as any);
assert.equal(cachedReview.summary.aiExtractionAvailable, 1, "review matches AI result by candidateId");
assert.equal(cachedReview.summary.candidateIdMatched, 1, "review reports candidateId matched count");
assert.equal(cachedReview.summary.unmatchedCachedAiResults, 1, "review reports unmatched cached AI results");
assert.equal(cachedReview.summary.cachedAiResultFileLoaded, true, "review reports cache file loaded");
const missingReview = buildAiExtractionReview([candidate({ id: "missing-cache" })], cached.results, { limit: 1, noOpenAI: true, aiResultsPath: cachePath, aiResultsFileLoaded: cached.loaded } as any);
assert.equal(missingReview.summary.aiExtractionMissing, 1, "unmatched queue candidate stays missing");
const cachedPlan = buildAiExtractionApplyPlan([candidate()], cached.results, { limit: 1, noOpenAI: true, aiResultsPath: cachePath, aiResultsFileLoaded: cached.loaded } as any);
assert.equal(cachedPlan.reviewSummary.aiExtractionAvailable, 1, "apply plan uses cached AI result");
fs.unlinkSync(cachePath);
const sources = [
  fs.readFileSync(new URL("../lib/backgroundAiExtractionQueue.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("../lib/aiExtractionReviewFlow.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("../lib/aiExtractionApplyPlan.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./auditAiExtractionApplyPlan.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(sources.includes(".update("), false, "no DB update behavior");
assert.equal(sources.includes(".insert("), false, "no DB insert behavior");
assert.equal(sources.includes(".delete("), false, "no DB delete behavior");

console.log("Background AI extraction queue tests passed");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
