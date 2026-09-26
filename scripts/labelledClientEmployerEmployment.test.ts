import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume } from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const rows = extractCanonicalEmploymentFromResume(
  "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer (Retail) COMPANY: Example Consulting GROUP ROLE Candidate was assigned as a Senior Consultant (SAP MM) RESPONSIBILITIES Led delivery. " +
    "DURATION: OCT/19 TO APR/20 CLIENT: Example Energy COMPANY: Example Technical ROLE Candidate was assigned as a SAP MM Functional Consultant RESPONSIBILITIES Configured SAP. " +
    "DURATION: AUG/10 TO SEP/12 CLIENT: Example Supplier COMPANY: Example Manufacturing ROLE Clerk of Work RESPONSIBILITIES Documented construction. " +
    "DURATION: MAY/06 JULY/10 CLIENT: Example Buyer COMPANY: Example Group ROLE Sales Engineer RESPONSIBILITIES Sold products. PROJECT SUMMARY " +
    "DURATION: JAN/20 TO FEB/20 CLIENT: Example Client COMPANY: Example Project ROLE SAP Consultant RESPONSIBILITIES Project detail.",
);
assert.deepEqual(
  rows.map(({ company, title, start, end, current }) => ({
    company, title, start, end, current,
  })),
  [
    { company: "Example Consulting GROUP", title: "Senior Consultant (SAP MM)", start: "FEB 2025", end: "Present", current: true },
    { company: "Example Technical", title: "SAP MM Functional Consultant", start: "OCT 2019", end: "APR 2020", current: false },
    { company: "Example Manufacturing", title: "Clerk of Work", start: "AUG 2010", end: "SEP 2012", current: false },
  ],
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "PROJECT EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer COMPANY: Example Supplier ROLE SAP Consultant RESPONSIBILITIES Project work.",
  ).length,
  0,
  "A project-only table cannot supply employment",
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer ROLE SAP Consultant RESPONSIBILITIES Project work.",
  ).length,
  0,
  "The client is never used as a fallback employer",
);
assert.equal(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: FEB/25 TILL DATE CLIENT: Example Buyer COMPANY: Example Consulting ROLE SAP Consultant RESPONSIBILITIES Owns project. DURATION: MAY/26 TO APR/26 CLIENT: Example Other COMPANY: Example Group ROLE Analyst RESPONSIBILITIES Invalid date.",
  ).length,
  1,
  "The second row cannot donate its role or reverse-date range to the first",
);
assert.deepEqual(
  extractCanonicalEmploymentFromResume(
    "WORK EXPERIENCE DURATION: JAN/21 TO MAR/21 CLIENT: Example Buyer " +
      "DURATION: APR/21 TO MAY/21 CLIENT: Example Supplier COMPANY: Example Consultancy " +
      "ROLE SAP Consultant RESPONSIBILITIES Implemented SAP.",
  ).map(({ company, start, end }) => ({ company, start, end })),
  [{ company: "Example Consultancy", start: "APR 2021", end: "MAY 2021" }],
  "A missing Company in one row must never borrow the next row's employer",
);
console.log("Labelled client/employer employment boundaries: passed");

const projectLedger = normalizeActualCandidateSchema({
  raw_text: "PROJECT EXPERIENCE Company: Example Advisory Customer: Example Retail Industry: Retail " +
    "Project: SAP ECC Support Duration: Feb 2018 to Aug 2018 Role: SAP MM Consultant " +
    "Responsibilities: Configured procurement. " +
    "Company: Example Advisory Customer: Example Energy Project: SAP Rollout " +
    "Role: SAP MM Consultant Duration: Oct 2018 to Dec 2019 Responsibilities: Rolled out SAP. " +
    "Company: Example Buyer Project: SAP upgrade Duration: Jan 2020 to Feb 2020 Role: SAP MM Consultant " +
    "References Company: Example Personal Customer: Example Friends Project: Home renovation " +
    "Duration: Jan 2021 to Feb 2021 Role: Project Manager",
});
assert.equal(projectLedger.enterpriseProfile.employmentTimeline.length, 1);
assert.deepEqual(projectLedger.enterpriseProfile.employmentTimeline.map(({ company, title, start, end, estimatedTenure }) => ({
  company, title, start, end,
  estimatedStart: estimatedTenure?.start, estimatedEnd: estimatedTenure?.end,
  basis: estimatedTenure?.basis,
})), [{ company: "Example Advisory", title: "SAP MM Consultant", start: "", end: "",
  estimatedStart: "Feb 2018", estimatedEnd: "Dec 2019", basis: "project_envelope" }]);
