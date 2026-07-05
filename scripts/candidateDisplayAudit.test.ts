import assert from "node:assert/strict";
import { resolveCanonicalCandidateDisplay } from "../lib/candidateCanonicalDisplay";
import {
  auditCandidateDisplay,
  formatDisplayAuditReport,
  classifyDisplayNameIssue,
  isForbiddenEmployer,
  isValidDisplayHumanName,
  suggestDisplayName,
  suggestRoleTitle,
  suggestValidationStatus,
} from "../lib/candidateDisplayAudit";

assert.equal(classifyDisplayNameIssue("Bachelor In Applied Statistics"), "education-used-as-name", "education title must not be accepted as candidate name");
assert.equal(classifyDisplayNameIssue("Bachelor Of Science In Information"), "education-used-as-name", "degree phrase must not be accepted as candidate name");
assert.equal(classifyDisplayNameIssue("Professional Certificate"), "certificate-used-as-name", "certificate must not be accepted as candidate name");
assert.equal(classifyDisplayNameIssue("Epicor Software"), "company-used-as-name", "company phrase must not be accepted as candidate name");
assert.equal(classifyDisplayNameIssue("Key Competencies"), "title-used-as-name", "section header must not be accepted as candidate name");
assert.equal(classifyDisplayNameIssue("Candidate profile pending validation"), "", "safe placeholder should not be an invalid display-name classification");
assert.equal(classifyDisplayNameIssue("Candidate Profile Pending Validation"), "", "safe placeholder casing variant should not be invalid display-name classification");
for (const badName of ["Extended Star Schema Models", "Installation Status", "Strictly Confidential", "For Mechanical Turnkey Projects", "Willing To Travel", "Each Type", "And Need For Resources", "Light Mechanics Roles", "Dxc Technology", "Accenture", "Abeam Consulting", "Currently Supporting", "Experience Summary", "Tools Used", "Responsibilities Include", "Project Experience", "With Integration Team", "And Support Team"]) {
  assert.equal(isValidDisplayHumanName(badName), false, badName + " must not be treated as a display-safe human name");
  assert.equal(suggestDisplayName({ name: badName }).value, "Candidate profile pending validation", badName + " must fall back to safe placeholder");
}
assert.equal(isValidDisplayHumanName("Aina Rahman"), true, "real two-part human name should pass display name validation");

for (const employer of ["SAP", "FICO", "MM", "SD", "ABAP", "BASIS", "S/4HANA", "Greenfield", "Brownfield", "Rollout", "AMS", "Implementation", "Migration", "Transformation"]) {
  assert.equal(isForbiddenEmployer(employer), true, `${employer} must not be accepted as employer`);
}
assert.equal(isForbiddenEmployer("Accenture Malaysia"), false, "real company should be accepted as employer");
for (const fakeEmployer of ["Business Process", "Petronas based in", "From Date To Date", "towards improving its", "Menara TM, Jalan Pantai Baharu"]) {
  assert.equal(resolveCanonicalCandidateDisplay({ name: "Aina Rahman", currentCompany: fakeEmployer, email: "a@example.com", title: "SAP FICO Consultant" }).currentEmployer, "Not disclosed", fakeEmployer + " must not be displayed as current employer");
}

assert.equal(suggestRoleTitle({ primary_module: "FICO" }).value, "SAP FICO Consultant", "module fallback role should be generated when role is missing");
assert.equal(suggestRoleTitle({ title: "Employment SAP PS Solutions Consultant (", primary_module: "PS" }).value, "SAP PS Solutions Consultant", "role cleanup should remove Employment prefix and dangling punctuation");
assert.equal(suggestRoleTitle({ title: "SAP SAP UNKNOWN Consultant -", primary_module: "FICO" }).value, "SAP FICO Consultant", "role cleanup should repair SAP SAP and UNKNOWN artifacts through module fallback");

assert.equal(suggestValidationStatus({ name: "Candidate profile pending validation", employer: "Accenture", role: "SAP FICO Consultant", candidate: { email: "a@example.com" }, confidence: 90 }), "Missing Information", "placeholder cannot be Ready");
assert.equal(suggestValidationStatus({ name: "Aina Rahman", employer: "Not disclosed", role: "SAP FICO Consultant", candidate: { email: "a@example.com" }, confidence: 90 }), "Missing Information", "missing employer cannot be Ready");
assert.equal(suggestValidationStatus({ name: "Aina Rahman", employer: "Accenture", role: "SAP FICO Consultant", candidate: { email: "a@example.com" }, confidence: 90 }), "Ready", "valid display data can be Ready");
assert.equal(suggestValidationStatus({ name: "Aina Rahman", employer: "Accenture", role: "SAP FICO Consultant", candidate: { email: "a@example.com" }, confidence: 90, nameConfidence: 70 }), "Needs Review", "low-confidence name source cannot suggest Ready");
assert.equal(suggestValidationStatus({ name: "Aina Rahman", employer: "Accenture", role: "SAP FICO Consultant", candidate: { email: "a@example.com" }, confidence: 90, employerSource: "raw resume text" }), "Needs Review", "raw text employer source cannot suggest Ready");
assert.equal(suggestValidationStatus({ name: "Aina Rahman", employer: "Accenture", role: "SAP FICO Consultant -", candidate: { email: "a@example.com" }, confidence: 90 }), "Needs Review", "title artifact cannot suggest Ready");

