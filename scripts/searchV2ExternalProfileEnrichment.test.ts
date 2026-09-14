import assert from "node:assert/strict";
import fs from "node:fs";

import { buildExternalCanonicalProfileOverview } from "../lib/candidateProfileOverview";
import {
  buildExternalTalentProfilePresentation,
  calculateCanonicalExternalExperience,
  normalizeExternalEmploymentRecords,
} from "../lib/externalTalentProfile";

const now = new Date("2026-09-12T00:00:00.000Z");
const employmentRecords = normalizeExternalEmploymentRecords(
  [
    {
      title: "Senior SAP FICO Consultant",
      company: { name: "Verified Consulting Sdn Bhd" },
      startDate: "2022-01",
      endDate: "Present",
    },
  ],
  "External Candidate",
  now,
);
const externalProfile = buildExternalTalentProfilePresentation({
  profileTitle: "Senior SAP FICO Consultant",
  experienceSummary: "SAP finance consultant focused on S/4HANA delivery.",
  employmentRecords,
  experienceCalculation: calculateCanonicalExternalExperience(
    employmentRecords,
    now,
  ),
  projectText: ["S/4HANA finance transformation"],
  education: ["Bachelor of Accounting, University of Malaya"],
  certifications: ["SAP Certified Application Associate"],
  skills: ["SAP FICO", "S/4HANA", "General Ledger", "Accounts Payable"],
});
const overview = buildExternalCanonicalProfileOverview({
  candidateId: "external-123",
  candidateName: "External Candidate",
  profileTitle: "Senior SAP FICO Consultant",
  location: "Kuala Lumpur, Malaysia",
  externalProfile,
});
assert.equal(
  overview.career.currentEmployment?.employer,
  "Verified Consulting Sdn Bhd",
);
assert.equal(overview.career.employmentCount, 1);
assert.equal(overview.career.projectCount, 1);
assert.equal(overview.education.count, 1);
assert.equal(overview.certifications.count, 1);
assert.equal(overview.skills.totalCount, 4);
assert.equal(overview.career.experienceCalculationStatus, "partial");

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
assert.match(drawer, /Optional AI narrative unavailable/);
assert.match(drawer, /externalEmployment\.map/);
assert.match(drawer, /Not established from source|experienceCalculationStatus/);
assert.doesNotMatch(drawer, /Import candidate-provided profile/);
assert.doesNotMatch(drawer, />\s*Import profile\s*</);
const results = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(results, /Needs verification/);
assert.match(results, /result\.talentPool !== "linkedin_talent_pool"/);
assert.match(results, /previousExternalEmployment/);
assert.doesNotMatch(results, /View all experience/);
assert.match(results, /Map next market segment/);

console.log("Search V2 external profile enrichment tests passed");
