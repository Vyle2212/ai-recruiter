import assert from "node:assert/strict";
import { normalizeActualCandidateSchema as normalize } from "../lib/candidate360SchemaNormalize";
import { renderDocxText } from "../lib/docxTextLayout";

const jobs = (raw_text: string) =>
  normalize({ raw_text }).enterpriseProfile.employmentTimeline;

const iso = jobs(`Work History
2022-10 - 2024-03\tBusiness Process Associate Consultant
Example Services
2021-05 - 2021-11\tIT Application Expert - SAP Test Automation
Earlier Services
Education
2012-04 - 2017-07\tEngineering Student
Example University`);
assert.deepEqual(
  iso.map((j) => [j.company, j.title, j.start, j.end]),
  [
    ["Example Services", "Business Process Associate Consultant", "2022-10", "2024-03"],
    ["Earlier Services", "IT Application Expert - SAP Test Automation", "2021-05", "2021-11"],
  ],
);

const hr = jobs(`Work Experience
April 2022- Present
Example Nasional Berhad (ENB)
Team Lead, Talent Sourcing and Services
Key Responsibilities:
Provided support and advice to relevant stakeholders at all levels within the organization pertaining to recruitment.
January 2015 – September 2018
Example Shared Service Centre
Senior Generalist, Human Resources
May 2007 – April 2009
Example Bank Berhad
Junior Recruiter, Human Resources
Referees:`);
assert.equal(hr.length, 3);
assert.equal(hr[0].company, "Example Nasional Berhad (ENB)");
assert.equal(hr[0].title, "Team Lead, Talent Sourcing and Services");

assert.equal(
  jobs(`Work Experience
6/2017 – 6/2018, Singapore
SAP Certified Application Associate
7/2011 – 5/2017, Singapore
AMS and Enterprise Support Consultant
Support day to day issues reported by following SLA
Designed and implemented change request for continuous improvements in process 11/2006 – 05/2007`).length,
  0,
);

const cell = (value: string) => ({
  type: "tableCell",
  children: [{ type: "paragraph", children: [{ type: "text", value }] }],
});
const row = (...values: string[]) => ({ type: "tableRow", children: values.map(cell) });
const text = renderDocxText({
  type: "document",
  children: [
    { type: "paragraph", children: [{ type: "text", value: "CAREER BACKGROUD" }] },
    {
      type: "table",
      children: [
        row("Company", "Job Title", "Project", "Duration"),
        row("Example Consulting\n(Malaysia)", "SAP BW\nConsultant", "Client Power 2004 EBS Upgrade", "2006 - 2007"),
        row("Earlier Consulting", "SAP ABAP Consultant", "Client One implementation", "2005 (2nd 6 months)"),
        row("First Consulting", "SAP ABAP Consultant", "Client Two implementation", "2005 (1st 6 months)"),
      ],
    },
  ],
});
assert.deepEqual(
  jobs(text).map((j) => [j.company, j.start, j.end]),
  [
    ["Example Consulting (Malaysia)", "2006", "2007"],
    ["Earlier Consulting", "Jul 2005", "Dec 2005"],
    ["First Consulting", "Jan 2005", "Jun 2005"],
  ],
);
assert(!jobs(text).some((j) => /Client|2004/.test(j.company)));
console.log("Original career layouts PASS");
