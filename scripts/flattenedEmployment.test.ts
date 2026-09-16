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
