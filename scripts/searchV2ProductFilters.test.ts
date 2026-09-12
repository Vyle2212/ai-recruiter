import assert from "node:assert/strict";
import { candidatePassesSearchV2Filters } from "../lib/candidateSearchV2Filters";
import { normalizeCandidateSearchV2Request } from "../lib/candidateSearchV2Request";
import { emptyFilterDrafts, validateAndCommitFilterDrafts } from "../lib/searchV2ReviewState";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";

const candidate: CandidateSearchV2Document = {
  candidateId: "candidate-filter-product",
  candidateName: "Alex Tan",
  currentTitle: "Senior SAP FICO Consultant",
  historicalTitles: ["Finance Systems Analyst"],
  currentEmployer: "Acme Consulting",
  country: "Malaysia",
  location: "Kuala Lumpur",
  totalYearsExperience: 12,
  relevantYearsExperience: 8,
  skills: ["SAP FICO", "S/4HANA"],
  industries: ["Manufacturing"],
  languages: ["English"],
  noticePeriodDays: 30,
  salaryExpectation: 14000,
  workAuthorization: ["Malaysia citizen"],
  workflowStatus: "screened",
  qualityStatus: "verified",
  evidence: [
    { label: "Education", value: "Bachelor of Finance" },
    { label: "Certification", value: "SAP S/4HANA Financial Accounting" },
  ],
  trustedCandidateEvidence: {
    candidateId: "candidate-filter-product",
    values: [{
      value: "English - fluent professional proficiency",
      sourceType: "raw_professional_text",
      sourceField: "candidates.raw_text",
      sourceRecordId: "candidate-filter-product",
      provenance: "candidate_record_raw",
      trusted: true,
    }],
  },
};

const drafts = validateAndCommitFilterDrafts({
  ...emptyFilterDrafts(),
  general: "Name: Alex Tan, Finance Systems Analyst",
  location: "Malaysia",
  experience: "10+ years",
  relevantExperience: "5-10 years",
  education: "Bachelor",
  certifications: "Financial Accounting",
  languages: "English: fluent",
  availability: "Notice: 30, Salary: 15000",
  authorization: "Malaysia citizen",
  status: "Workflow: screened, Quality: verified",
});
assert.equal(drafts.valid, true);
assert.equal(
  candidatePassesSearchV2Filters(
    candidate,
    normalizeCandidateSearchV2Request({ query: "SAP FICO", filters: drafts.filters }),
  ),
  true,
);

for (const filters of [
  { candidateNames: ["someone else"] },
  { anyTitles: ["ABAP Developer"] },
  { locations: ["Singapore"] },
  { minimumRelevantYearsExperience: 9 },
  { maximumNoticePeriodDays: 20 },
  { maximumExpectedSalary: 12000 },
  { education: ["Master of Science"] },
  { certifications: ["PMP"] },
  { workAuthorization: ["Singapore citizen"] },
  { workflowStatuses: ["rejected"] },
  { qualityStatuses: ["incomplete"] },
  { exclusions: ["Acme Consulting"] },
  { languages: ["English"], languageProficiencies: { English: "native" } },
]) {
  assert.equal(
    candidatePassesSearchV2Filters(
      candidate,
      normalizeCandidateSearchV2Request({ query: "SAP FICO", filters }),
    ),
    false,
    JSON.stringify(filters),
  );
}

console.log("Search V2 product filter tests passed");