assert.equal(projectLedger.enterpriseProfile.projects.length, 2);
assert.deepEqual(projectLedger.enterpriseProfile.projects.map(({ client, employer }) => ({ client, employer })), [
  { client: "Example Energy", employer: "Example Advisory" },
  { client: "Example Retail", employer: "Example Advisory" },
]);
assert.ok((projectLedger.enterpriseProfile.experienceSummary.sapExperienceYears || 0) > 1,
  "SAP project work counts the supported continuous period at one employer, including the internal gap");

const stages = normalizeActualCandidateSchema({ raw_text:
  "Employment History Employer: Example Consulting Ltd Project: SAP Finance Upgrade " +
  "End-Client: Example Treasury Project Role: SAP FICO Consultant " +
  "Development Stage: 27.07.2015 – 31.12.2017 Support Stage: 01.01.2018 – Present " +
  "Modules: FICO Responsibilities: Configured ledger. REFERENCES Employer: Example Mentor Ltd " +
  "Project: SAP Upgrade End-Client: Example Personal Project Role: SAP Consultant " +
  "Development Stage: 01.01.2020 – 31.01.2020 Support Stage: 01.02.2020 – Present",
});
assert.deepEqual(stages.enterpriseProfile.employmentTimeline.map(({ company, title, start, end, estimatedTenure }) => ({
  company, title, start, end, basis: estimatedTenure?.basis,
})), [{ company: "Example Consulting Ltd", title: "SAP FICO Consultant", start: "", end: "", basis: "project_envelope" }]);
assert.equal(stages.enterpriseProfile.projects.length, 1);

const clientOnly = normalizeActualCandidateSchema({ raw_text:
  "PROJECT EXPERIENCE Customer: Example Buyer Project: SAP Rollout Duration: Jan 2020 to Dec 2020 " +
  "Role: SAP Consultant Responsibilities: Supported buyer." });
assert.equal(clientOnly.enterpriseProfile.employmentTimeline.length, 0);
assert.equal(normalizeActualCandidateSchema({ raw_text:
  "PROJECT EXPERIENCE Company: Example Buyer Customer: Example Buyer Project: SAP Rollout " +
  "Duration: Jan 2020 to Dec 2020 Role: SAP Consultant" }).enterpriseProfile.employmentTimeline.length, 0);
assert.equal(normalizeActualCandidateSchema({ raw_text:
  "PROJECT EXPERIENCE Company: Example Advisory Customer: Example Buyer Project: SAP Rollout " +
  "Duration: Dec 2020 to Jan 2020 Role: SAP Consultant" }).enterpriseProfile.employmentTimeline.length, 0);
assert.equal(normalizeActualCandidateSchema({ raw_text:
  "Employment History Employer: Example Consulting Ltd Project: SAP Upgrade End-Client: Example Treasury " +
  "Project Role: SAP Consultant Development Stage: 31.12.2017 – 01.01.2015 " +
  "Support Stage: 01.01.2018 – Present" }).enterpriseProfile.employmentTimeline.length, 0);
const operational = normalizeActualCandidateSchema({ raw_text:
  "PROJECT EXPERIENCE Company: Example Distributor Customer: Example Buyer Project: SAP Licensing " +
  "Duration: Jan 2019 to Dec 2020 Role: Sales Manager Responsibilities: Sold SAP licenses." });
assert.equal(operational.enterpriseProfile.experienceSummary.sapExperienceYears || 0, 0,
  "A non-SAP sales job cannot add SAP delivery experience from a project name");
console.log("Owned project ledger estimates and negative boundaries: passed");
