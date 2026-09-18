import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const cases = [
  [
    "Work Experience SAP MM SENIOR CONSULTANT | Example Systems Inc. APRIL 2024 – PRESENT Duties: support",
    "Example Systems Inc.",
    "SAP MM SENIOR CONSULTANT",
  ],
  [
    "Experience Example Systems Sdn Bhd | ERP Implementation Consultant | Aug 2024 – Oct 2024 1. Rollout duties",
    "Example Systems Sdn Bhd",
    "ERP Implementation Consultant",
  ],
  [
    "Work Experiences SAP FUNCTIONAL CONSULTANT Example Consulting SdnBhd| July. 2021 -present -Involved in delivery",
    "Example Consulting SdnBhd",
    "SAP FUNCTIONAL CONSULTANT",
  ],
  [
    "Work Experience Example Services, Inc. SAP MM Service Consultant | January 2025 - Present Acted as lead.",
    "Example Services, Inc.",
    "SAP MM Service Consultant",
  ],
  [
    "WORK EXPERIENCE [EXAMPLE INC.] [Business Architecture Associate Manager] November 2023-Present Responsibilities: delivery",
    "EXAMPLE INC.",
    "Business Architecture Associate Manager",
  ],
  [
    "Work Experience Example Consulting Position Title : Senior ABAP Consultant Period : Jun 2016 – Aug 2017 Project Experience Client: Buyer",
    "Example Consulting",
    "Senior ABAP Consultant",
  ],
  [
    "Work Experience Employer Name Example Consulting Sdn Bhd Job Title SAP Basis Consultant Period of Employment August 2017 - Present Responsibilities: operations",
    "Example Consulting Sdn Bhd",
    "SAP Basis Consultant",
  ],
  [
    "Work Experience Example Consulting Position: Senior SAP Security/GRC/ABAP Consultant 02nd January 2018 – 15th July 2020 Project: Buyer",
    "Example Consulting",
    "Senior SAP Security/GRC/ABAP Consultant",
  ],
  [
    "Experience Example Manufacturing PTE LTD. July 28,2023 to current Position: SAP EWM Consultant Duties and Responsibilities: delivery",
    "Example Manufacturing PTE LTD.",
    "SAP EWM Consultant",
  ],
  [
    "WORK EXPERIENCE 9Example Consulting Sdn Bhd (SCM functional consultant) 2016 - Present Implement ERP system.",
    "9Example Consulting Sdn Bhd",
    "SCM functional consultant",
  ],
  [
    "Work Experience Technical Lead June 2021 – Present Example Consulting Involved in software development",
    "Example Consulting",
    "Technical Lead",
  ],
  [
    "Work Experience SAP Development Lead | May 2012 – Dec 2015 Example Devices, Malaysia Managed support team",
    "Example Devices, Malaysia",
    "SAP Development Lead",
  ],
  [
    "EXPERIENCES EXAMPLE TECHNOLOGIES SDN. BHD SENIOR ENGINEER, SAP OPERATION DECEMBER 2020- CURRENT - Main system owner",
    "EXAMPLE TECHNOLOGIES SDN. BHD",
    "SENIOR ENGINEER, SAP OPERATION",
  ],
  [
    "EXPERIENCE Example Systems Sdn. Bhd. DECEMBER 2022 - PRESENT SENIOR ASSOCIATE - SAP CONSULTANT Attached to delivery practice",
    "Example Systems Sdn. Bhd.",
    "SENIOR ASSOCIATE - SAP CONSULTANT",
  ],
] as const;
for (const [source, company, title] of cases) {
  assert.ok(
    read(source).some((j) => j.company === company && j.title === title),
    source,
  );
  const jobs = canonical(source);
  assert.equal(jobs.length, 1, source);
  assert.equal(jobs[0].company, company.replace("SdnBhd", "Sdn Bhd"), source);
  assert.equal(jobs[0].title.toLowerCase(), title.toLowerCase(), source);
}
const adjacent =
  "EXPERIENCE SAP ABAP DEVELOPER Example Services | Aug 2017- October 2018 FULL STACK WEB DEVELOPER Example Services | Dec 2016 - Aug 2017 Develop cloud applications. SAP Consultant | Buyer | Jan 2015 - Dec 2016";
