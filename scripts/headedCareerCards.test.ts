import assert from "node:assert/strict";
import { headedCareerCards } from "../lib/headedCareerCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const examples = [
  [
    "WORKING EXPERIENCE Example Capital Berhad / Senior Software Tester AUGUST 2023 TO PRESENT, Metro City Payroll: Example Vendor",
    "Example Capital Berhad",
    "Senior Software Tester",
  ],
  [
    "WORK EXPERIENCE SAP FICO IT Manager Example Retail Inc. - Metro City, Exampleland – July 2024 to Present Help drive delivery.",
    "Example Retail Inc.",
    "SAP FICO IT Manager",
  ],
  [
    "Working Experiences Example Data Sdn Bhd – Master Data Analyst (Customer Master Data Analyst) Jan,2021 – Present Managed master data.",
    "Example Data Sdn Bhd",
    "Master Data Analyst (Customer Master Data Analyst)",
  ],
  [
    "WORK EXPERIENCES Example Technology – business solutions and technology services Deployment - Test Project Manager (July 2024 – Present) Job Description: Assigned to an internal program.",
    "Example Technology",
    "Test Project Manager",
  ],
  [
    "Work Experience SAP Global Platform Deployment & Optimization Lead Example Glass- 台北市 January 2023 to Present Example business is transforming.",
    "Example Glass",
    "SAP Global Platform Deployment & Optimization Lead",
  ],
  [
    "WORK EXPERIENCE Senior AnalystNov 2022 - Present Example Foods, Metro City, Exampleland · Reduced reporting errors.",
    "Example Foods",
    "Senior Analyst",
  ],
  [
    "Work Experience Example Holdings May 2020 to Present SAP Functional Consultant, Assistant Manager Liaise with the implementation team.",
    "Example Holdings",
    "SAP Functional Consultant, Assistant Manager",
  ],
  [
    "Professional Experiences Example Therapy Clinic (America) Jan 2024 – Feb 2025 Senior Speech Language Therapist Responsibilities include assessments.",
    "Example Therapy Clinic (America)",
    "Senior Speech Language Therapist",
  ],
  [
    "PROFESSIONAL EXPERIENCES Example Bank Berhad Sept 2023 – Feb 2024 Welcome to Example Commercial Bank IT Project Manager Report To: Program Director.",
    "Example Bank Berhad",
    "IT Project Manager",
  ],
] as const;

for (const [source, company, title] of examples) {
  const rows = headedCareerCards(source);
  assert.equal(rows.length, 1, source);
  assert.equal(rows[0].company, company);
  assert.equal(rows[0].title, title);
}

assert.deepEqual(
  headedCareerCards(
    "PROFESSIONAL EXPERIENCE SAP Billing Consultant Example Staffing, Example Customer Berhad, Exampleland, February 2022 - Present Conducted testing.",
  ),
  [],
  "a client legal entity between role and dates cannot be treated as a location",
);
assert.deepEqual(
  headedCareerCards(
    "PROJECT EXPERIENCE Example Customer / SAP Consultant Jan 2021 - Dec 2021 Implemented a rollout.",
  ),
  [],
  "project headings cannot create employer tenure",
);
assert.deepEqual(
  headedCareerCards(
    "WORK EXPERIENCE Abeam Consulting AMS Projects for a company Apr 2023 - Now Objective Support Service Delivery Manager and Service Desk Lead Managed support.",
  ),
  [],
  "project prose and objectives cannot become employer or title fields",
);
assert.deepEqual(
  headedCareerCards(
    "WORK EXPERIENCE Example Holding / Senior Tester Dec 2025 - Mar 2025 Managed testing.",
  ),
  [],
  "an inverted source range remains unresolved",
);

const sap = normalizeActualCandidateSchema({
  raw_text:
    "Work Experience Example Holdings May 2020 to Present SAP Functional Consultant Liaise with the implementation team.",
});
assert.equal(sap.enterpriseProfile.employmentTimeline.length, 1);
assert.ok(
  (sap.enterpriseProfile.experienceSummary.sapExperienceYears || 0) > 0,
  "an explicit SAP role contributes SAP tenure",
);
const nonSap = normalizeActualCandidateSchema({
  raw_text:
    "Professional Experiences Example Therapy Clinic Jan 2024 – Feb 2025 Senior Speech Language Therapist Responsibilities include assessments.",
});
assert.equal(nonSap.enterpriseProfile.employmentTimeline.length, 1);
assert.equal(
  nonSap.enterpriseProfile.experienceSummary.sapExperienceYears || 0,
  0,
  "a non-SAP role remains employment but never contributes SAP tenure",
);

console.log("Heading-bound career cards and SAP-only tenure: PASS");
