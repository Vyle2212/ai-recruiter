import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { auditAiCandidateExtraction, createMockAiExtractionProvider, extractAiCandidateProfile, fallbackAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";
import { field, type RawAiCandidateExtraction } from "../lib/cvExtractionSchema";
import { writeAiCandidateExtractionReport, AI_CANDIDATE_EXTRACTION_PATH } from "./exportAiCandidateExtraction";

function candidate(overrides: Record<string, any> = {}) {
  return {
    id: "candidate-1",
    name: "Candidate profile pending validation",
    current_title: "",
    raw_text: `Full Name: Priya Raman
Email: priya.raman@example.com
Phone: +60 12 345 6789
LinkedIn: https://linkedin.com/in/priya-raman
Kuala Lumpur Malaysia
SAP FICO Consultant
Jan 2022 - Present Deloitte SAP FICO Consultant
Previous Employer: Accenture
Client Name Yash Technologies
S/4HANA implementation rollout support data migration UAT SIT WRICEF BAPI
Expected Salary MYR 8,000 monthly
Notice period: 1 month`,
    ...overrides,
  };
}

function raw(overrides: Partial<RawAiCandidateExtraction> = {}): RawAiCandidateExtraction {
  const base: RawAiCandidateExtraction = {
    identity: { fullName: field("Priya Raman", 96, "identity", "Full Name: Priya Raman"), alternateNames: [] },
    contact: { email: field("priya.raman@example.com", 95, "contact", "Email: priya.raman@example.com"), phone: field("+60 12 345 6789", 88, "contact", "Phone: +60 12 345 6789"), linkedInUrl: field("https://linkedin.com/in/priya-raman", 90, "contact", "LinkedIn: https://linkedin.com/in/priya-raman") },
    location: { city: field("Kuala Lumpur", 84, "contact", "Kuala Lumpur Malaysia"), country: field("Malaysia", 84, "contact", "Kuala Lumpur Malaysia") },
    role: { currentTitle: field("SAP FICO Consultant", 92, "experience", "SAP FICO Consultant"), seniorityLevel: "consultant" },
    employer: { currentEmployer: field("Deloitte", 88, "experience", "Jan 2022 - Present Deloitte SAP FICO Consultant"), previousEmployer: field("Accenture", 80, "experience", "Previous Employer: Accenture"), employerHistory: [] },
    clientProjects: { clientCompanies: ["Yash Technologies"], projectCompanies: ["Yash Technologies"], projectHistory: [], clientVsEmployerDecision: "client_project_separated_from_employer", clientVsEmployerEvidence: "Client Name Yash Technologies" },
    sap: { primarySapModule: field("FICO", 90, "skills", "SAP FICO Consultant"), secondarySapModules: [], sapModules: ["FICO"], sapSkills: ["S/4HANA", "UAT", "SIT", "BAPI"], functionalSkills: [], technicalSkills: ["BAPI"], integrationSkills: [], businessProcesses: ["Finance"], projectTypes: ["Implementation", "Rollout", "Support"], s4hanaEvidence: "S/4HANA implementation", eccEvidence: "", riseEvidence: "" },
    experience: { totalYearsExperience: field(8, 76, "summary", "8 years"), sapYearsExperience: field(8, 76, "summary", "8 years SAP"), implementationCount: 1, rolloutCount: 1, supportCount: 1, amsExperience: false, employmentHistory: [], projectHistory: [] },
    compensation: { currentSalary: field<string>(null, 0, "", ""), expectedSalary: field("MYR 8,000 monthly", 82, "compensation", "Expected Salary MYR 8,000 monthly"), salaryCurrency: "MYR", salaryPeriod: "monthly", noticePeriod: field("1 month", 78, "compensation", "Notice period: 1 month"), availability: field<string>(null, 0, "", ""), compensationEvidence: "Expected Salary MYR 8,000 monthly | Notice period: 1 month" },
    quality: { extractionConfidenceOverall: 88, fieldCompletenessScore: 95, rawTextQuality: "", evidenceSummary: {} },
  };
  return { ...base, ...overrides } as RawAiCandidateExtraction;
}

async function main() {
const fallback = await extractAiCandidateProfile(candidate(), fallbackAiExtractionProvider);
assert.equal(fallback.isNameValid, true, "fallback extracts labelled Full Name");
assert.equal(fallback.email, "priya.raman@example.com", "email is extracted");
assert.equal(fallback.phone.includes("60"), true, "phone is extracted");
assert.equal(fallback.linkedInUrl.includes("linkedin.com"), true, "LinkedIn is extracted");
assert.equal(fallback.currentTitle, "SAP FICO Consultant", "title is normalized/extracted");
assert.equal(Boolean(fallback.currentEmployer), true, "fallback returns an employer value or Not disclosed");
assert.equal(fallback.clientProjects.clientCompanies.includes("Yash Technologies"), true, "client/project is separated from employer");
assert.equal(fallback.primarySapModule, "FICO", "primary SAP module is extracted");
assert.equal(fallback.compensation.expectedSalary.value, "MYR 8,000 monthly", "salary is extracted");
assert.equal(fallback.compensation.noticePeriod.value, "1 month", "notice period is extracted");
assert.equal(fallback.searchReadiness, true, "clean SAP profile is search ready");

const mockExactEmployer = await extractAiCandidateProfile(candidate(), createMockAiExtractionProvider(raw()));
assert.equal(mockExactEmployer.currentEmployer, "Deloitte", "current employer is extracted from provider output");
assert.equal(mockExactEmployer.previousEmployer, "Accenture", "previous employer is extracted from provider output");

const compressed = await extractAiCandidateProfile(candidate({ id: "compressed", raw_text: "FullName:TranQuocTrieuDateofbirth:18/11/1992\nEmail: tran.quoc.trieu@example.com\nVietnam\nSAP ABAP Consultant\nABAP OData BAPI S/4HANA implementation support data migration UAT SIT repeated SAP project evidence for extraction quality" }), fallbackAiExtractionProvider);
assert.equal(compressed.identity.fullName.value, "Tran Quoc Trieu", "compressed FullName extraction works");

const headerName = await extractAiCandidateProfile(candidate({ id: "header", name: "Profile Under Review", raw_text: "Nguyen Minh Thu\nEmail: thu.nguyen@example.com\nHo Chi Minh Vietnam\nSAP SD Consultant\nS/4HANA SD implementation support data migration UAT SIT repeated SAP project evidence for extraction quality" }), fallbackAiExtractionProvider);
assert.equal(headerName.identity.fullName.value, "Nguyen Minh Thu", "header name near contact is extracted");

const summaryTitle = await extractAiCandidateProfile(candidate({ id: "summary-title", name: "Fakhrin bin Mohd Ramli", current_title: "11 years as SAP Consultant: 5 implementation projects", raw_text: "Fakhrin bin Mohd Ramli\nEmail: fakhrin@example.com\nMalaysia\n11 years as SAP Consultant: 5 implementation projects\nSAP MM implementation rollout support repeated SAP project evidence for extraction quality across logistics, procurement, data migration, UAT, SIT, cutover, hypercare, configuration, user training, defect triage, integration testing, stakeholder workshops, production support, and documentation" }), fallbackAiExtractionProvider);
assert.equal(summaryTitle.reviewClassification, "blocked_title", "summary title is rejected");

const clientEmployerMock = await extractAiCandidateProfile(candidate(), createMockAiExtractionProvider(raw({ employer: { currentEmployer: field("Yash Technologies", 90, "project", "Client Name Yash Technologies"), previousEmployer: field<string>(null, 0, "", ""), employerHistory: [] } })));
assert.equal(clientEmployerMock.currentEmployer, "Not disclosed", "client/project company is not treated as employer");
assert.equal(clientEmployerMock.employerRejectReason, "client_or_project_company_not_employer", "client-as-employer is rejected");

const badCompanyMock = await extractAiCandidateProfile(candidate(), createMockAiExtractionProvider(raw({ employer: { currentEmployer: field("by achieving 2nd", 90, "achievements", "by achieving 2nd"), previousEmployer: field<string>(null, 0, "", ""), employerHistory: [] } })));
assert.equal(badCompanyMock.currentEmployer, "Not disclosed", "company fragment is rejected");

const hallucinated = await extractAiCandidateProfile(candidate(), createMockAiExtractionProvider(raw({ identity: { fullName: field("Alice Wonderland", 99, "identity", "No matching evidence"), alternateNames: [] } })));
assert.equal(hallucinated.reviewClassification, "blocked_identity", "validator rejects hallucinated names");

const notDisclosedEmployer = await extractAiCandidateProfile(candidate(), createMockAiExtractionProvider(raw({ employer: { currentEmployer: field("Not disclosed", 60, "not_disclosed", ""), previousEmployer: field<string>(null, 0, "", ""), employerHistory: [] } })));
assert.equal(notDisclosedEmployer.currentEmployer, "Not disclosed", "Not disclosed employer is accepted");
assert.equal(notDisclosedEmployer.searchReadiness, true, "Not disclosed employer can still be search ready when other fields are clean");

const noSap = await extractAiCandidateProfile(candidate({ raw_text: "Priya Raman\nEmail: priya.raman@example.com\nMalaysia\nOperations Manager\nManaged enterprise operations, reporting governance, stakeholder workshops, process documentation, user coordination, delivery tracking, team planning, issue escalation, service reporting, training coordination, and operational support across several business units without any enterprise software module evidence." }), createMockAiExtractionProvider(raw({ sap: { primarySapModule: field<string>(null, 0, "", ""), secondarySapModules: [], sapModules: [], sapSkills: [], functionalSkills: [], technicalSkills: [], integrationSkills: [], businessProcesses: [], projectTypes: [], s4hanaEvidence: "", eccEvidence: "", riseEvidence: "" } })));
assert.equal(noSap.reviewClassification, "likely_non_sap_or_low_quality", "missing SAP evidence is not search ready");

const shortRaw = await extractAiCandidateProfile({ id: "short", raw_text: "x SAP", name: "Profile Under Review" }, fallbackAiExtractionProvider);
assert.equal(shortRaw.reviewClassification, "likely_reupload_required", "poor raw text requires reupload");

const audit = await auditAiCandidateExtraction([candidate(), candidate({ id: "bad", name: "Robot Framework", raw_text: "Robot Framework\nEmail: bad@example.com\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support repeated SAP evidence" })]);
assert.equal(audit.summary.totalCandidates, 2, "audit counts candidates");
assert.equal(audit.summary.aiExtractionAttempted, 2, "audit attempts extraction for all candidates");
assert.equal(audit.safeApplyCandidates.some((item) => !item.safeToApply), false, "safe apply candidates are validated");

const reportPath = path.join(process.cwd(), "reports", "ai-candidate-extraction.test.json");
const exported = await writeAiCandidateExtractionReport([candidate()], reportPath);
assert.equal(exported.mode, "read-only", "AI export is read-only");
assert.equal(exported.items.length, 1, "AI export includes items");
assert.equal(AI_CANDIDATE_EXTRACTION_PATH, path.join("reports", "ai-candidate-extraction.json"), "AI export path is stable");
if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

const sources = [
  fs.readFileSync(new URL("../lib/aiCandidateExtractionEngine.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("../lib/cvExtractionValidator.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./auditAiCandidateExtraction.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./exportAiCandidateExtraction.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(sources.includes(".update("), false, "no DB update behavior");
assert.equal(sources.includes(".insert("), false, "no DB insert behavior");
assert.equal(sources.includes(".delete("), false, "no DB delete behavior");

console.log("AI candidate extraction tests passed");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
