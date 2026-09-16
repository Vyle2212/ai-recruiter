import assert from "node:assert/strict";
import { flattenedEmployment } from "../lib/flattenedEmployment";
import {
  extractCanonicalEmploymentFromResume,
  employmentTimelineDiagnostics,
} from "../lib/candidate360Employment";

const read = flattenedEmployment;
const positive = [
  "Employment History Example Systems | SAP Consultant Jan 2020 – Present",
  "Professional Experience Example Systems, Senior SAP Team Lead (Apr 2019 – Current)",
  "Working Experience SAP SD/MM Functional Consultant at Example Systems (Jan 2020 to Present)",
  "Professional Experience SAP Finance Architect | Example Systems | Contract | Oct 2024 - Ongoing",
  "Work Experience Worked with Example Systems as SuccessFactors Consultant (contract) from November 2016 to Dec 2018.",
  "Working Experience Working as an SAP FICO Consultant in Example Systems-Mar 2024- Present",
  "Work Experience Worked at Example Systems as Consultant from Jan 2020 to Dec 2021.",
  "Employer: Example Systems (28 April 2023 to till now) Client: Example Buyer Project: Migration Role: SAP Lead",
  "Organization: Example Systems (M) Sdn Bhd June 2010 – Current Position: Senior Logistics Lead Project/Task: Example Buyer Duration: Sep 2010 – May 2011",
];
for (const text of positive) {
  const rows = read(text);
  assert.equal(rows.length, 1, text);
  assert.match(rows[0].company, /^Example Systems/);
  assert.ok(rows[0].start);
  assert.ok(rows[0].end);
}
const employerOnly = read(positive[7])[0];
assert.equal(
  employerOnly.title,
  "",
  "a client's role cannot fill the employer title",
);
assert.equal(
  employerOnly.start,
  "28 April 2023",
  "preserve explicit day precision",
);
assert.equal(employerOnly.end, "Present");
assert.equal(read(positive[8])[0].start, "June 2010");

const table =
  "Career History From To Company and Title Jan 2022 Present Example Systems - Manager (promoted) Jan 2020 Dec 2021 Example Labs - Programmer Analyst III Jan 2018 Dec 2019 Example Works - Consultant";
assert.deepEqual(
  read(table).map((j) => [j.company, j.title]),
  [
    ["Example Systems", "Manager"],
    ["Example Labs", "Programmer Analyst III"],
    ["Example Works", "Consultant"],
  ],
);
const ledger =
  "Career History Jan 2022 – Present Example Systems - SAP Consultant Jan 2020 – Dec 2021 Example Labs - Subject Matter Expert (Contract) Summary Professional Experience delivery";
assert.equal(read(ledger).length, 2);
assert.equal(read(ledger)[1].title, "Subject Matter Expert");
const repeated = `${positive[7]} Employer: Example Systems (28 April 2023 to till now) Client: Another Buyer`;
assert.equal(
  read(repeated).length,
  1,
  "identical repeated employer tenure is one row",
);
assert.equal(extractCanonicalEmploymentFromResume(repeated).length, 1);

const negative = [
  "Project Work Experience Example Systems | SAP Consultant Jan 2020 - Present",
  "Project Experience Example Systems | SAP Consultant Jan 2020 - Present",
  "Work Experience Projects: Worked with Example Buyer as SAP Consultant from Jan 2020 to Dec 2021.",
  "Work Experience Client: Example Buyer Worked with Example Buyer as SAP Consultant from Jan 2020 to Dec 2021.",
  "Employment History Education Example Systems | SAP Consultant Jan 2020 - Present",
  "References Employer: Example Systems (Jan 2020 to Present) Client: Example Buyer",
  "Work Experience Worked for client Example Buyer as SAP Consultant from Jan 2020 to Present.",
  "Work Experience Worked with Example Systems as Consultant from Jan 2020.",
  "Work Experience Worked with Example Systems as Consultant from Jan 2022 to Dec 2021.",
  "Employer: Example Systems Client: Example Buyer (Jan 2020 to Present) Role: SAP Consultant",
  "Organization: Example Systems Position: SAP Consultant Project/Task: Example Buyer Duration: Jan 2020 - Present",
  "Employment History Example Client | SAP Consultant Jan 2020 - Present",
  "Employment History Example Systems – Business Analyst / SAP BODS, BI Developer Jan 2020 - Present",
  "Career History From To Company and Title Jan 2020 Jan 2021 Example Systems - Unclassified Jan 2021 Jan 2022 Example Labs - Consultant",
  "Career History Jan 2020 - Jan 2021 Jan 2021 - Jan 2022 Example Systems - Consultant",
];
for (const text of negative) assert.deepEqual(read(text), [], text);
const canonical = extractCanonicalEmploymentFromResume(ledger);
assert.equal(canonical.length, 2);
assert.equal(employmentTimelineDiagnostics(canonical).duplicateRecords, 0);
console.log(
  "Flattened employment batch: explicit tenure, section/cell isolation, precision and deduplication pass",
);

