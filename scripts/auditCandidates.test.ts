import { auditCandidates } from "../lib/candidateAudit";
import "./candidateValidation.test";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function cleanCandidate(overrides: Record<string, any> = {}) {
  return {
    id: "clean-1",
    name: "Alicia Tan",
    email: "alicia.tan@example.com",
    phone: "+60123456789",
    current_company: "Accenture",
    primary_module: "FICO",
    country: "Malaysia",
    years: 8,
    raw_text: "Alicia Tan is an SAP FICO consultant at Accenture. 8 years SAP delivery. Led 2 implementation projects and 1 S/4HANA implementation.",
    implementation_projects: 2,
    s4hana_projects: 1,
    ...overrides,
  };
}

let zeroFailed = false;
try {
  auditCandidates([]);
} catch (error) {
  zeroFailed = error instanceof Error && error.message.includes("0 candidates loaded");
}
assert(zeroFailed, "Audit must fail when 0 candidates are loaded");

const invalidName = auditCandidates([cleanCandidate({ id: "bad-name", name: "Current Location", email: "bad-name@example.com" })]);
assert(invalidName.categories.invalidNames > 0, "Invalid section-header names must be flagged");

const fakeEmployer = auditCandidates([cleanCandidate({ id: "fake-employer", email: "fake@example.com", current_company: "Technology Consulting", raw_text: "SAP FICO consultant profile with implementation delivery." })]);
assert(fakeEmployer.categories.fakeEmployerSuspects === 1, "Fake employer must be flagged");
assert(fakeEmployer.categories.missingEmployer === 0, "Fake employer must be separate from missing employer");

const missingEmployer = auditCandidates([cleanCandidate({ id: "missing-employer", email: "missing@example.com", current_company: "", company: "", raw_text: "Alicia Tan is an SAP FICO consultant. 8 years SAP delivery." })]);
assert(missingEmployer.categories.missingEmployer === 1, "Missing employer must be flagged separately");
assert(missingEmployer.categories.fakeEmployerSuspects === 0, "Missing employer must not be counted as fake employer");

const invalidCompanyType = auditCandidates([cleanCandidate({ id: "bad-company-type", email: "bad-company-type@example.com", company_type: "Systems Integrator" })]);
assert(invalidCompanyType.categories.invalidCompanyType === 1, "Company type must only allow Consulting Firm / In-house / Not disclosed");

const invalidBackground = auditCandidates([cleanCandidate({ id: "bad-background", email: "bad-background@example.com", background: "Systems Integrator" })]);
assert(invalidBackground.categories.invalidBackground === 1, "Background must only allow Consulting Firm / In-house / Mixed (Consulting Firm + In-house) / Not disclosed");

const weakNameSameContext = auditCandidates([
  cleanCandidate({ id: "weak-a", name: "Syed S", email: "weak-a@example.com", phone: "+60111111111", country: "Malaysia", primary_module: "FICO", current_company: "Accenture" }),
  cleanCandidate({ id: "weak-b", name: "Syed S", email: "weak-b@example.com", phone: "+60222222222", country: "Malaysia", primary_module: "FICO", current_company: "Deloitte" }),
]);
assert(weakNameSameContext.categories.duplicateGroups === 0, "Short/common same name + country/module alone must not create duplicate groups");

const moduleEmployer = auditCandidates([cleanCandidate({ id: "module-employer", email: "module-employer@example.com", current_company: "PP & MM module", company: "PP & MM module", raw_text: "Alicia Tan is an SAP FICO consultant. 8 years SAP delivery." })]);
assert(moduleEmployer.categories.fakeEmployerSuspects === 0, "SAP module strings must not be classified as fake employers");
assert(moduleEmployer.categories.missingEmployer === 1, "SAP module strings should sanitize to missing employer");

const duplicates = auditCandidates([
  cleanCandidate({ id: "dup-a", name: "Binh Ly", email: "binh-a@example.com", phone: "+84901234567", country: "Vietnam", primary_module: "MM" }),
  cleanCandidate({ id: "dup-b", name: "Binh L Y", email: "binh-b@example.com", phone: "+84901234567", country: "Vietnam", primary_module: "MM" }),
]);
assert(duplicates.categories.duplicateGroups > 0, "Duplicate candidate identities must be detected");


const reviewPlaceholder = auditCandidates([cleanCandidate({
  id: "review-placeholder",
  name: "Profile Under Review",
  email: "review-placeholder@example.com",
  raw_text: "CANDIDATE INFORMATION Full Name: Nur Aisyah Rahman Year of birth: 1988 Gender: Female WORKING EXPERIENCE Jan 2020 - Present Accenture SAP FICO Consultant",
})]);
assert(reviewPlaceholder.categories.invalidNames === 0, "Recovered blob Full Name should not be counted as invalid-name");
assert(reviewPlaceholder.clientExportEligible === 0, "Profile Under Review placeholder must block client export eligibility");
assert(reviewPlaceholder.categories.exportBlocked === 1, "Export-blocked count must include review placeholder profiles");