const trustedCurrentCompany = resolveCanonicalCandidateDisplay({ name: "Aina Rahman", currentCompany: "Accenture Malaysia", email: "a@example.com", title: "SAP FICO Consultant" });
assert.equal(trustedCurrentCompany.currentEmployer, "Accenture Malaysia", "display resolver should use trusted currentCompany");

const trustedCurrentEmployer = resolveCanonicalCandidateDisplay({ name: "Aina Rahman", currentEmployer: "Deloitte", email: "a@example.com", title: "SAP FICO Consultant" });
assert.equal(trustedCurrentEmployer.currentEmployer, "Deloitte", "display resolver should use trusted currentEmployer");

const structuredExperience = resolveCanonicalCandidateDisplay({ name: "Aina Rahman", email: "a@example.com", title: "SAP FICO Consultant", workExperience: [{ company: "DXC Technology", title: "SAP Consultant" }] });
assert.equal(structuredExperience.currentEmployer, "DXC Technology", "display resolver should use latest structured experience company");

const rejectedModuleEmployer = resolveCanonicalCandidateDisplay({ name: "Aina Rahman", currentCompany: "SAP", email: "a@example.com", title: "SAP FICO Consultant" });
assert.equal(rejectedModuleEmployer.currentEmployer, "Not disclosed", "display resolver should reject SAP/module employer");
const missingEmployerResolution = resolveCanonicalCandidateDisplay({ name: "Aina Rahman", currentCompany: "SAP", employer: "MM module", email: "a@example.com", title: "SAP FICO Consultant" });
assert.equal(missingEmployerResolution.currentEmployer, "Not disclosed", "missing employer should remain Not disclosed when no trusted source exists");
const badCanonicalName = resolveCanonicalCandidateDisplay({ name: "Extended Star Schema Models", email: "a@example.com", currentCompany: "Accenture", title: "SAP FICO Consultant", validation_status: "Ready" });
assert.equal(badCanonicalName.displayName, "Candidate profile pending validation", "resolver must not expose bad canonical names");
assert.equal(badCanonicalName.validationStatus, "Missing Information", "safe placeholder cannot display Ready");

const reviewAudit = auditCandidateDisplay([{ id: "safe-1", name: "Profile Under Review", current_company: "Not disclosed", title: "SAP FICO Consultant", primary_module: "FICO", email: "safe@example.com", validation_status: "Needs Review" }]);
assert.equal(reviewAudit.criticalIssueCount, 0, "safe placeholder review profile should not be critical");
assert.equal(Boolean(reviewAudit.issueCounts["invalid-name"]), false, "safe placeholder should not be counted as invalid-name");
assert.equal(reviewAudit.issueCounts["placeholder-name"] >= 1, true, "safe placeholder should be counted as review issue");
assert.equal(reviewAudit.issues.some((issue) => issue.issue === "placeholder-name" && issue.severity === "review"), true, "placeholder should be review severity");

const employerAuditInput = [{ id: "employer-1", name: "Aina Rahman", email: "a@example.com", title: "SAP FICO Consultant", workExperience: [{ company: "Accenture Malaysia" }] }];
const employerAudit = auditCandidateDisplay(employerAuditInput);
assert.equal(Boolean(employerAudit.issueCounts["missing-current-employer"]), false, "display audit should not report missing employer when canonical resolver finds structured employer");
const deterministicA = auditCandidateDisplay(employerAuditInput);
const deterministicB = auditCandidateDisplay(employerAuditInput);
assert.deepEqual(deterministicA.issueCounts, deterministicB.issueCounts, "audit display output should be deterministic for the same input");
assert.equal(deterministicA.totalDisplayIssues, deterministicB.totalDisplayIssues, "audit display run twice should produce the same issue count");
assert.equal(formatDisplayAuditReport(deterministicA), formatDisplayAuditReport(deterministicB), "formatted audit display output should be deterministic");

console.log("Candidate display audit tests passed");
