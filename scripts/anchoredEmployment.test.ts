import assert from "node:assert/strict";
import { anchoredEmployment as read } from "../lib/anchoredEmployment";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";

const ledger =
  "Employment History Jun 2006 – Feb 2011 Example Consulting Sdn Bhd SAP ABAP Consultant March 2011 – Jan 2012 Example Systems SAP ABAP Lead Education Degree";
assert.deepEqual(
  read(ledger).map((j) => [j.company, j.title, j.start, j.end]),
  [
    [
      "Example Consulting Sdn Bhd",
      "SAP ABAP Consultant",
      "Jun 2006",
      "Feb 2011",
    ],
    ["Example Systems", "SAP ABAP Lead", "March 2011", "Jan 2012"],
  ],
);
assert.equal(canonical(ledger).length, 2);
const table =
  "Working Experiences Period of Service Company Designation Aug 2023 – Present Example Consulting Sdn Bhd SAP BW Developer Feb 2023 – Aug 2023 (99 months) Example Systems Sdn Bhd Application Support Analyst Education Degree";
assert.equal(read(table).length, 2);
assert.equal(
  read(table)[1].start,
  "Feb 2023",
  "printed duration never creates an endpoint",
);
assert.equal(
  read(
    "Work Experience Example Consulting Ltd (Jan. 2020 - Dec. 2021) Analyst Develop reports.",
  )[0].title,
  "Analyst",
);
assert.equal(
  read(
    "Work Experience Example Consulting Ltd Jan 2020 - Present Role: specialist assignment with no bounded title",
  )[0].title,
  "",
);
assert.equal(
  read(
    "Work Experiences 1. Example Group April 2014 - present Senior Associate 1 – Indirect Tax Conduct tax reviews.",
  )[0].title,
  "Senior Associate 1 – Indirect Tax",
);
assert.equal(
  read(
    "Career History November 2023 - Present Example Energy SAP Group Reporting Architect – Senior Manager Collaborate with stakeholders.",
  )[0].title,
  "SAP Group Reporting Architect – Senior Manager",
);
assert.equal(
  read(
    "Working Experiences November 2014 - Now Example Consulting Sdn. Bhd. Senior Consultant (ABAP) \uF0A7 Deliver projects.",
  )[0].company,
  "Example Consulting Sdn. Bhd.",
);
assert.equal(
  read(
    "Work Experience Example Consulting Jan 2020 - Present Senior Consultant - Example Regional Jan 2022 - Present Project Accomplishments: rollout",
  )[0].title,
  "",
  "a promotion's date cannot be assigned to the overall tenure",
);
for (const bad of [
  "Employment History DETAILED WORK EXPERIENCES Example Systems Jan 2020 - Dec 2022 Role: SAP Consultant Client: Customer",
  "Project Work Experience Example Consulting Ltd Jan 2020 - Present Analyst Develop reports.",
  "Work Experience Project Experience Example Consulting Ltd Jan 2020 - Present Analyst Develop reports.",
  "Work Experience Client: Example Consulting Ltd Jan 2020 - Present Analyst Develop reports.",
  "Work Experience Date Company Name Role Jan 2020 - Present Client Buyer SAP Consultant",
  "Work Experience Period Jan 2020 - Present Analyst Develop reports.",
  "Work Experience Metro City, Country Jan 2020 - Present Migrating data for clients.",
  "Work Experience Example Consulting Ltd Jan 2020 - Present Project Description SAP implementation for client.",
  "Work Experience Example Consulting Ltd Jan 2022 - Dec 2021 Analyst Develop reports.",
  "Work Experience Example Consulting Ltd Jan 2020 - Analyst Develop reports.",
  "Work Experience 5 1 Example Consulting Ltd Jan 2020 - Present Analyst Develop reports.",
  "Work Experience Degree from Example University Jan 2020 - Dec 2021 Analyst Develop reports.",
])
  assert.equal(read(bad).length, 0, bad);
const projectTail = ledger.replace(
  " Education Degree",
  " Responsibilities: managed projects Jan 2018 - Dec 2021 Client Buyer SAP Consultant",
);
assert.equal(
  read(projectTail).length,
  2,
  "never resynchronize inside project prose",
);
const numbered =
  "Employment History 1. Example Consulting Sdn Bhd July 2012 - Present Position Title (Level) : SAP BW Managing Consultant (Freelance) (Manager) Role : Functional Consultant Industry : Telecom Responsibility narrative.";
assert.equal(
  canonical(numbered).length,
  1,
  "owned heading cannot create an untitled duplicate",
);
assert.equal(
  canonical(numbered)[0].title,
  "SAP BW Managing Consultant (Freelance) (Manager)",
);
const footer =
  "EMPLOYMENT HISTORY Date Company Name Role Apr 2000 - Aug 2000 Example Inc. (Example Country) Senior Consultant (FICO) Example Person P a ge |11 Date Company Name Role Sep 2000 - May 2005 Example Systems Sdn Bhd Senior Consultant (FICO) EDUCATION Degree";
assert.deepEqual(
  canonical(footer).map((j) => j.title),
  ["Senior Consultant (FICO)", "Senior Consultant (FICO)"],
);

console.log("anchored employment: PASS");
