import assert from "node:assert/strict";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
const jobs = (raw_text: string) =>
  normalizeActualCandidateSchema({ raw_text }).enterpriseProfile
    .employmentTimeline;
const source = `Professional Experience
Example Systems\tFeb 2025 - Present
SAP FICO Consultant
Project: Bank interface
Configured integration
Example Services
Feb 2024 - Feb 2025
Software Development Associate (SAP FICO L3 Support)
Education
University\t2019 - 2023
Financial Management`;
assert.equal(jobs(source).length, 2);
assert.equal(jobs(source)[0].company, "Example Systems");
assert.equal(jobs(source)[1].start, "Feb 2024");
assert.equal(
  jobs(source.replace("Professional Experience", "Project Experience")).length,
  0,
);
assert.equal(
  jobs(
    "Professional Experience\nExample Corp | Growth Manager\tRemote\nLaunched regional business\t08/2022 - 05/2025",
  )[0].title,
  "Growth Manager",
);
assert.equal(
  jobs(
    "Professional Experience\nExample Corp | Growth Manager\tRemote\nClient: Example\nProject duration: 08/2022 - 05/2025",
  ).length,
  0,
);
const labels =
  "WORKING EXPERIENCE\nRole\tProject Manager (Project Based)\nEmployer\tExample Consulting\nClient\tCustomer Ltd Jan 2020 – June 2024\nProject\tImplementation";
const pdf = jobs(labels),
  docx = jobs(labels.replace(/\t/g, "\n\n"));
assert.equal(pdf.length, 1);
assert.equal(pdf[0].company, "Example Consulting");
assert.equal(pdf[0].start, "");
assert.equal(pdf[0].end, "");
assert.equal(pdf[0].current, false);
assert.deepEqual(
  pdf.map(({ company, title, start, end }) => ({ company, title, start, end })),
  docx.map(({ company, title, start, end }) => ({
    company,
    title,
    start,
    end,
  })),
);
const wrapped = jobs(
  "EMPLOYMENT SAP PM Consultant\tSeptember 2021 – March\nHISTORY Example Resources Sdn Bhd\t2022\n(Contract for Customer Ltd)",
);
assert.equal(wrapped.length, 1);
assert.equal(wrapped[0].company, "Example Resources Sdn Bhd");
assert.equal(wrapped[0].end, "March 2022");
assert.equal(
  jobs(
    "Employment History\nYear\tEmployer / Company\tRole\tResponsibilities\tYears in Company\nMarch 2013\tExample Ltd\tSAP Consultant\tSupport\t1 year\nApril 2013\tExample Ltd\tSAP Consultant\tTraining\t1 month",
  ).length,
  2,
);
const scope = jobs(
  "EMPLOYMENT HISTORY\nName of Company\tScope of Work\tYear\nExample Ltd Jalan Main Street Website: example.test\tRoles & Responsibilities Roles • Independent SAP ABAP Contractor Responsibilities • Implementation project Projects Involved • Customer\tJan 2016 – Mac 2016",
);
assert.equal(scope.length, 1);
assert.equal(scope[0].company, "Example Ltd");
assert.equal(scope[0].end, "March 2016");
assert.equal(
  jobs(
    "Employment History\nExample Systems\tFeb 2025 - Feb 2024\nSAP Consultant",
  ).length,
  0,
);
assert.equal(
  jobs(
    "Employment History\nDETAILED WORK EXPERIENCES\nExample Systems\nJan 2020 - Dec 2022\nRole: SAP Consultant\nClient: Customer",
  ).length,
  0,
);
assert.equal(
  jobs(
    "Employment History\nCurrent Position, Example Ltd\nFeb 2016 – Present\nEducation\nUniversity, Diploma\nJan 2010 – Feb 2014",
  ).length,
  1,
);
console.log(
  "Layout employment: source boundaries, PDF/DOCX parity, partial dates and client isolation passed",
);
