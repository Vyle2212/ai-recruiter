import assert from "node:assert/strict";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const jobs = (raw_text: string) =>
  normalizeActualCandidateSchema({ raw_text }).enterpriseProfile
    .employmentTimeline;

const source =
  "Employment History " +
  "Date: January 2017 – Present Company: Example Consulting Role: SAP FICO Consultant " +
  "Date: January 2015 – January 2017 Company: Example Systems Role: SAP Analyst " +
  "Education University";
const rows = jobs(source);
assert.equal(rows.length, 2);
assert.equal(rows[0].company, "Example Consulting");
assert.equal(rows[0].title, "SAP FICO Consultant");
assert.equal(rows[0].current, true);
assert.equal(rows[1].start, "January 2015");
assert.equal(rows[1].end, "January 2017");

assert.equal(
  jobs(source.replace("Employment History", "Project History")).length,
  0,
);
assert.equal(
  jobs(
    "Employment History Date: January 2017 – Present Company: Client: Example Role: SAP Consultant",
  ).length,
  0,
);
assert.equal(
  jobs(
    "Employment History Date: January 2025 – January 2020 Company: Example Consulting Role: SAP Consultant",
  ).length,
  0,
);
assert.equal(
  jobs(
    "Employment History Date: January 2017 – Present Company: Example Consulting Role: Project Alpha",
  ).length,
  0,
);

const compactDates = jobs(
  "Working Experience Example Services (Feb2019 – Present) Position: SAP MM Consultant Description: Implementation. " +
    "Example Systems (Nov2016 – Feb2019) Position: SAP Analyst Description: Support. Education University",
);
assert.equal(compactDates.length, 2);
assert.equal(compactDates[0].start, "Feb 2019");
assert.equal(compactDates[1].end, "Feb 2019");

const numbered = jobs(
  "Employment History 1. Example Industries Position Title: SAP Senior Consultant " +
    "Specialization: ERP Working Period: July 2015 - Present Responsibilities: Support. " +
    "2. Example Holdings Position Title: SAP Analyst Specialization: IT " +
    "Working Period: July 2014 until January 2015 Education University",
);
assert.equal(numbered.length, 2);
assert.equal(numbered[0].company, "Example Industries");
assert.equal(numbered[1].end, "January 2015");

assert.equal(
  jobs(
    "Project History 1. Example Industries Position Title: SAP Consultant Specialization: ERP Working Period: July 2015 - Present",
  ).length,
  0,
);

console.log(
  "Date/company/role employment: repeated rows, section isolation and range validation passed",
);