const headingFields = [
  [
    "Working Experience October 2016 to Present (10 months) Example Aviation Pte Ltd Quality Manager Responsibilities: Delivery.",
    "Example Aviation Pte Ltd",
    "Quality Manager",
  ],
  [
    "Employment History Example Services Sdn Bhd May 2023 – Jan 2024 Senior Manager, ERP Delivery  Task / Job Scopes: Delivery.",
    "Example Services Sdn Bhd",
    "Senior Manager, ERP Delivery",
  ],
  [
    "Working Experience May 2017 – Current Example Consulting Sdn Bhd SAP MDO Consultant Hands-on delivery.",
    "Example Consulting Sdn Bhd",
    "SAP MDO Consultant",
  ],
  [
    "Professional Experience COMPANY Example Manufacturing POSITION REGIONAL MASTER DATA CONTROLLER DURATION JANUARY 2024 TILL PRESENT Responsible for delivery.",
    "Example Manufacturing",
    "REGIONAL MASTER DATA CONTROLLER",
  ],
  [
    "Employment History Example Systems Ltd Position: SAP Consultant (Jan 2020 – Dec 2021) Job Functions: Delivery.",
    "Example Systems Ltd",
    "SAP Consultant",
  ],
  [
    "Employment History X Systems Ltd Position: SAP Consultant (Jan 2020 – Dec 2021) Job Functions: Delivery.",
    "X Systems Ltd",
    "SAP Consultant",
  ],
  [
    "Employment History IV Systems Ltd Position: SAP Consultant (Jan 2020 – Dec 2021) Job Functions: Delivery.",
    "IV Systems Ltd",
    "SAP Consultant",
  ],
];
for (const [text, company, title] of headingFields) {
  const rows = read(text);
  assert.equal(rows.length, 1, text);
  assert.deepEqual([rows[0].company, rows[0].title], [company, title]);
}
const numbered =
  "Employment History I1 7 Example Systems Sdn Bhd Metro City Position: SAP Consultant (Jan 2022 – Present) Job Functions: Delivery. Employment History II Example Labs Ltd Harbor City Position: SAP Analyst (Jan 2020 – Dec 2021) Responsibilities: Delivery.";
assert.deepEqual(
  read(numbered).map((j) => j.company),
  ["7 Example Systems Sdn Bhd", "Example Labs Ltd"],
);
const parenthetical =
  "Professional Experience Example Systems Pvt. Ltd – May 2021 to June 2025 (Senior Manager) Example Labs Private Limited – April 2019 to May 2021 (Senior Consultant) Project Experience Example Buyer – Jan 2023 to Dec 2024 (Project Lead)";
assert.equal(read(parenthetical).length, 2);
assert.equal(extractCanonicalEmploymentFromResume(parenthetical).length, 2);
const employerLedger =
  "Employment History Jan 2025 - Present | Example Healthcare (Contracting) Oct 2024 - Jan 2025 | Example Labs Dec 2021 - Dec 2023 | Example Systems";
assert.equal(read(employerLedger).length, 3);
assert.ok(read(employerLedger).every((j) => j.title === ""));
assert.equal(read(employerLedger)[0].company, "Example Healthcare");
const beforeProject =
  "Employment History 1)Example Group Berhad (May 2022 – Present) Project: Migration Role: Senior SAP Analyst Duration: Sep 2023 – Jan 2024";
assert.deepEqual(
  read(beforeProject).map((j) => [j.company, j.title, j.start]),
  [["Example Group Berhad", "", "May 2022"]],
);
const headingNegatives = [
  "Project Experience Example Services Sdn Bhd May 2023 – Jan 2024 SAP Consultant Responsibilities: Delivery.",
  "Employment History Client: Example Services Sdn Bhd May 2023 – Jan 2024 SAP Consultant Responsibilities: Delivery.",
  "Employment History Example Systems Ltd Client Example Buyer Position: SAP Consultant (Jan 2020 – Dec 2021) Job Functions: Delivery.",
  "Employment History Example Systems Ltd Jan 2015 – Dec 2016 Position: SAP Consultant (Jan 2020 – Dec 2021) Job Functions: Delivery.",
  "Employment History Example Systems Ltd Position: SAP Consultant (Jan 2020) Job Functions: Delivery. Project: Rollout Duration: Jan 2020 – Present",
  "Employment History COMPANY Example Systems POSITION SAP Consultant DURATION Jan 2022 – Dec 2021",
  "Employment History COMPANY Example Systems POSITION SAP Consultant DURATION Jan 2020 – Jan 20200",
  "Employment History Example Systems Ltd 31 April 2020 – Dec 2021 SAP Consultant Responsibilities: Delivery.",
  "Employment History Example Systems Ltd Jan 2020 – Dec 2021 Worked as a consultant",
  "Employment History Jan 2025 - Present | Example Client (Contracting)",
  "Employment History Jan 2025 - Present | Example Systems SAP Consultant",
  "Employment History Jan 2025 - Present | Jan 2020 - Dec 2021 | Example Systems",
  "Employment History Example Systems Ltd – Jan 2022 to Dec 2021 (Consultant) Example Labs Ltd – Jan 2020 to Dec 2021 (Consultant)",
];
for (const text of headingNegatives) assert.deepEqual(read(text), [], text);
console.log(
  "Bounded heading fields: order, enumeration, employer-only ledgers and assignment isolation pass",
);

