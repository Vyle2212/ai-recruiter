import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const cases = [
  [
    "Employment Experience EXM – Example Energy Ltd Start Date: 15th Jul 2024 End Date: Present Job Title: Senior Manager – IT SAP Report to Head of IT",
    "EXM – Example Energy Ltd",
    "Senior Manager – IT SAP",
  ],
  [
    "Work Experience Nov-2024 to Till Date Company Name: Example Solutions Sdn Bhd (Malaysia) Position SAP FI/CO Consultant Client Buyer Corporation",
    "Example Solutions Sdn Bhd (Malaysia)",
    "SAP FI/CO Consultant",
  ],
  [
    "Work Experience 1. Example Consulting SAP ISU Functional Consultant | January 2024 – February 2026 Provided SAP support",
    "Example Consulting",
    "SAP ISU Functional Consultant",
  ],
  [
    "Experience – 8+ Year in SAP Example Technologies Ltd, — SAP MM Senior Consultant August 2024 – Present SAP AMS support",
    "Example Technologies Ltd",
    "SAP MM Senior Consultant",
  ],
  [
    "Work Experience and Project Example SAP MM & Ariba Manager (June 2022 – Now) Responsible for delivery",
    "Example",
    "SAP MM & Ariba Manager",
  ],
  [
    "Work Experience Example Philippines, Inc. | Example City, PH Jul 2023 – August 2024 Senior Software Engineer Implemented SAP billing",
    "Example Philippines, Inc.",
    "Senior Software Engineer",
  ],
  [
    "Work Experience Tech Lead (Java) Example Berhad, Malaysia August 2022 – To Date Working on site",
    "Example Berhad, Malaysia",
    "Tech Lead (Java)",
  ],
  [
    "Experience Information Technology Project Manager ExampleCo December 2022 - Present Managing IT projects",
    "ExampleCo",
    "Information Technology Project Manager",
  ],
  [
    "Work Experience Duration: October 2022 till Present Senior SAP Consultant – (Contracting) Example Management Consultants Sdn. Bhd Roles & Responsibilities: delivery",
    "Example Management Consultants Sdn. Bhd",
    "Senior SAP Consultant",
  ],
  [
    "EXPERIENCE Example Consulting Cloud CX Consultant Oct 2020 - Current Project: Buyer project",
    "Example Consulting",
    "Cloud CX Consultant",
  ],
  [
    "EXPERIENCE Mar 2021 - Current Application Development Analyst Example Ph. SAP FICO Consultant for one of the employer's clients",
    "Example Ph.",
    "Application Development Analyst",
  ],
  [
    "Work Experience July 2024 - Present Business Development Manager Example International Spearhead market growth",
    "Example International",
    "Business Development Manager",
  ],
] as const;
for (const [source, company, title] of cases) {
  assert.ok(
    read(source).some((j) => j.company === company && j.title === title),
    source,
  );
  assert.ok(
    canonical(source).some(
      (j) =>
        j.company.toLowerCase() === company.toLowerCase() &&
        j.title.toLowerCase() === title.toLowerCase(),
    ),
    source,
  );
}
const numbered =
  "Employment and Achievement History Sep 2022 – Present 1. Example One Sdn Bhd Position Title: SAP FICO Consultant Type: Contract Client / Project: Buyer Duration Jan 2010 - Dec 2010 Role: Developer Duties delivery. Jan 2020 – Sep 2022 2. Example Two Ltd Position Title: Consultant, SAP Type: Permanent Project: Another buyer. Mar 2014 - Aug 2014 3. Example Three Ltd Position Title: Management Accountant Specialization: Accounting";
assert.equal(canonical(numbered).length, 3);
assert.ok(canonical(numbered).every((j) => j.company.startsWith("Example")));
assert.equal(canonical(numbered)[0].start, "Sep 2022");
const joined =
  "EXPERIENCE Organization ExampleOne DurationJuly2023–Present Designation Manager KeyRoleSAPMM/PP Project Buyer Nov2023-Present Role: Developer OrganizationExampleTwoDurationJanuary2021–July2023 DesignationSeniorPackageConsultantKeyRoleSAPMM";
assert.equal(read(joined).length, 2);
assert.equal(read(joined)[1].title, "Senior Package Consultant");
assert.equal(canonical(joined).length, 2);
const employer =
  "Work Experience Employer 3: SAP Professional Consultant – Example One Sdn. Bhd. (14 Nov 2011 – Current) Project Experience Client: Buyer Duration: Nov 2011 – Jan 2012. Employer 2: Senior SAP Basis Consultant – Example Two Sdn Bhd (19 Nov 2007 – 11 Nov 2011)";
assert.equal(canonical(employer).length, 2);
const brackets =
  "Experience [1. SENIOR MANAGER, FINANCE TRANSFORMATION] | [EXAMPLE ONE] | [MAY 2022 - CURRENT] Duties: delivery [2.SAP FICO TEAM LEADER] | [EXAMPLE TWO] | [MAR 2019 TO MAY 2022] Education [Degree] | [University] | [Jan 2010 - Dec 2013]";
assert.equal(canonical(brackets).length, 2);
const portfolio =
  "EXPERIENCE: INDUSTRY PORTFOLIO Consulting Example Consulting - Duration: from Jun 2024 to present - Role: SAP Functional FICO (Senior Analyst) Consulting Example Advisory - Duration: from April 2022 to April 2024 - Role: SAP Functional FICO (Consultant) PROJECTS: INDUSTRY PORTFOLIO Consulting Buyer - Duration: Jan 2000 - Dec 2005 - Role: SAP Consultant";
