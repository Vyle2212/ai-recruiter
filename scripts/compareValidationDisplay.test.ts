import {
  clientReadyCompareCandidates,
  isCompareVisibleCandidate,
  normalizeCompareCandidate,
  rankCompareCandidates,
} from "../lib/candidateCompareEngine";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function readyCandidate(overrides: Record<string, any> = {}) {
  return {
    id: "compare-ready-1",
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

const ready = normalizeCompareCandidate(readyCandidate());
assert(ready.name === "Alicia Tan", `Ready candidate should display normal name, got ${ready.name}`);
assert(ready.company === "Accenture", `Ready candidate should display current company, got ${ready.company}`);
assert(ready.validation.badge === "Ready", `Ready candidate should carry Ready badge, got ${ready.validation.badge}`);
assert(ready.validation.exportEligible === true, "Ready candidate should be client export eligible");

const invalidName = normalizeCompareCandidate(readyCandidate({
  id: "compare-invalid-name",
  name: "Profile Under Review",
  email: "compare-invalid-name@example.com",
  raw_text: "SAP FICO consultant profile with identity pending recruiter validation.",
  validation_status: "Ready",
}));
assert(invalidName.name === "Candidate profile pending validation", `Invalid raw name must not appear in Compare, got ${invalidName.name}`);
assert(invalidName.name !== "Profile Under Review", "Compare must not display Profile Under Review as a candidate name");
assert(invalidName.validation.badge !== "Ready", "Invalid-name candidate should not be marked Ready for Compare export");

const missingEmployer = normalizeCompareCandidate(readyCandidate({
  id: "compare-missing-employer",
  name: "Brenda Lee",
  email: "brenda.lee@example.com",
  current_company: "SAP SD",
  company: "MM module",
  raw_text: "Brenda Lee is an SAP SD consultant. Employer pending recruiter validation.",
  validation_status: "Ready",
}));
assert(missingEmployer.company === "Not disclosed", `Missing or skill-like company should show Not disclosed, got ${missingEmployer.company}`);
assert(missingEmployer.validation.badge === "Needs Review", `Non-ready export blocker should show Needs Review badge, got ${missingEmployer.validation.badge}`);
assert(missingEmployer.validation.exportEligible === false, "Missing employer must block client export eligibility");

const hidden = normalizeCompareCandidate(readyCandidate({ id: "compare-hidden", name: "Hidden Candidate", email: "hidden@example.com", validation_status: "Hidden" }));
const archived = normalizeCompareCandidate(readyCandidate({ id: "compare-archived", name: "Archived Candidate", email: "archived@example.com", validation_status: "Archived" }));
assert(isCompareVisibleCandidate(hidden) === false, "Hidden candidate should be excluded from Compare visibility");
assert(isCompareVisibleCandidate(archived) === false, "Archived candidate should be excluded from Compare visibility");
const ranked = rankCompareCandidates([ready, hidden, archived, missingEmployer]);
assert(ranked.every((candidate) => candidate.id !== "compare-hidden" && candidate.id !== "compare-archived"), "Ranked Compare slate must exclude Hidden/Archived candidates");
assert(ranked.some((candidate) => candidate.id === "compare-missing-employer"), "Non-ready visible candidates should remain internally comparable");

const clientReady = clientReadyCompareCandidates([ready, missingEmployer, invalidName]);
assert(clientReady.length === 1 && clientReady[0].id === ready.id, "Client-facing Compare exports should include Ready/export-eligible candidates only");

console.log("Compare validation display tests passed");
