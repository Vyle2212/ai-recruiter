import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema as normalize } from "../lib/candidate360SchemaNormalize";

// Synthetic layouts reproduce field order and extraction defects, not CV data.
const cases = [
  [
    "Work Experience June 2022 - Current SAP Consultant at Example Sdn Bhd Project Delivery",
    "Example Sdn Bhd",
    "SAP Consultant",
  ],
  [
    "Work Experience January 2022 – SAP QM Functional Analyst (Executive) Current Example Sdn Bhd Consult and handle issues",
    "Example Sdn Bhd",
    "SAP QM Functional Analyst (Executive)",
  ],
  [
    "Employment History Jan 2022 - Example Sdn Bhd, Example City, Country. Present SD Support Consultant Respond to tickets",
    "Example Sdn Bhd",
    "SD Support Consultant",
  ],
  [
    "Work Experience Jan 2022 - Dec 2024 IT Project Manager | Example | Example City Managed delivery",
    "Example",
    "IT Project Manager",
  ],
  [
    "Professional Experience SAP Functional Consultant FICO: October 2022 - Present Example Solutions Currently working on configuration",
    "Example Solutions",
    "SAP Functional Consultant FICO",
  ],
  [
    "Employment History 1. SAP FICO Project Lead (0.3 year) (August 2022 - Continuing) Example SND BHD. Example City Duties",
    "Example SND BHD.",
    "SAP FICO Project Lead",
  ],
  [
    "Work Experience Jan 2022 - Present Functional Enterprise Resource Planning (ERP) Consultant – Example Software SDN BHD Name of the software: Other ERP",
    "Example Software SDN BHD",
    "Functional Enterprise Resource Planning (ERP) Consultant",
  ],
  [
    "Experience IT Analyst III : Example Solar (Example City) , March 2022 – Present Act as Level 3 support",
    "Example Solar (Example City)",
    "IT Analyst III",
  ],
  [
    "Experience Example Software | Feb 2022 - Present 1. Training and probation Duration Jan 2020 - Dec 2020",
    "Example Software",
    "",
  ],
  [
    "Experience 10 years of total experience Mar 2022 - Present (1 year 7 months) SAP Sales and Distribution Functional Consultant Example Services | Example City Support users",
    "Example Services",
    "SAP Sales and Distribution Functional Consultant",
  ],
  [
    "WorkingExperiences 2022-Present ExampleTechnologySdnBhd Projects: Client Buyer Ltd",
    "ExampleTechnologySdnBhd",
    "",
  ],
  [
    "WorkExperience: December2021toMay2024 SAPConsultant ExamplePteLtd Duties: RoleofSAPSales",
    "ExamplePteLtd",
    "SAP Consultant",
  ],
  [
    "RelevantExperiences ExampleConsultingSdnBhd Sep2022-Current 1.AssociateConsultant-SuccessFactors Joinedasexperiencedhire",
    "ExampleConsultingSdnBhd",
    "Associate Consultant - SuccessFactors",
  ],
  [
    "Working Experiences July 2022 - Oct 2022 Example Technologies SAP Application Maintenance Client: Buyer Ltd",
    "Example Technologies",
    "",
  ],
  [
    "Career Summary Example Ltd, Example City (Unit) SAP MM Functional Consultant (July 2021 – July 2024) Education Other University",
    "Example Ltd, Example City (Unit)",
    "SAP MM Functional Consultant",
  ],
  [
    "Professional Background Example Sdn Bhd, Example City SAP Project Lead Sept 2022 - present Managed delivery",
    "Example Sdn Bhd, Example City",
    "SAP Project Lead",
  ],
  [
    "WORKING EXPERIANCE PERIOD : 2021 – 2024 COMPANY : Example Sdn.Bhd. POSITION : LEAD SENIOR CONSULTANT, E2 EXPERIANCE Functional delivery",
    "Example Sdn.Bhd.",
    "LEAD SENIOR CONSULTANT, E2",
  ],
];
for (const [source, company, title] of cases) {
  const rows = read(source);
  assert.ok(
    rows.some((row) => row.company === company && row.title === title),
    source + JSON.stringify(rows),
  );
}

const labelled =
  "Work Experiences Date: 17 Jun 2022 – present Company: Example Sdn. Bhd. (formerly Other) – Example City, Country Position: ERP Consultant Job Descriptions: Duties Date: 8 Mar 2018 – 30 Jun 2021 Company: Earlier Ltd Position: Finance Assistant Manager Job Descriptions: accounting";
assert.deepEqual(
  read(labelled).map((r) => [r.company, r.title, r.start]),
  [
    ["Example Sdn. Bhd. (formerly Other)", "ERP Consultant", "17 Jun 2022"],
    ["Earlier Ltd", "Finance Assistant Manager", "8 Mar 2018"],
  ],
);
const comments =
  "EMPLOYMENT DETAILS Organization Name Designation From Date To Date Comments 1 Example Consulting Ltd Sr. Consultant 4th June 2022 Till date Worked on PS module 2 Earlier Ltd Consultant 29 September 2018 March 2021 Worked on MM 3 First Ltd Jr. Executive 08March 2016 10th Feb 2018 PERSONAL DETAILS";