assert.equal(canonical(portfolio).length, 2);
const ledger =
  "Experience Summary S.No Company From Date To Date Duration (in Years) 1 Example Consulting, Singapore Sep’22 Till date 1.5 2 Example Oil, Example City Feb’20 Aug’22 2.7 3 Example Data Apr'19 Jan’20 0.8 Total 5 Project Client: Buyer Duration: Jan 1990 - Dec 2000";
assert.equal(canonical(ledger).length, 3);
assert.ok(canonical(ledger).every((j) => !j.title));
const companyRecords =
  "WORK EXPERIENCE 1) Company: Example One Ltd, April’24 – Present Employment Type: Contractor Client 1: Buyer July’01 – March’24 Role: SAP Lead 2) Company: Example Two Ltd, July’22 – March’24 (1 Years 8 Months) Client 1: Buyer Role: SAP Consultant";
assert.equal(canonical(companyRecords).length, 2);
assert.ok(
  canonical(companyRecords).every((j) => !j.title),
  "client role is not an employment title",
);
const summary =
  "Employment Summary: Organization: Example Limited Experience: 8 years (May 2016 till date) Current Role: Technology Lead SAP PI Project Experience: Buyer Jan 2010 - Dec 2015";
assert.equal(canonical(summary).length, 1);
assert.equal(canonical(summary)[0].start, "May 2016");
assert.equal(
  canonical(summary)[0].title,
  "",
  "current role does not apply retroactively to entire tenure",
);
const compact =
  "WorkExperience ▶WorkingasSAPConsultantinExampleTechnologiesSdnBerhad.,Malaysia,fromFebruary-2018 totilldate. ▶WorkedasSAPSr.AssociateConsultantinExampleServicesLtd.,from Dec-2014toDecember-2016.";
assert.equal(canonical(compact).length, 2);
assert.equal(read(compact)[1].title, "SAP Sr. Associate Consultant");
for (const source of [
  "Project Experience Employer 1: SAP Consultant – Buyer Ltd (Jan 2020 - Dec 2023)",
  "Project Experience Organization Buyer DurationJanuary2020–Present DesignationConsultantKeyRoleSAPMM",
  "Work Experience Jan 2025 – Dec 2020 1. Example Ltd Position Title: SAP Consultant Type: Contract",
  "Work Experience 1) Company: Example Ltd, Jan 2020 - Client: Buyer Jan 2021 - Present",
  "Experience [1.SAP Consultant] | [Client Buyer] | [Jan 2020 - Present]",
  "Work Experience Example Consultant Inc Duration: Jan 2020 - Present Client: Buyer Role: SAP Lead",
  "Experience Summary S.No Company From Date To Date Duration (in Years) 1 Example Ltd Jan 2020 5.0 Total 5",
  "Experience Organization Designation Duration Example SAP Consultant Jan 2020 - Present",
  "Work Experience Highlights SAP Consultant at Buyer Ltd Jan 2020 - Present",
  "Experience LANGUAGE Local Example Group/ Jan 2020 - Present Industry: Manufacturing",
  "Worked as an analyst on Project Example Jan 2020 - Present",
])
  assert.equal(read(source).length, 0, source);
const nonSap = normalizeActualCandidateSchema({
  resume_text:
    "Work Experience July 2024 - Present Business Development Manager Example International Spearhead market growth",
}).enterpriseProfile;
assert.equal(nonSap.employmentTimeline.length, 1);
assert.equal(nonSap.experienceSummary.sapExperienceYears, null);
console.log("labelled career batch: PASS");

const locatedSentence = canonical(
  "Worked for Example Systems Sdn Bhd, Malaysia, from April 2021 -Dec’23",
);
assert.equal(
  locatedSentence.length,
  1,
  "the same legal-employer tenure is not duplicated for its location suffix",
);

assert.ok(
  read(
    "Work Experience ExampleCo Senior SAP ABAP Consultant | Jan 2020 - Present",
  ).every((j) => j.company !== "ExampleCo Senior"),
  "seniority cannot become part of the employer",
);

for (const source of [
  "Work Experience Project 1) Company: Buyer Ltd, Jan 2020 - Present",
  "Work Experience Project Experience Employer 1: SAP Consultant – Buyer Ltd (Jan 2020 - Present)",
  "Work Experience Project: Organization Buyer DurationJanuary2020–Present DesignationConsultantKeyRoleSAPMM",
  "Project Summary S.No Company From Date To Date Duration (in Years) 1 Buyer Ltd Jan 2020 Dec 2021 2.0 Total 2",
])
  assert.equal(
    read(source).length,
    0,
    "nested project schemas must not be promoted: " + source,
  );

const employerVsAssignment = canonical(
  "EMPLOYMENT Example Systems, Malaysia SAP HCM Consultant | Jun 2016 - Current Example Integrations Senior SAP ABAP Consultant | Apr 2007 - Apr 2012 CONSULTING EXPERIENCE SAP Senior Technical Consultant | Jun 2016 - Current Buyer, APAC Support payroll users",
);
assert.equal(employerVsAssignment.length, 2);
assert.ok(employerVsAssignment.every((j) => !j.company.includes("Buyer")));
assert.ok(
  employerVsAssignment.some(
    (j) =>
      j.company === "Example Integrations" &&
      j.title === "Senior SAP ABAP Consultant",
  ),
);
