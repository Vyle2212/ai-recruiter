import assert from "node:assert/strict";
import { headedCareerCards, reversedMonthCareerCards } from "../lib/headedCareerCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { ownedProjectCareerLedger } from "../lib/ownedProjectCareerLedger";
import { labelledCompanySpells } from "../lib/labelledCompanySpells";

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

const reversed = "Employment History Example Wellness Clinic – 2018 February to present Chiropractor Adjusting patients. " +
  "Another Health Centre – 2017 April to 2018 January Chiropractor and Office Manager Taking x-rays. " +
  "Third Therapy Clinic - 2016 May to 2017 April Chiropractor Scheduling appointments.";
assert.deepEqual(reversedMonthCareerCards(reversed).map(({ company, title, start, end }) => ({ company, title, start, end })), [
  { company: "Example Wellness Clinic", title: "Chiropractor", start: "February 2018", end: "present" },
  { company: "Another Health Centre", title: "Chiropractor and Office Manager", start: "April 2017", end: "January 2018" },
  { company: "Third Therapy Clinic", title: "Chiropractor", start: "May 2016", end: "April 2017" },
]);
assert.equal(normalizeActualCandidateSchema({ raw_text: reversed }).enterpriseProfile.employmentTimeline.length, 3);
assert.deepEqual(reversedMonthCareerCards("Project Experience Example Client – 2018 February to present Consultant Implemented a rollout."), []);
assert.deepEqual(reversedMonthCareerCards("Employment History Example Clinic – 2018 February to 2017 January Chiropractor Adjusting patients."), []);
assert.deepEqual(reversedMonthCareerCards("Employment History Example Clinic – 2018 February to present Project: Buyer Inc – 2019 February to present Consultant Implemented a rollout."), []);

const projectLedger = "Project 2 Duration: From March 2011 to July 2011 Client: Buyer One Ltd Employer: Example Consulting Sdn Bhd Team Size: 7 Module: SAP FICO Role: SAP Application Specialist Role and Responsibility: Supported the rollout. " +
  "Project 1 Duration: From August 2011 to December 2011 Client: Buyer Two Ltd Employer: Example Consulting Sdn Bhd Team Size: 9 Module: SAP FICO Role: SAP Application Specialist Role and Responsibility: Configured the system.";
const ownedProjects = ownedProjectCareerLedger(projectLedger);
assert.equal(ownedProjects.length, 2);
assert.ok(ownedProjects.every(project => project.employer === "Example Consulting Sdn Bhd" && project.client.startsWith("Buyer")));
const projectProfile = normalizeActualCandidateSchema({ raw_text: projectLedger }).enterpriseProfile;
assert.equal(projectProfile.employmentTimeline.length, 1);
assert.equal(projectProfile.employmentTimeline[0].start, "", "project dates do not become exact employment dates");
assert.equal(projectProfile.projects.length, 2);
assert.deepEqual(ownedProjectCareerLedger("Project 1 Duration: From March 2011 to July 2011 Client: Buyer Ltd Team Size: 5 Role: SAP Consultant Role and Responsibility: Worked. Project 2 Duration: From August 2011 to December 2011 Client: Buyer Two Ltd Employer: Example Consulting Sdn Bhd Role: SAP Consultant Role and Responsibility: Worked.").map(item => item.project), ["Project 2"], "the next project's employer cannot fill a previous row");
assert.deepEqual(ownedProjectCareerLedger("Project 1 Duration: From December 2011 to March 2011 Client: Buyer Ltd Employer: Example Consulting Sdn Bhd Role: SAP Consultant Role and Responsibility: Worked."), []);

const labelled = "Work Experience SAP MM Role 1) Company Name: Example Integrator Sdn Bhd Client: Buyer A Ltd Position Title: SAP MM Support Consultant. Role: Supported the customer. From/To: 2022 April - Present 2) " +
  "Company Name: Example Manufacturing Ltd Position Title: SAP MM Consultant. Specialization: SAP MM. From/To: 2017-2022 IT Role 1) " +
  "Company Name: Example Services Sdn Bhd (Outsourcing for Buyer B) Position Title: Service Desk Analyst Provide IT support. From/To: 2010-2013";
const spells = labelledCompanySpells(labelled);
assert.deepEqual(spells.map(({ company, title, start, end }) => ({ company, title, start, end })), [
  { company: "Example Integrator Sdn Bhd", title: "SAP MM Support Consultant", start: "April 2022", end: "Present" },
  { company: "Example Manufacturing Ltd", title: "SAP MM Consultant", start: "2017", end: "2022" },
  { company: "Example Services Sdn Bhd", title: "Service Desk Analyst", start: "2010", end: "2013" },
]);
const labelledProfile = normalizeActualCandidateSchema({ raw_text: labelled }).enterpriseProfile;
assert.equal(labelledProfile.employmentTimeline.length, 3);
assert.ok((labelledProfile.experienceSummary.sapExperienceYears || 0) > 0);
assert.deepEqual(labelledCompanySpells("Work Experience Company Name: Example Integrator Ltd Position Title: SAP Consultant. Role: Supported. Company Name: Next Integrator Ltd Position Title: SAP Engineer. From/To: 2020-2022").map(row => row.title), ["SAP Engineer"], "the next card's period cannot fill the previous employer");
assert.deepEqual(labelledCompanySpells("Work Experience Project Company Name: Buyer Ltd Position Title: SAP Consultant. From/To: 2020-2022"), [], "a project company is not an employer");
assert.deepEqual(labelledCompanySpells("Work Experience Company Name: Example Integrator Ltd Position Title: SAP Consultant. From/To: 2022-2017"), []);

console.log("Heading-bound career cards and SAP-only tenure: PASS");