const commentRows = read(comments);
assert.equal(commentRows.length, 3);
assert.deepEqual(
  commentRows.map((r) => [r.company, r.title, r.start, r.end]),
  [
    ["Example Consulting Ltd", "Sr. Consultant", "4 June 2022", "Present"],
    ["Earlier Ltd", "Consultant", "29 September 2018", "March 2021"],
    ["First Ltd", "Jr. Executive", "08 March 2016", "10 Feb 2018"],
  ],
);
const joined =
  "EMPLOYMENT HISTORY DateCompany NameRole Aug 2019 – Nov 2022Example Delivery Center Senior Consultant Feb 2016 – July 2019Earlier Center Software Engineer EDUCATION";
assert.equal(read(joined).length, 2);
assert.equal(read(joined)[0].company, "Example Delivery Center");
const dense =
  "SUMMARY OF EMPLOYMENT Feb 2022 – June 2022 Example Ltd SAP Senior Consultant (MM) Dec 2019 – Dec 2021 Earlier Consulting (M) SAP Senior Consultant (MM) – MM Team Lead Nov 2016 – May 2019 First Sdn Bhd SAP Senior Consultant (MM) EDUCATION";
assert.equal(read(dense).length, 3, "fuller ledger title is not another job");
assert.equal(read(dense)[1].title, "SAP Senior Consultant (MM) – MM Team Lead");
assert.equal(canonical(dense).length, 3);
const chronicle =
  "EMPLOYMENT CHRONICLE Example Tech(M) S/B Sr.Project Manager Apr’22 - current Other Sdn Bhd Sr Project Manager Mar ‘20 – Mar’22 Earlier, Country PM, Pre-Sales,& Sr. Consultant Sep’18- Feb ’20 Academic Qualifications";
const chronicleRows = read(chronicle);
assert.equal(chronicleRows.length, 3);
assert.equal(chronicleRows[2].company, "Earlier, Country");
assert.equal(chronicleRows[2].title, "PM, Pre-Sales,& Sr. Consultant");
const intern =
  "Work Experience May 2022 – present (2025) Example Co., Ltd. Sep 2021 - Apr 2022 Earlier Information System (Unit) SAP FI Consultant - Internship PROFILE";
assert.equal(read(intern).length, 2);
assert.ok(
  read(intern).some((r) => r.title === "SAP FI Consultant - Internship"),
);
assert.ok(
  read(intern).some((r) => r.company === "Example Co., Ltd." && !r.title),
);

assert.deepEqual(
  read(
    "WORK EXPERIENCE Worked at Example Ltd as SAP Consultant (2016-2019) INDUSTRIES EXPERIENCE Software PROJECTS EXPERIENCE Company: Buyer Ltd Duration: Nov ‘19 – Apr’20 Role: Senior ABAP Consultant Responsibilities: delivery",
  ).map((r) => r.company),
  ["Example Ltd"],
  "project section must not overwrite the explicit employer sentence",
);

for (const source of [
  "PROJECTS EXPERIENCE Company: Example Ltd Duration: Nov ‘19 – Apr’20 Role: Senior ABAP Consultant Responsibilities: work",
  "PROJECTS EXPERIENCE June 2022 - Current SAP Consultant at Buyer Sdn Bhd Project Delivery",
  "Project Experience January 2022 – SAP Consultant Current Buyer Ltd Consult on delivery",
  "Client Experience June 2022 - Current SAP Consultant at Buyer Sdn Bhd Project Delivery",
  "Work Experience Responsibilities: Client January 2022 – SAP Consultant Current Buyer Ltd Consult on delivery",
  "Work Experience January 2025 – SAP Consultant March 2024 Example Ltd Consult on delivery",
  "Work Experience January 2022 – SAP Consultant Example Ltd Consult on delivery",
  "Employment History Jan 2022 - Example Ltd Present Client Buyer SD Consultant Respond to tickets",
  "Project Experience Date: 17 Jun 2022 – present Company: Buyer Ltd Position: SAP Consultant Job Descriptions: delivery",
  "Work Experiences Date: 17 Jun 2022 – Company: Example Ltd Position: ERP Consultant Job Descriptions: project Jan 2020 - Dec 2024",
  "PROJECT HISTORY Organization Name Designation From Date To Date Comments 1 Buyer Ltd Consultant 4th June 2022 Till date Worked on PS",
  "EMPLOYMENT DETAILS Organization Name Designation From Date To Date Comments 1 Example Ltd Consultant June 2022 Comments Project duration Jan 2020 - Dec 2024",
  "EMPLOYMENT HISTORY DateCompany NameRole Aug 2025 – Nov 2022Example Ltd Senior Consultant EDUCATION",
  "WorkExperience: December2025toMay2024 SAPConsultant ExamplePteLtd Duties: RoleofSAPSales",
  "WorkExperience: December2021toMay2024 SAPConsultant ClientBuyerLtd Duties: RoleofSAPSales", // compact client label is still an ownership risk
  "SUMMARY OF EMPLOYMENT Feb 2022 – June 2022 Client Buyer SAP Senior Consultant (MM) EDUCATION",
  "Career Summary Manager, Specialized Services Example Ltd March 2022-present",
]) {
  assert.equal(read(source).length, 0, source + JSON.stringify(read(source)));
}
for (const source of [labelled, cases[6][0]]) {
  const p = normalize({ resume_text: source }).enterpriseProfile;
  assert.equal(
    p.experienceSummary.sapExperienceYears,
    null,
    "non-SAP employment must not inflate SAP experience",
  );
}
console.log("interleaved career batch: PASS");
