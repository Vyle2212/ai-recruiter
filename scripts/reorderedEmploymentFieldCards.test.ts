import assert from "node:assert/strict";
import { extractCanonicalEmploymentFromResume } from "../lib/candidate360Employment";
import { reorderedEmploymentFieldCards } from "../lib/reorderedEmploymentFieldCards";

const rows = (source: string) =>
  reorderedEmploymentFieldCards(source).map((item) => [
    item.company,
    item.title,
    item.start,
    item.end,
  ]);

assert.deepEqual(
  rows(`WORK EXPERIENCE
Date From: August 2020
Date To: Current
Company Served: Example Delivery Sdn Bhd
Position: SAP Consultant`),
  [["Example Delivery Sdn Bhd", "SAP Consultant", "August 2020", "Current"]],
);

assert.deepEqual(
  rows(`EMPLOYMENT HISTORY
December 2013 to Present
Employer: Example Services Ltd
Designation: SAP Basis Engineer
Project: Synthetic rollout`),
  [["Example Services Ltd", "SAP Basis Engineer", "December 2013", "Present"]],
);

assert.deepEqual(
  rows(
    "Company Name: Example Owned Ltd Job Title: SAP Basis Administrator Duration: Jan 2021 - Dec 2022",
  ),
  [["Example Owned Ltd", "SAP Basis Administrator", "Jan 2021", "Dec 2022"]],
);

for (const source of [
  `EMPLOYMENT HISTORY December 2013 to Present Client: Synthetic Buyer Ltd Employer: Example Services Ltd Role: SAP Consultant`,
  `EMPLOYMENT HISTORY December 2013 to Present Employer: Example Services Ltd Client: Synthetic Buyer Ltd Role: SAP Consultant`,
  `EMPLOYMENT HISTORY December 2024 to January 2024 Employer: Example Reversed Ltd Role: SAP Consultant`,
  `EMPLOYMENT HISTORY December 2013 to Present Employer: Example Services Ltd Role: Project Alpha`,
  `PROJECT EXPERIENCE December 2013 to Present Employer: Example Services Ltd Role: SAP Consultant`,
])
  assert.deepEqual(rows(source), []);

assert.deepEqual(
  rows(`EMPLOYMENT HISTORY
December 2013 to Present
Employer: Example Services Ltd
Role: SAP Consultant
January 2010 to November 2013
Employer: Example Earlier Ltd`),
  [["Example Services Ltd", "SAP Consultant", "December 2013", "Present"]],
);

assert.equal(
  extractCanonicalEmploymentFromResume(`WORK EXPERIENCE
Date From: August 2020
Date To: Current
Company Served: Example Delivery Sdn Bhd
Position: SAP Consultant`).length,
  1,
);

console.log(
  "reordered employment cards: ownership, date and adjacent-card boundaries pass",
);
