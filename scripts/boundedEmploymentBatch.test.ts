import assert from "node:assert/strict";
import { boundedEmploymentBatch as read } from "../lib/boundedEmploymentBatch";
import { extractCanonicalEmploymentFromResume as canonical } from "../lib/candidate360Employment";

const sentence =
  "Worked as SAP FI/CO Consultant for Example Systems Pvt. Ltd. from 3rd Aug 2009 to 15th Nov 2011. Worked at Example Labs as SAP Consultant (Jan 2012 - Dec 2013). Working for Example Group from Jan 2014 to Present.";
assert.deepEqual(
  read(sentence).map((j) => [j.company, j.title, j.start, j.end]),
  [
    [
      "Example Systems Pvt. Ltd.",
      "SAP FI/CO Consultant",
      "3 Aug 2009",
      "15 Nov 2011",
    ],
    ["Example Group", "", "Jan 2014", "Present"],
    ["Example Labs", "SAP Consultant", "Jan 2012", "Dec 2013"],
  ],
);
assert.equal(canonical(sentence).length, 3);
assert.equal(
  read(
    "Worked with Example Systems as SAP Consultant from November03,2022 to June15,2023.",
  )[0].start,
  "03 November 2022",
);
const card =
  "Jan 2012 - Oct 2018 (99 years 1 month) SAP Business Analyst Example Shared Services | Metro City Industry Insurance Specialization IT/Computer - Software Role System Analyst Position Level Senior Executive Responsibilities: support. 2007 - Jan 2010 (3 years 1 month) Consultant Example Group Industry Technology Specialization IT/Computer - Software Role Programmer Position Level Senior Executive";
assert.deepEqual(
  read(card).map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Shared Services", "SAP Business Analyst", "Jan 2012", "Oct 2018"],
    ["Example Group", "Consultant", "2007", "Jan 2010"],
  ],
);
assert.equal(canonical(card).length, 2);
assert.equal(
  read(
    "Dec 2013 - 2015 Systems/SAP Executive Example Group Industry Manufacturing Specialization IT/Computer Role IT Executive Position Level Senior Executive",
  )[0].end,
  "2015",
);
const labels =
  "EXPERIENCE Company : Example Group Position : HR Digital Lead Specialization : HRIS Duration : August 2021 – Current Job Scopes: support. Company : Example Systems Position : Project Manager Duration : July 2019 – July 2021 Project: Rollout Client: Buyer Role: SAP Consultant Duration: Jan 2020 - June 2020";
assert.deepEqual(
  read(labels).map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Group", "HR Digital Lead", "August 2021", "Present"],
    ["Example Systems", "Project Manager", "July 2019", "July 2021"],
  ],
);
assert.ok(!read(labels)[0].excerpt.includes("Job Scopes"));
assert.equal(canonical(labels).length, 2);
const ledger =
  "Professional Experience Project Manager July 2019 – Present Example Consulting SAP Project Manager Apr 2017 – April 2019 Example ERP Solutions Inc. SAP Project Manager Feb 2016 – Apr 2017 Example Enterprise SAP Materials Management Consultant Sep 2014 – Jan 2016 Example Enterprise SAP Consultant Jan 2011 - Aug 2011 Example Group Responsibilities: duties";
