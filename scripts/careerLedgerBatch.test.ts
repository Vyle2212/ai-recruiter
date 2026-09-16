import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";

// Synthetic records reproduce layout structure only; they contain no CV data.
const fixtures = [
  [
    "Work Experience Dec 2021 - Present SuccessFactors Senior Consultant Example Management Consultants Co. Ltd. Responsibilities delivery",
    "Example Management Consultants Co. Ltd.",
    "SuccessFactors Senior Consultant",
  ],
  [
    "Experience Senior SAP HCM Consultant March 2018 - Present Example Services Sdn. Bhd. SAP HCM Support Consultant Provide support",
    "Example Services Sdn. Bhd.",
    "Senior SAP HCM Consultant",
  ],
  [
    "W O R K E X P E R I E N C E Sept 2023 – Feb 2024 Example Bank Berhad IT Project Manager Report To: Program Director",
    "Example Bank Berhad",
    "IT Project Manager",
  ],
  [
    "Experience Nov 2014 – Aug 2016 PT. EXAMPLE GLOBAL A high-energy technology services provider. Job Title : SAP Functional Consultant March 2016 – Sep 2016 PT. SECOND GLOBAL Our vision is delivery. Job Title : SAP FICO Consultant Education",
    "PT. EXAMPLE GLOBAL",
    "SAP Functional Consultant",
  ],
  [
    "EXPERIENCE Example Data Business Solutions Sdn. Bhd. Description of the consulting business. Year(s) of Service: Nov 2012 – Present Designation: Senior Consultant Role: delivery",
    "Example Data Business Solutions Sdn. Bhd.",
    "Senior Consultant",
  ],
  [
    "EXPERIENCE EXAMPLE DATA BUSINESS SOLUTIONS APAC SAP CONSULTANT - IS-AUTOMOTIVE - Dealer Business Management (DBM) Feb 2021 - Present Education",
    "EXAMPLE DATA BUSINESS SOLUTIONS APAC",
    "SAP CONSULTANT",
  ],
];

for (const [source, company, title] of fixtures) {
  const rows = read(source);
  assert.ok(
    rows.some((row) => row.company === company && row.title === title),
    `${source}\n${JSON.stringify(rows)}`,
  );
}

const generated =
  "System generated resume Senior Consultant (SAP FI/CO) @ Example NCS- Jul 2022 - Aug 2023. 1 Yrs SAP Consultant Example Technology Solutions- Sep 2008 - Dec 2012. 4 Yrs";
assert.deepEqual(
  read(generated).map((row) => [row.company, row.title, row.start, row.end]),
  [
    ["Example NCS", "Senior Consultant (SAP FI/CO)", "Jul 2022", "Aug 2023"],
    ["Example Technology Solutions", "SAP Consultant", "Sep 2008", "Dec 2012"],
  ],
);

for (const source of [
  "Project Experience Jan 2022 - Present SAP Consultant Buyer Sdn. Bhd. Responsibilities delivery",
  "Client Experience Senior SAP Consultant Jan 2022 - Present Buyer Ltd. Responsibilities delivery",
  "Experience Example Ltd Project Manager Jan 2025 - Jan 2024 Responsibilities delivery",
  "System generated resume Project Manager Buyer Ltd - Jan 2025 - Jan 2024",
  "EXPERIENCE SAP CONSULTANT - IS-AUTOMOTIVE - Dealer Business Management (DBM) Feb 2021 - Present Education",
]) {
  assert.equal(
    read(source).length,
    0,
    `${source}\n${JSON.stringify(read(source))}`,
  );
}

console.log("career ledger batch: PASS");