const defaultMetricsCleaned = auditCandidates([cleanCandidate({
  id: "default-metrics",
  email: "default-metrics@example.com",
  implementationProjects: 1,
  rolloutProjects: 1,
  amsProjects: 1,
  s4hanaProjects: 1,
  raw_text: "Alicia Tan is an SAP FICO consultant at Accenture. SAP delivery profile with implementation, rollout, AMS and S/4HANA keywords but no numeric project evidence.",
})]);
assert(defaultMetricsCleaned.categories.deliveryMetricAnomalies === 0, "Canonical metric cleanup should remove default numeric counts before audit anomalies are calculated");

const blockedPlaceholderInvalidName = auditCandidates([cleanCandidate({
  id: "blocked-invalid-name",
  name: "Profile Under Review",
  email: "blocked-invalid-name@example.com",
  raw_text: "SAP FICO consultant profile with identity pending validation.",
})]);
const blockedInvalidNameIssue = blockedPlaceholderInvalidName.issues.find((issue) => issue.type === "invalid-name");
assert(blockedInvalidNameIssue?.severity === "review", "Blocked placeholder invalid name should be review, not critical");
assert(blockedPlaceholderInvalidName.clientExportEligible === 0, "Blocked placeholder invalid name must not be export eligible");

const exportEligibleInvalidName = auditCandidates([cleanCandidate({ id: "export-invalid-name", name: "Gender", fullName: "Alicia Tan", email: "export-invalid-name@example.com" })]);
const exportInvalidNameIssue = exportEligibleInvalidName.issues.find((issue) => issue.type === "invalid-name");
assert(exportInvalidNameIssue?.severity === "review", "Invalid name should be review after it is excluded from final export eligibility");
assert(exportEligibleInvalidName.clientExportEligible === 0, "Invalid-name blocker must be excluded from export eligible count");

const blockedMissingEmployer = auditCandidates([cleanCandidate({
  id: "blocked-missing-employer",
  name: "Profile Under Review",
  email: "blocked-missing-employer@example.com",
  current_company: "",
  company: "",
  raw_text: "SAP FICO consultant profile with identity pending validation.",
})]);
const blockedMissingEmployerIssue = blockedMissingEmployer.issues.find((issue) => issue.type === "missing-employer");
assert(blockedMissingEmployerIssue?.severity === "review", "Blocked missing employer should be review, not critical");
assert(blockedMissingEmployer.clientExportEligible === 0, "Blocked missing employer candidate must not be export eligible");

const exportEligibleMissingEmployer = auditCandidates([cleanCandidate({
  id: "export-missing-employer",
  email: "export-missing-employer@example.com",
  current_company: "",
  company: "",
  raw_text: "Alicia Tan is an SAP FICO consultant. 8 years SAP delivery.",
})]);
const exportMissingEmployerIssue = exportEligibleMissingEmployer.issues.find((issue) => issue.type === "missing-employer");
assert(exportMissingEmployerIssue?.severity === "review", "Missing employer should be review after it is excluded from final export eligibility");
assert(exportEligibleMissingEmployer.clientExportEligible === 0, "Missing employer blocker must be excluded from export eligible count");

const mixedExportEligibility = auditCandidates([
  cleanCandidate({ id: "mixed-clean", name: "Brenda Lee", email: "mixed-clean@example.com", phone: "+60111111111" }),
  cleanCandidate({ id: "mixed-invalid", name: "Gender", fullName: "Alicia Tan", email: "mixed-invalid@example.com", phone: "+60222222222" }),
  cleanCandidate({ id: "mixed-missing-employer", name: "Cindy Lim", email: "mixed-missing-employer@example.com", phone: "+60333333333", current_company: "", company: "", raw_text: "Cindy Lim is an SAP FICO consultant. 8 years SAP delivery." }),
]);
assert(mixedExportEligibility.clientExportEligible === 1, "Export eligible count must exclude all critical blockers");
assert(mixedExportEligibility.issues.filter((issue) => issue.severity === "critical").length === 0, "No critical issues should remain when all blockers are export-blocked");
const mixedInvalidIssue = mixedExportEligibility.issues.find((issue) => issue.candidateId === "mixed-invalid" && issue.type === "invalid-name");
assert(mixedInvalidIssue?.isClientExportEligible === false && mixedInvalidIssue?.exportBlocked === true, "Blocked issue should include export state metadata");


const clean = auditCandidates([cleanCandidate()]);
assert(clean.issues.length === 0, `Clean candidate data should pass without issues, got ${clean.issues.map((issue) => issue.type).join(", ")}`);
assert(clean.passed === 1, "Clean candidate should be counted as passed");

console.log("Candidate audit tests passed");