assert.deepEqual(
  read(ledger).map((j) => [j.company, j.title]),
  [
    ["Example Consulting", "Project Manager"],
    ["Example ERP Solutions Inc.", "SAP Project Manager"],
    ["Example Enterprise", "SAP Project Manager"],
    ["Example Enterprise", "SAP Materials Management Consultant"],
  ],
);
for (const source of [
  "Work Experience SAP SD Consultant Example Systems Jan 2020 - Aug 2021 Project: rollout",
  "Work Experience Example Systems — SAP SD Consultant Jan 2020 - Aug 2021 Project: rollout",
  "Work Experience Jan 2020 - Aug 2021 SAP SD Consultant Example Systems Project: rollout",
]) {
  assert.equal(read(source)[0]?.company, "Example Systems", source);
  assert.equal(canonical(source).length, 1, source);
}
assert.deepEqual(
  canonical("Professional Work Experience Executive, Communications & Engagement | Example National Energy Berhad (ENERGYCO) August 2019 – Present Education").map((job) => [job.company, job.title, job.start, job.end, job.current]),
  [["Example National Energy Berhad (ENERGYCO)", "Executive, Communications & Engagement", "August 2019", "Present", true]],
);
assert.equal(
  canonical("WORK EXPERIENCE Jan 2022 - Now Deputy Manager | Example Systems Jan 2018 - Now Project Manager | Example Systems Aug 2015 - Now Senior Business Analyst | Example Systems").length,
  3,
  "date-first rows must not borrow the following role's period",
);
for (const bad of [
  "Client: Worked at Example Systems from Jan 2020 to Dec 2021.",
  "Worked at Example Systems from Dec 2025 to Mar 2025.",
  "Worked at Example Systems from Jan 2020.",
  "Worked as SAP Consultant at Example Systems Ltd, Pay roll of Example Payroll from Jan 2020 to Dec 2021.",
  "Project Experience Company: Buyer Position: SAP Consultant Duration: Jan 2020 - Dec 2021",
  "Work Experience Project: Rollout Company: Buyer Position: SAP Consultant Duration: Jan 2020 - Dec 2021",
  "Work Experience Company: Example Group Position: SAP Consultant Client: Buyer Jan 2020 - Dec 2021 Duration: Jan 2020 - Dec 2021",
  "Work Experience Company: Example Group Position: SAP Consultant Project: Buyer Duration: Jan 2020 - Dec 2021",
  "Work Experience Example Brand Software Developer Jun 2010 - Nov 2012 Other Brand Analyst Jan 2013 - Jan 2014 Final Brand",
  "Work Experience Example Systems, Country Senior Consultant Jan 2020 - Dec 2021 Responsibilities: duties",
  "Work Experience Jan 2020 - Present Example Systems PROJECT MANAGER Managed Agile/Scrum projects.",
  "Work Experience Jan 2020 - Present SAP Consultant Example Systems Assigned to Client Buyer",
  "Project Experience SAP Consultant | Buyer Corporation August 2019 – Present",
  "Professional Work Experience SAP Consultant | Client Buyer August 2019 – Present",
  "Jan 2020 - Present Senior Analyst SD, PM Example Systems Industry Technology Specialization IT Role Consultant Position Level Senior Executive",
  "Jan 2020 - Present Analyst ProgrammerExample Systems Ltd Industry Technology Specialization IT Role Programmer Position Level Executive",
  "Jan 2020 - Present Analyst Example Systems Industry Technology Responsibilities: duties",
  "Project Duration: Jan 2020 - Present Analyst Example Systems Industry Technology Position Level Senior Executive",
])
  assert.deepEqual(read(bad), [], bad);

const conflicting = canonical(
  "Professional Experience Worked as Software Engineer for Example Buyer from March 2015 to Dec 2015. Project Details: Project 1: Client: Example Buyer Company: Example Systems Ltd Duration: March 2015 to Dec 2015. Position: ABAP Consultant. Version: ECC6.0.",
);
assert.equal(
  conflicting.length,
  1,
  "an explicit company field prevents conflicting client employment from prose",
);
assert.equal(conflicting[0].company, "Example Systems Ltd");
const subset = canonical(
  "Employment History Example Systems (Country), City from Jan 2019 to till date Organization: Example Systems Duration: Feb 2013 to till date Role: SAP Consultant Responsibilities: duties",
);
assert.equal(
  subset.length,
  1,
  "broad repeated employer range cannot supersede existing granular history",
);
assert.equal(subset[0].start, "Jan 2019");

console.log("bounded employment batch: PASS");