const labelledForms =
  "Professional Experience Resume supplied for recruitment review. COMPANY Example Services Ltd POSITION SAP Manager DURATION July 2024 - Present Client: Buyer One Project: Migration Role: Developer Jan 2020 - Dec 2020 COMPANY Example Manufacturing Ltd POSITION Production Chemist DURATION May 2011 - March 2014 Responsibilities: Production quality.";
assert.deepEqual(
  read(labelledForms).map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Services Ltd", "SAP Manager", "July 2024", "Present"],
    [
      "Example Manufacturing Ltd",
      "Production Chemist",
      "May 2011",
      "March 2014",
    ],
  ],
);
const serviceForms =
  "Working Experience Current Employment Current Position Company Example Services Position Consultant Service Period August 2017 until current Key Responsibilities Previous Position Company Example Manufacturing Position Production Chemist Service Period May 2011 until March 2014 Key Responsibilities";
assert.equal(read(serviceForms).length, 2);
assert.equal(read(serviceForms)[1].title, "Production Chemist");
const periodForms =
  "Working Experience Period February 2020 – Present Company Example Services Designation Senior SAP Basis Consultant Plan, coordinate with customers. Period September 2014 – January 2020 Company Example Systems Designation SAP Basis Engineer Investigate incidents. Period April 2012 – February 2013 Company Example Logistics Designation Service Desk Analyst (German Speaker) Provide support.";
assert.deepEqual(
  read(periodForms).map((j) => j.title),
  [
    "Senior SAP Basis Consultant",
    "SAP Basis Engineer",
    "Service Desk Analyst (German Speaker)",
  ],
);
const assertions =
  "Professional Experience-2 Working with Example Services since Sep 2023 to till date 1. Projects Details: Client: Buyer One Role: SAP Consultant Professional Experience-1 Worked with Example Systems from July2020-Jan2021 Projects Details: Role: Developer";
assert.deepEqual(
  read(assertions).map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Services", "", "Sep 2023", "Present"],
    ["Example Systems", "", "July 2020", "Jan 2021"],
  ],
);
for (const text of [
  "Project Professional Experience COMPANY Example Buyer POSITION Consultant DURATION Jan 2020 - Present",
  "Professional Experience Project: Delivery COMPANY Example Buyer POSITION Consultant DURATION Jan 2020 - Present",
  "Professional Experience Project Experience COMPANY Example Buyer POSITION Consultant DURATION Jan 2020 - Present",
  "Professional Experience COMPANY Example Services POSITION Consultant Client: Buyer DURATION Jan 2020 - Present",
  "Professional Experience COMPANY Example Services POSITION Consultant DURATION Jan 2024 - Dec 2023",
  "Professional Experience COMPANY Example University POSITION RESEARCH STUDENT DURATION Jan 2020 - Dec 2021",
  "Professional Experience COMPANY Example Services POSITION Consultant DURATION Jan 2020 - Project Duration Jan 2021 - Dec 2021",
  "Working Experience Current Employment Company Example Services Position Consultant Project Period Jan 2020 - Present",
  "Working Experience Period Jan 2020 - Present Company Client Buyer Designation SAP Consultant Plan delivery",
  "Working Experience Period Jan 2020 - Present Company Example Services Designation SAP Consultant Client: Buyer Plan delivery",
  "Professional Experience-1 Worked with Client Buyer since Jan 2020 - Present",
  "Professional Experience-1 Worked for Example Buyer since Jan 2020 - Present",
  "Professional Experience-1 Working with Example Services since Jan 2020 Project: Delivery Jan 2021 - Present",
])
  assert.equal(read(text).length, 0, text);
assert.equal(extractCanonicalEmploymentFromResume(labelledForms).length, 2);
assert.equal(extractCanonicalEmploymentFromResume(serviceForms).length, 2);
assert.equal(extractCanonicalEmploymentFromResume(periodForms).length, 3);
assert.equal(extractCanonicalEmploymentFromResume(assertions).length, 2);
console.log(
  "Labelled forms batch: field boundaries, project isolation and explicit tenure pass",
);

assert.deepEqual(
  read(
    "Professional Experience COMPANY Example Partial POSITION Chemist DURATION COMPANY Example Complete POSITION Chemist DURATION Jan 2020 - Dec 2021",
  ).map((j) => j.company),
  ["Example Complete"],
);
