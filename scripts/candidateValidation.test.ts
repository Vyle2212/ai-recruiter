import { applyCandidateValidationAction, buildCandidateValidationState, serializeCandidateValidationState } from "../lib/candidateValidation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function cleanCandidate(overrides: Record<string, any> = {}) {
  return {
    id: "validation-clean-1",
    name: "Alicia Tan",
    email: "alicia.tan@example.com",
    phone: "+60123456789",
    linkedin: "https://linkedin.com/in/alicia-tan",
    current_company: "Accenture",
    previous_company: "Deloitte",
    primary_module: "FICO",
    country: "Malaysia",
    industry: "Manufacturing",
    years: 8,
    parser_quality_score: 95,
    validation_name_approved: true,
    validation_employer_approved: true,
    validation_sap_years_approved: true,
    validation_status: "Ready",
    raw_text: "Alicia Tan is an SAP FICO consultant at Accenture. 8 years SAP delivery. Led S/4HANA implementation work for manufacturing clients.",
    ...overrides,
  };
}

const clean = buildCandidateValidationState(cleanCandidate());
assert(clean.status === "Ready", `Clean validation status should be Ready, got ${clean.status}`);
assert(clean.score >= clean.threshold, `Clean validation score should meet threshold, got ${clean.score}`);
assert(clean.exportEligible === true, `Clean candidate should be export eligible, blockers: ${clean.blockingReasons.join(", ")}`);

const missingEmployer = buildCandidateValidationState(cleanCandidate({ current_company: "", company: "", raw_text: "SAP FICO consultant profile with delivery background. Employer pending recruiter validation.", validation_status: "Ready" }));
assert(missingEmployer.flags.employerMissing === true, "Missing employer should be flagged");
assert(missingEmployer.exportEligible === false, "Missing employer must block export eligibility");
assert(missingEmployer.blockingReasons.includes("Missing employer"), "Missing employer blocker should be explicit");

const invalidName = buildCandidateValidationState(cleanCandidate({ name: "Profile Under Review", raw_text: "SAP FICO consultant profile with identity pending recruiter validation.", validation_status: "Ready" }));
assert(invalidName.flags.invalidName === true, "Placeholder/review names should be invalid");
assert(invalidName.exportEligible === false, "Invalid name must block export eligibility");

const missingCriticalIdentity = buildCandidateValidationState(cleanCandidate({ email: "", phone: "", linkedin: "", validation_status: "Ready" }));
assert(missingCriticalIdentity.exportEligible === false, "Missing critical identity must block export eligibility");
assert(missingCriticalIdentity.blockingReasons.includes("Missing critical identity"), "Missing critical identity blocker should be explicit");

const invalidSapYears = buildCandidateValidationState(cleanCandidate({ years: 50, raw_text: "Alicia Tan is an SAP FICO consultant at Accenture. SAP delivery profile.", validation_status: "Ready" }));
assert(invalidSapYears.exportEligible === false, "Invalid SAP years must block export eligibility");
assert(invalidSapYears.blockingReasons.includes("Invalid SAP years"), "Invalid SAP years blocker should be explicit");

const duplicate = buildCandidateValidationState(cleanCandidate({ duplicate_suspected: true, validation_status: "Ready" }));
assert(duplicate.flags.duplicateSuspected === true, "Duplicate suspected should be flagged");
assert(duplicate.exportEligible === false, "Duplicate suspected must block export eligibility");

const hidden = buildCandidateValidationState(cleanCandidate({ validation_status: "Hidden" }));
assert(hidden.status === "Hidden", "Hidden validation status should be preserved");
assert(hidden.exportEligible === false, "Hidden candidates must not be export eligible");

const correctedName = applyCandidateValidationAction(invalidName, "correct-name", {
  value: "Alicia Tan",
  reason: "Verified against resume header",
  user: "qa-recruiter",
  timestamp: "2026-07-04T00:00:00.000Z",
});
assert(correctedName.corrections.name === "Alicia Tan", "Correct name action should store corrected name");
assert(correctedName.approved.name === true, "Correct name action should approve name");
assert(correctedName.history.length === invalidName.history.length + 1, "Correct name action should append history");
assert(correctedName.history.at(-1)?.oldValue === "", "History should record old correction value");
assert(correctedName.history.at(-1)?.newValue === "Alicia Tan", "History should record new correction value");
assert(correctedName.history.at(-1)?.reason === "Verified against resume header", "History should record reason");

const markedReady = applyCandidateValidationAction(missingEmployer, "mark-ready", {
  reason: "Recruiter confirmed blockers resolved",
  user: "qa-recruiter",
});
assert(markedReady.status === "Ready", "Mark Ready action should transition status to Ready");
assert(markedReady.history.at(-1)?.field === "status", "Status transition should be logged");

const serialized = serializeCandidateValidationState(correctedName);
const recomputed = buildCandidateValidationState({
  ...cleanCandidate({ name: "Profile Under Review", raw_text: "SAP FICO consultant profile with identity pending recruiter validation.", validation_status: "Ready" }),
  validation_state: serialized,
});
assert(recomputed.checks.identity.name === true, "Serialized name correction should feed canonical validation state");

console.log("Candidate validation tests passed");

