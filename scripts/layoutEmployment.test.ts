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

const numericHistory = `EMPLOYMENT HISTORY
03. 2023 - 02. 2025
Communications & Marketing Specialist
Example Bank
Client: Customer Ltd
04.2021 - 02.2023
Account executive
Example Agency`;
assert.deepEqual(
  jobs(numericHistory).map((j) => [
    j.company,
    j.title,
    j.start.toLowerCase(),
    j.end.toLowerCase(),
  ]),
  [
    [
      "Example Bank",
      "Communications & Marketing Specialist",
      "mar 2023",
      "feb 2025",
    ],
    ["Example Agency", "Account executive", "apr 2021", "feb 2023"],
  ],
);
assert.equal(
  jobs(numericHistory.replace("EMPLOYMENT HISTORY", "Project History")).length,
  0,
);
assert.equal(
  jobs(numericHistory.replace("03. 2023 - 02. 2025", "03.2025 - 02.2023"))
    .length,
  1,
);
const partialTable = jobs(`Employment History:
Date\tCompany Name\tRole
Jan 2023\tExample Ltd\tSAP Consultant
Dec 2021\tPrevious Ltd\tBasis Consultant
Skills:
Feb 2020\tNot An Employer\tSAP Consultant`);
assert.equal(partialTable.length, 2);
assert.ok(
  partialTable.every((j) => j.start && !j.end && !j.current && !j.duration),
);
const wrappedSource = `Professional Experience
Example Consulting
Jan 2022
Senior Associate – SAP MM
-Present
Responsibilities
Earlier Ltd
SAP Consultant\tMarch
2016-Dec
Material Management\t2021
Education
University`;
assert.deepEqual(
  jobs(wrappedSource).map((j) => [j.company, j.start, j.end]),
  [
    ["Example Consulting", "Jan 2022", "Present"],
    ["Earlier Ltd", "March 2016", "Dec 2021"],
  ],
);
assert.equal(
  jobs(wrappedSource.replace("-Present", "Project: Present")).length,
  1,
);
assert.deepEqual(
  jobs(
    `Professional Experience\nEarlier Ltd\nJuly 2015 -\nBusiness System Analyst\nJanuary\n2016`,
  ).map((j) => [j.start, j.end]),
  [["July 2015", "January 2016"]],
);
const served = jobs(`Professional Experience
Example Systems Ltd, City (Jan 2020 to Present) – 3 YEARS
Served as Senior Technical Consultant to deliver support.
Previous Ltd, City (Jan 2018 to Dec 2019) – 2 YEARS
Served as Remote Technical Support for regional customers.
Education
University`);
assert.deepEqual(
  served.map((j) => [j.company, j.title]),
  [
    ["Example Systems Ltd", "Senior Technical Consultant"],
    ["Previous Ltd", "Remote Technical Support"],
  ],
);
const proseBeforeDate = jobs(`Work Experience
Client list: Customer North,
Customer South, and Customer East.
May 2020 - Present -
Solution Advisor
Example Consulting Ltd
Responsible for services.
May 2018 - May 2020
Solution Advisor
Earlier Consulting Ltd
Hobbies
June 2017 - May 2018
Manager
Sports Club`);
assert.deepEqual(
  proseBeforeDate.map((j) => j.company),
  ["Example Consulting Ltd", "Earlier Consulting Ltd"],
);
assert.equal(
  jobs(
    `Work Experience\nJan 2020 - Current\nSAP Consultant\nClient: Example Bank`,
  ).length,
  0,
);
assert.equal(
  jobs(`Employment History\nDec 2025 - Mar 2025\nSAP Consultant\nExample Ltd`)
    .length,
  0,
  "Never roll a reversed endpoint forward without a reviewed correction",
);
const curr = jobs(
  `Work Experience\nJan 2021 - CURR\nSAP Consultant\nExample Ltd`,
);
assert.equal(curr.length, 1);
assert.equal(curr[0].current, true);
assert.equal(
  jobs(`Work Experience\n2021 ARIL - CURR\nSAP Consultant\nExample Ltd`).length,
  0,
  "Current does not prove the misspelled starting month",
);
assert.deepEqual(
  jobs(
    `Professional Experience\nMay-Sept\nExample Ltd\n2013\nTrainee (Internship) - Application Development`,
  ).map((j) => [j.company, j.start, j.end]),
  [["Example Ltd", "May 2013", "Sept 2013"]],
);
const undated = jobs(
  `Working Experience\nHousekeeper at Example Resort, City, Country.\nPromoter at Example Retail selling products\nUsher for Musical 2016 at Example Theatre\nTechnical Skill set\nOffice software`,
);
assert.deepEqual(
  undated.map((j) => [j.company, j.title, j.start, j.end, j.current]),
  [
    ["Example Resort", "Housekeeper", "", "", false],
    ["Example Retail", "Promoter", "", "", false],
  ],
);
assert.equal(
  jobs(`Project History\nHousekeeper at Example Resort, City, Country.`).length,
  0,
);
assert.deepEqual(
  jobs(`PROFESSIONAL EXPERIENCE
Example Consulting Ltd | SAP FICO Consultant | January 2022 - Present
Earlier Services Ltd | SAP Finance Analyst | January 2018 - December 2021`).map(
    (j) => [j.company, j.title],
  ),
  [
    ["Example Consulting Ltd", "SAP FICO Consultant"],
    ["Earlier Services Ltd", "SAP Finance Analyst"],
  ],
  "A complete pipe-delimited job must never become the title of the next employer",
);
