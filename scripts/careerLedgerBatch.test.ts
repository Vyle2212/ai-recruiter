import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";

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

// Assert the complete tuple set, including absence of extra cross-row joins.
// A positive 'some(row)' assertion alone cannot detect a second, false row.
const tuples = (source: string) =>
  canonical(source).map((row) => [row.company, row.title, row.start, row.end]);
assert.deepEqual(
  tuples(
    "Professional Experience May 2022 - Present Example Services Sdn Bhd - Project Manager Sept 2020 - Apr 2022 Second Services Sdn Bhd - Senior FI Consultant",
  ),
  [
    ["Example Services Sdn Bhd", "Project Manager", "May 2022", "Present"],
    [
      "Second Services Sdn Bhd",
      "Senior FI Consultant",
      "Sept 2020",
      "Apr 2022",
    ],
  ],
);
assert.deepEqual(
  tuples(
    "Career History Summary of professional Experience. Employment History Position Company Period SD Consultant Example Services Sdn Bhd 2011 - Present Team Lead Example Manufacturing Sdn Bhd 2006 - 2011 Model Engineer Example Design Sdn Bhd 2004 - 2006 Qualification Level University Year",
  ),
  [
    ["Example Services Sdn Bhd", "SD Consultant", "2011", "Present"],
    ["Example Manufacturing Sdn Bhd", "Team Lead", "2006", "2011"],
    ["Example Design Sdn Bhd", "Model Engineer", "2004", "2006"],
  ],
);
assert.deepEqual(
  tuples(
    "Professional Experience SAP Consultant, Example Corporation 2008 - 2010 SAP Manager, Second Corporation 2004 - 2008",
  ),
  [
    ["Example Corporation", "SAP Consultant", "2008", "2010"],
    ["Second Corporation", "SAP Manager", "2004", "2008"],
  ],
);
for (const source of [
  "Professional Experience Example Services Sdn Bhd November 2014 - May 2015 Senior SAP HCM Consultant BUYER INDUSTRIES SDN BHD - Implementation Project Description: SAP delivery",
  "Professional Experience Example Services Sdn Bhd March 2016 - March 2018 Senior Financial Consultant Second Services Sdn Bhd June 2014 - Feb 2016 Financial Controlling Functional Consultant Education",
  "Career History Project History Delivered the implementation. Jan 2022 - Present SAP Consultant Buyer Sdn Bhd Responsibilities delivery",
])
  assert.deepEqual(tuples(source), [], source);

assert.deepEqual(
  tuples(
    "Experience EXAMPLE DATA BUSINESS SOLUTIONS APAC SAP CONSULTANT - IS-AUTOMOTIVE - Dealer Business Management (DBM) 02/2021 - present Education",
  ),
  [
    [
      "EXAMPLE DATA BUSINESS SOLUTIONS APAC",
      "SAP Consultant",
      "feb 2021",
      "Present",
    ],
  ],
);
assert.deepEqual(
  read(
    "Work History SAP Senior Consultant May 2015 - Current Example Services Sdn Bhd. SAP ABAP Consultant May 2009 - Apr 2015 Second Services Sdn Bhd. Responsibilities delivery",
  ).map((r) => [r.company, r.title, r.start, r.end]),
  [
    [
      "Example Services Sdn Bhd.",
      "SAP Senior Consultant",
      "May 2015",
      "Present",
    ],
    ["Second Services Sdn Bhd.", "SAP ABAP Consultant", "May 2009", "Apr 2015"],
  ],
);
assert.deepEqual(
  read(
    "Experience Delivered the previous assignment. AUG 2016 - OCT 2019 Business Development Analyst II EXAMPLE Manufacturing Sdn Bhd Responsibilities delivery",
  ).map((r) => [r.company, r.title, r.start, r.end]),
  [
    [
      "EXAMPLE Manufacturing Sdn Bhd",
      "Business Development Analyst II",
      "AUG 2016",
      "OCT 2019",
    ],
  ],
);
assert.deepEqual(
  read(
    "List of professional positions Period Organisation Description of activities Apr 2013 - Current Example Consulting Sdn Bhd Senior Consultant Dec 2008 - Mar 2013 Second Consulting Sdn Bhd Senior Consultant Apr 2008 - Nov 2008 Third Consulting Sdn Bhd Consultant 2000 - 2008 Fourth Consulting Sdn Bhd Consultant",
  ).map((r) => [r.company, r.title, r.start, r.end]),
  [
    ["Example Consulting Sdn Bhd", "Senior Consultant", "Apr 2013", "Present"],
    ["Second Consulting Sdn Bhd", "Senior Consultant", "Dec 2008", "Mar 2013"],
    ["Third Consulting Sdn Bhd", "Consultant", "Apr 2008", "Nov 2008"],
    ["Fourth Consulting Sdn Bhd", "Consultant", "2000", "2008"],
  ],
);
assert.deepEqual(
  read(
    "Professional Experience Worked on order management Jun 2021 - Mar 2022 SAP OTC Lead Example Corporation, Example City 1. Provide solutions Jan 2018 - Jun 2021 SAP Functional Expert Second Corporation, Example City 1. Provide process documentation",
  ).map((r) => [r.company, r.title, r.start, r.end]),
  [
    ["Example Corporation", "SAP OTC Lead", "Jun 2021", "Mar 2022"],
    ["Second Corporation", "SAP Functional Expert", "Jan 2018", "Jun 2021"],
  ],
);
assert.deepEqual(
  read(
    "List of professional positions Period Organisation Description of activities Jan 2025 - Jan 2024 Example Services Ltd Consultant Project Details Jan 2020 - Dec 2022 Buyer Ltd SAP Consultant",
  ),
  [],
);
console.log("career ledger batch and row ownership: PASS");