assert.deepEqual(
  read(adjacent).map((j) => [j.company, j.title]),
  [
    ["Example Services", "SAP ABAP DEVELOPER"],
    ["Example Services", "FULL STACK WEB DEVELOPER"],
  ],
);
assert.equal(
  canonical(adjacent).length,
  2,
  "do not resynchronize through duties",
);
const datesFirst =
  "WORK EXPERIENCE Jan 2022 - Now Deputy Manager | Example Systems Jan 2018 - Now Project Manager | Example Systems Aug 2015 - Now Senior Business Analyst | Example Systems PERSONAL PROJECT Jan 2020 - Dec 2020 SAP Consultant | Client Buyer";
assert.equal(
  canonical(datesFirst).length,
  3,
  "explicit overlapping role claims retain their own dates",
);
const legalLedger =
  "Work Experience May 2024 - Present Example One, Inc. SAP PS Solutions Consultant March 2021 – May 2024 Example Two, Inc Associate Manager Responsibilities: deliveries";
assert.equal(canonical(legalLedger).length, 2);
for (const bad of [
  "Project Experience SAP Consultant | Buyer Inc. Jan 2020 - Dec 2021",
  "Work Experience Responsibilities: SAP Consultant | Buyer Inc. Jan 2020 - Dec 2021",
  "Experience , while also enhancing my skills as an employee. WORK EXPERIENCE SAP Consultant | Example Inc. Jan 2020 - Dec 2021",
  "Work Experience SAP Consultant, Example Global | Country 2010 - 2011",
  "Work Experience Senior Manager | Head of SAP Center of Excellence | July 2025 - Present",
  "Work Experience SAP Consultant | Example Inc. Dec 2025 - Mar 2025",
  "Work Experience SAP Consultant | Example Inc. Jan 2020 -",
  "Work Experience SAP Consultant | Example Inc. Jan 2020 - Present Project date: Jan 2019 - Dec 2019",
]) {
  const jobs = read(bad);
  if (bad.includes("while also"))
    assert.ok(jobs.every((j) => j.title === "SAP Consultant"));
  else if (bad.includes("Project date:"))
    assert.ok(jobs.every((j) => j.start === "Jan 2020"));
  else assert.equal(jobs.length, 0, bad);
}
const roles = normalizeActualCandidateSchema({
  resume_text:
    "Work Experience Supply Chain Head | Example Trading Company | Jan 2010 - Jan 2014 SAP Consultant | Example Systems | Jan 2014 - Jan 2016",
}).enterpriseProfile;
assert.equal(roles.employmentTimeline.length, 2);
assert.equal(
  roles.experienceSummary.sapExperienceYears,
  2,
  "non-SAP employment must not inflate SAP experience",
);

const repeatedCompany = canonical(
  "EXPERIENCE Senior SAP Basis Consultant Example Malaysia Sdn Bhd | Feb 2020 – Present Actively working on projects. WORKING EXPERIENCE Period February 2020 – Present Company Example Consulting Malaysia Sdn Bhd Designation Senior SAP Basis Consultant",
);
assert.equal(
  repeatedCompany.length,
  1,
  "explicit labelled record owns competing same-role tenure",
);
assert.equal(repeatedCompany[0].company, "Example Consulting Malaysia Sdn Bhd");
const dottedLedger = canonical(
  "EMPLOYMENT HISTORY : Example One SDN. BHD. – Senior SAP FICO Consultant. (Feb 2011 – Present) Example Two Sdn. Bhd. - Senior SAP FICO Consultant (July 2010 – Feb 2011) Example Three Sdn Bhd - Senior SAP Consultant (May 2008 – July 2010) PREVIOUS PROJECTS INVOLVED : Jan 2017 – Present Client: Buyer",
);
assert.equal(dottedLedger.length, 3);
assert.deepEqual(
  dottedLedger.map((j) => j.company).sort(),
  [
    "Example One SDN. BHD.",
    "Example Two Sdn. Bhd.",
    "Example Three Sdn Bhd",
  ].sort(),
);

assert.equal(
  read(
    "Work History Example Systems Sdn. Bhd. - ERP Implementation Consultant Example City Feb 2020 - Current",
  ).length,
  0,
  "unlabelled location must not become a title suffix",
);
console.log("delimited employment batch: PASS");
