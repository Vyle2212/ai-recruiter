import { careerMonthIndex } from "../lib/candidateCareerExperience";
import assert from "node:assert/strict";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
import { evaluateCandidateExtractionCoverage } from "../lib/candidateExtractionCoverage";
import { nestedResumeHistory } from "../lib/nestedResumeHistory";
import { narrativeResumeEmployment } from "../lib/nestedResumeHistory";

const narrativeEmploymentSource = `WORK EXPERIENCE:
Worked with Example Consulting as SuccessFactors Consultant (contract) from November 2016 to Dec 2018.
Worked with Second Consulting Ltd. as Senior SuccessFactors Consultant from December 2018 – Oct 2019.
Working with Confidential as Senior SuccessFactors Consultant since Oct 2019.
Duration: Oct 2019 - Present
Client: Example Customer
`;
const narrativeEmployment = narrativeResumeEmployment(
  narrativeEmploymentSource,
);
assert.equal(narrativeEmployment.length, 3);
assert.equal(narrativeEmployment[0].end_date, "Dec 2018");
assert.equal(narrativeEmployment[0].current, false);
assert.equal(narrativeEmployment[2].current, true);
assert.equal(narrativeEmployment[2].end_date, "Current");
assert.equal(narrativeEmployment[2].company, "Confidential");
assert.equal(narrativeEmployment[2].start_date, "Oct 2019");
assert.equal(
  narrativeResumeEmployment(
    "WORK EXPERIENCE:\nWorked with Undated Company as SAP Consultant since Jan 2015.",
  ).length,
  0,
);
assert.equal(
  narrativeResumeEmployment(
    narrativeEmploymentSource.replace(
      "Duration:",
      "Jan 2020 - Dec 2021\nDuration:",
    ),
  ).length,
  0,
  "Mixed employment layout cannot silently drop additional dated records",
);
assert.equal(
  narrativeResumeEmployment(
    "Client: X\nWorked with X as SAP Consultant from Jan 2020 - Dec 2021.",
  ).length,
  0,
);

// Anonymized institution-first CV with projects nested beneath legal employers.
const source = `Example Person
Jl. Example Boulevard No.01, Example City, 12345
+6281800000000, example@example.com
EDUCATION
INSTITUT EXAMPLE TECHNOLOGY,
University City, Indonesia August 2019
Sarjana Teknik Industri. Concentration: Industrial Management
GPA 3.51
EXPERIENCE
PT. Example Consulting, Employer City November 2022 – Present
A global management consulting and professional services firm.
Business and Integration Associate Manager, Technology
SAP S/4HANA Roll Out New Company at Confidential Petrochemical Company
July 2026 – Present (Target Go Live: Jan 2027)
As a FI and FSCM Team Lead, responsibilities included:
• Prepared blueprint, testing and go-live support.
SAP S/4HANA Greenfield Implementation at Large Paper Manufacturer
Company
November 2022 – March 2024
As a FSCM Team, responsibilities included:
• Configuration and testing.
PT. Previous Consulting, Employer City October 2019 – November 2022
A trusted SAP consulting partner.
FI Functional Consultant Associate, Application Management Services Department
Application Management Service Division
March 2021 – Nov 2023
As a FI Team Member, responsibilities included:
• Managing more than 10 unnamed clients.
Migration SAP ECC6 to ECC EHP8 Suite on HANA at Example Group
October 2019 – January 2020
As a SAP FI Consultant Trainee, Responsibilities include:
• Documenting and reporting UAT results.
Additional Information
Accounting training November 2019 – February 2020`;
const p = enrichCandidateUpload({}, source);
assert.equal(p.experience.length, 2);
assert.equal(p.projects.length, 4);
assert.equal(p.current_company, "PT. Example Consulting, Employer City");
assert.equal(
  p.current_title,
  "Business and Integration Associate Manager, Technology",
);
assert.equal(p.projects[0].start_date, "July 2026");
assert.equal(p.experience[0].start_date, "November 2022");
assert.equal(p.projects[0].end_date, "Present");
assert.equal(p.projects[0].current, true);
assert.equal(p.projects[0].project_type, "Rollout");
assert.equal(p.projects[1].client, "Large Paper Manufacturer Company");
assert.equal(p.projects[2].client, "");
assert.equal(p.projects[2].project_type, "AMS");
assert.equal(p.projects[2].end_date, "Nov 2023"); // Preserve inconsistent source dates.
assert.equal(p.projects[3].project_type, "Migration");
assert.equal(p.projects[3].employer, p.experience[1].employer);
assert.equal(p.education.length, 1);
const education = p.education[0];
assert.ok(
  typeof education === "object" &&
    "graduation_year" in education &&
    "field_of_study" in education,
);
assert.equal(education.graduation_year, "2019");
assert.equal(education.field_of_study, "Industrial Management");
assert.match(p.location, /Example City/);
assert.deepEqual(p.languages, []); // Do not infer language from university country.
for (const token of ["Current", "Curr", "Now", "Until Now", "At the present"]) {
  const alternate = enrichCandidateUpload(
    {},
    source.replaceAll("Present", token),
  );
  assert.equal(alternate.projects[0].end_date, token);
  assert.equal(alternate.projects[0].current, true);
}
const missing = evaluateCandidateExtractionCoverage(source, {
  ...p,
  projects: p.projects.slice(0, 1),
  project_history: p.projects.slice(0, 1),
});
assert.ok(missing.missedObservedSections.includes("projects"));
const unresolved = source.replace(
  "Business and Integration Associate Manager, Technology",
  "Unspecified occupation",
);
assert.equal(nestedResumeHistory(unresolved), null);
assert.ok(
  evaluateCandidateExtractionCoverage(unresolved, {
    projects: [],
  }).missedObservedSections.includes("projects"),
);
assert.equal(
  nestedResumeHistory("EXPERIENCE\nJan 2020 - Present\nSAP Consultant"),
  null,
);
console.log("nested employer/project history regressions passed");

const labelled = `Example Person
EXPERIENCE
Example Services Sdn. Bhd. Oct 2012 - Present
Senior Analyst
Project: SAP BI implementation
Duration: October - November 2012
Roles and responsibilities:
Installed and configured SAP BI.
Project: SAP PI upgrade
Client: Example Manufacturing
Duration: December 2012 - Present
Role: SAP BASIS Consultant
Configured the application landscape.
Previous Consulting (SEA) Jun 2011 - Sept 2012
SAP BASIS Consultant
Assigned as a SAP BASIS support consultant to the projects below:
Project: Finance Transformation
Client: Example Semiconductors
Duration: January 2012 until August 2012
Installed SAP systems.
EDUCATION
Bachelor of Computing`;
const labelledResult = enrichCandidateUpload({}, labelled);
assert.equal(labelledResult.experience.length, 2);
assert.equal(labelledResult.projects.length, 3);
assert.equal(labelledResult.projects[0].name, "SAP BI implementation");
assert.equal(labelledResult.projects[0].start_date, "October 2012");
assert.equal(labelledResult.projects[0].end_date, "November 2012");
assert.equal(labelledResult.projects[0].role, ""); // Keep identified partial cards; do not invent a project role.
assert.equal(labelledResult.projects[1].name, "SAP PI upgrade");
assert.equal(labelledResult.projects[1].client, "Example Manufacturing");
assert.equal(labelledResult.projects[1].role, "SAP BASIS Consultant");
assert.equal(labelledResult.projects[2].role, "SAP BASIS support consultant");
assert.equal(labelledResult.projects[2].employer, "Previous Consulting (SEA)");
assert.equal(labelledResult.projects[2].end_date, "August 2012");
assert.ok(
  evaluateCandidateExtractionCoverage(
    labelled,
    labelledResult,
  ).missedObservedSections.includes("projects"),
);

const tableSource = `Example Person
Employment History:
Company
Example Technologies Ltd.
Location
Example City
Designation
Associate Consultant
Duration
April 4th 2012- May 29th 2015
Professional Experience:
Selected Project Experience
Project 3:
Client\tExample Bank, United Kingdom
Project\tImplementation & Support - BO, BI
Duration\tJAN‘13 – May’15
Position\tAssociate Consultant / BI Support
Responsibilities
Configured SAP reporting systems.
Project 2:
Client\tExample Manufacturing
Project\tSAP BI implementation
Duration\tMay 2012 - Dec 2012
Position\tBI Consultant
Responsibilities
Configured reporting systems.
Education
Bachelor of Computing`;
const tableResult = enrichCandidateUpload({}, tableSource);
assert.equal(tableResult.experience.length, 1);
assert.equal(tableResult.experience[0].employer, "Example Technologies Ltd.");
assert.equal(tableResult.experience[0].start_date, "April 4th 2012");
assert.equal(tableResult.experience[0].end_date, "May 29th 2015");
assert.equal(tableResult.projects.length, 2);
const bankProject = tableResult.projects.find(
  (row) => row.client === "Example Bank, United Kingdom",
);
assert.ok(bankProject);
assert.equal(bankProject.start_date, "JAN 13");
assert.equal(
  tableResult.projects.find((row) => row.client === "Example Manufacturing")
    ?.end_date,
  "Dec 2012",
);
assert.equal(bankProject.role, "Associate Consultant / BI Support");

assert.equal(careerMonthIndex("April 4th 2012"), 2012 * 12 + 3);
assert.equal(careerMonthIndex("February 31st 2012"), null);
const narrativeProject = enrichCandidateUpload(
  { name: "Example Person" },
  `
EMPLOYMENT HISTORY
Example Consulting Ltd.
Position Title: SAP ABAP Consultant
Duration: Jan 2015 - Present
Project: GST implementation
- Involved as technical coordinator & ABAP developer
- Environment: SAP FI/CO, SD & MM
Other Services Ltd.
Position Title: SAP BW Consultant
Duration: Nov 2012 - Dec 2014
Client: Must Not Borrow
Declaration
Company
`,
);
assert.equal(
  narrativeProject.experience.length,
  2,
  "A stray Company label cannot suppress employment cards",
);
const gstProject = narrativeProject.projects.find(
  (row) => row.name === "GST implementation",
);
assert.ok(gstProject, "Explicit narrative project role must not be omitted");
assert.equal(gstProject.role, "technical coordinator & ABAP developer");
assert.equal(
  gstProject.start_date,
  "",
  "Employment dates cannot fill undated project",
);
assert.equal(gstProject.end_date, "");
assert.equal(
  gstProject.client,
  "",
  "Next employer's client cannot fill prior project",
);
assert.ok(
  evaluateCandidateExtractionCoverage(tableSource, {
    ...tableResult,
    projects: [],
    project_history: [],
  }).missedObservedSections.includes("projects"),
);

// Deidentified qualification-first table: absent years remain absent.
const degreeTable = `SAP Consultant
Education
Qualification	Institution
Masterof Computer Application	Example University
Bachelor of Computer Application	Second University
Project Undertaken
Bachelor of Project Management	Client University
Jan 2020 - Present`;
const degrees = enrichCandidateUpload({}, degreeTable).education;
assert.equal(degrees.length, 2);
assert.ok(
  typeof degrees[0] === "object" &&
    "qualification" in degrees[0] &&
    "graduation_year" in degrees[0],
);
assert.ok(typeof degrees[1] === "object" && "graduation_year" in degrees[1]);
assert.equal(degrees[0].qualification, "Masterof Computer Application");
assert.equal(degrees[0].institution, "Example University");
assert.equal(degrees[0].graduation_year, "");
assert.equal(degrees[1].graduation_year, "");
assert.equal(
  enrichCandidateUpload(
    {},
    degreeTable.replace("Example University", "Client: Example University"),
  ).education.some(
    (row: any) => row.institution === "Client: Example University",
  ),
  false,
);

// Source-owned education layouts; no institution or year from neighbouring jobs.
const educationLayouts = [
  `Qualification
Qualification: Professional Degree Field of Study: Computer Science Major: IT Institute/University: Example University Grade: Grade B Graduation Date: 2001
Qualification: Primary/Secondary School/SPM/"O" Level Field of Study: Science Major: - Institute/University: Example Secondary School Grade: Grade A Graduation Date: 1995`,
  `Qualification:
Qualification
Major
University
Graduation Year
: Bachelor of Accountancy (Hons)
: Accountancy
: Example University, Malaysia.
: 2000
Professional Certification:
Certification Date: 2010`,
  `Education
Qualification
Bachelor's Degree of Computer Science
College
Example College
Graduation Date
March 2005
Languages
English`,
  `Education
Qualification
Bachelor’s Degree (Hons) of IT
Example University, Example City (May 2002 - May 2006)
Experience
SAP Consultant Jan 2009 - Present`,
  `EDUCATION
CERTIFICATION
SAP Support Associate — 2011
Example College
Diploma in Software Engineering — 2002`,
];
for (const [index, text] of educationLayouts.entries()) {
  const rows = enrichCandidateUpload({}, text).education;
  assert.equal(rows.length, index === 0 ? 2 : 1);
  assert.ok(typeof rows[0] === "object" && "graduation_year" in rows[0]);
  assert.equal(
    rows[0].graduation_year,
    ["2001", "2000", "2005", "2006", "2002"][index],
  );
}
const undatedEducation = enrichCandidateUpload(
  {},
  `Education
Qualification
Bachelor of Computing
College
Example College
Employment History
Example Consulting
Jan 2018 - Present`,
).education;
assert.ok(
  typeof undatedEducation[0] === "object" &&
    "graduation_year" in undatedEducation[0],
);
assert.equal(undatedEducation[0].graduation_year, "");

const projectLedger = `Senior BI Consultant
Employment History
Example Services
Jan 2014 - Present
Selected project experience
Example Automotive Customer
SVCRM - BW7.4/BI4.2 Reporting – Track R3.1 June 2016 – May 2017
SVCRM - BW7.5 on HANA/BI4.2 Reporting – Track R4.0 April 2016 – Now
SVCRM - BW7.5 on HANA/BI4.2 Reporting – Track R4.1 Aug 2017 – Now
• Implemented SAP reporting Jan 2010 - Dec 2011
Education
SAP BW Reporting Track Training Jan 2020 - Present`;
const ledger = enrichCandidateUpload({}, projectLedger).projects;
const tracks = ledger.filter((row) => String(row.name).includes("Track R"));
assert.equal(tracks.length, 3);
assert.equal(tracks.filter((row) => row.current === true).length, 2);
for (const row of tracks) {
  assert.equal(row.role, "");
  assert.equal(row.client, "");
  assert.equal(row.employer, "");
}
assert.equal(
  enrichCandidateUpload(
    {},
    projectLedger.replace("Selected project experience", "Employment History"),
  ).projects.some((row) => String(row.name).includes("Track R")),
  false,
);
assert.equal(
  enrichCandidateUpload(
    {},
    projectLedger.replace("June 2016 – May 2017", "June 2018 – May 2017"),
  ).projects.some((row) => String(row.name).includes("R3.1")),
  false,
);

const combinedCards = `SAP MM Consultant
Project: SAP Implementation
Client: Example Manufacturing
Module / Role: MM / Functional Consultant
Duration: Jan 2014 - Current
Project: SAP Finance Rollout
Client: Example Finance
Module / Role: FI/CO / Lead Consultant
Project Duration: Feb 2015 - Now
Education
Bachelor of Computing`;
const combinedProjects = enrichCandidateUpload({}, combinedCards).projects;
for (const [name, role, modules, start] of [
  ["SAP Implementation", "Functional Consultant", ["MM"], "Jan 2014"],
  ["SAP Finance Rollout", "Lead Consultant", ["FI", "CO"], "Feb 2015"],
] as const) {
  const row = combinedProjects.find(
    (row) => row.name === name && row.role === role,
  );
  assert.ok(row);
  assert.equal(row.start_date, start);
  assert.equal(row.current, true);
  assert.deepEqual(row.modules, [...modules]);
}
assert.equal(
  enrichCandidateUpload(
    {},
    combinedCards.replace("MM / Functional Consultant", "MM / SD"),
  ).projects.some((row) => row.role === "SD"),
  false,
);
assert.equal(
  enrichCandidateUpload(
    {},
    combinedCards.replace("Jan 2014 - Current", "Jan 2025 - Dec 2024"),
  ).projects.some(
    (row) =>
      row.name === "SAP Implementation" && row.role === "Functional Consultant",
  ),
  false,
);

const clientSiteCards = `SAP Consultant
Employment History
Example Employer
Position Title: Senior Analyst
Duration: Jan 2011 - Current
Exposure\tClient: Example Manufacturing
(Client’s Site)\tPosition Title: SAP Data Migration Consultant
Job Role: Data/Functional MM and PM
Duration: Nov 2017 - Current
Exposure\tClient: Example Retail
(Client's Site)\tPosition Title: SAP Data Team
Job Role: Data Conversion
Duration: Jan 2017 - Oct 2017
Client: Example Energy
Job Role: Compliance Analyst
Duration: Oct 2016 - Dec 2016
Next Employer
Position Title: Must Not Borrow
Duration: Jan 2020 - Present
Education
Bachelor of Computing`;
const siteProjects = enrichCandidateUpload({}, clientSiteCards).projects;
for (const [client, role, start] of [
  ["Example Manufacturing", "SAP Data Migration Consultant", "Nov 2017"],
  ["Example Retail", "SAP Data Team", "Jan 2017"],
  ["Example Energy", "Compliance Analyst", "Oct 2016"],
]) {
  const row = siteProjects.find(
    (row) => row.client === client && row.role === role,
  );
  assert.ok(row);
  assert.equal(row.start_date, start);
}
assert.equal(
  siteProjects.some((row) => row.role === "Must Not Borrow"),
  false,
);
const roleBeforeClient = `SAP ABAP Consultant
Role: SAP ABAP Consultant
Environment: SAP ECC6
Client: Example Telecom
Project duration: Jan 2014 - Jun 2014
Role: SAP ABAP Consultant
Environment: SAP ECC6
Client: Example Oil
Project duration: Aug 2012 - Oct 2013
Education
Bachelor of Computing`;
const beforeClientProjects = enrichCandidateUpload(
  {},
  roleBeforeClient,
).projects;
for (const [client, start] of [
  ["Example Telecom", "Jan 2014"],
  ["Example Oil", "Aug 2012"],
]) {
  const row = beforeClientProjects.find(
    (row) => row.client === client && row.role === "SAP ABAP Consultant",
  );
  assert.ok(row);
  assert.equal(row.start_date, start);
}
assert.equal(
  enrichCandidateUpload(
    {},
    roleBeforeClient.replace("Jan 2014 - Jun 2014", "unreadable dates"),
  ).projects.some((row) => row.client === "Example Telecom"),
  false,
);
assert.equal(
  enrichCandidateUpload(
    {},
    `Client: Example Customer
Role: SAP Consultant
Project Duration: unreadable dates
Responsibilities:
Testing Jan 2014 - Jun 2014`,
  ).projects.some((row) => row.client === "Example Customer"),
  false,
);
assert.equal(
  enrichCandidateUpload(
    {},
    `Employment History
Example Employer
Position held: Consultant
Duration: Jan 2010 - Dec 2011
Client: Example Customer
Education`,
  ).projects.some((row) => row.role === "Consultant"),
  false,
);

for (const [duration, expectedStart, expectedEnd] of [
  ["18 months / Project", "", ""],
  ["Seven Days", "", ""],
  ["7 Man Days.", "", ""],
  ["from joining date with the company", "", ""],
  ["February 2007 August 2007", "February 2007", "August 2007"],
  ["(02/2013) till current date", "02/2013", "current date"],
  ["Nov-14 to March 31,2015", "Nov-14", "March 31 2015"],
  ["7 December 2009 – 11 December 2009", "7 December 2009", "11 December 2009"],
  ["May2011 to Ogos2011", "May2011", "August2011"],
  ["Mac2008 to May2008", "March2008", "May2008"],
  ["11 Mei 2009 - 15 Mei 2009", "11 May 2009", "15 May 2009"],
]) {
  const rows = enrichCandidateUpload(
    {},
    `Client: Example Client
Role: SAP Consultant
Duration: ${duration}
Responsibilities:
Supported SAP Jan 2020 - Dec 2020`,
  ).projects;
  const row = rows.find(
    (row) => row.client === "Example Client" && row.role === "SAP Consultant",
  );
  assert.ok(row, duration);
  assert.equal(row.start_date, expectedStart, duration);
  assert.equal(row.end_date, expectedEnd, duration);
  assert.equal(row.current, expectedEnd === "current date", duration);
}
assert.equal(
  enrichCandidateUpload(
    {},
    `Client: Example Client
Role: SAP Consultant
Duration: 31 April 2011 - 2 May 2011`,
  ).projects.some((row) => row.client === "Example Client"),
  false,
);

const namedClientCards = enrichCandidateUpload(
  {},
  `PROJECTS
Client Name\t: First Example Client
Duration\t: April 2011 to March 2016
Role\t: SAP Lead Consultant
Client Name\t: Second Example Client\t\tDuration\t: January 2009 to June 2009
Role\t: SAP Analyst
`,
).projects;
assert.equal(namedClientCards.length, 2);
assert.equal(namedClientCards[0].client, "First Example Client");
assert.equal(namedClientCards[0].start_date, "April 2011");
assert.equal(namedClientCards[1].client, "Second Example Client");
assert.equal(namedClientCards[1].start_date, "January 2009");
assert.equal(namedClientCards[1].end_date, "June 2009");

const yearFirstCards = enrichCandidateUpload(
  {},
  `Project 1:
Organization\tExample Consulting
Client\tFirst Example Client
Project\tImplementation
Role\tSAP FICO Consultant
Duration\tDecember 2014 to 2016 March
Project 2
Organization\tSecond Example Consulting
Client\tSecond Example Client
Project\tSupport
Role\tSAP FICO Lead
Duration\t2017 July to 2018 September
Project 3
Client\tUnresolved Example Client
Duration\t2018 September till now
`,
).projects;
assert.equal(yearFirstCards.length, 2);
assert.equal(yearFirstCards[0].client, "First Example Client");
assert.equal(yearFirstCards[0].start_date, "December 2014");
assert.equal(yearFirstCards[0].end_date, "March 2016");
assert.equal(yearFirstCards[1].client, "Second Example Client");
assert.equal(yearFirstCards[1].start_date, "July 2017");
assert.equal(yearFirstCards[1].end_date, "September 2018");
assert.equal(
  yearFirstCards.some((row) => row.client === "Unresolved Example Client"),
  false,
);
console.log(
  "Literal Client Name and year-first numbered project cards: passed",
);

const nextEmployerNarrative = enrichCandidateUpload(
  {},
  `Client Name\t: First Example Client
Duration: July 13th 2015 to July 1st 2016
Responsibilities:
Configured SAP FI.
Example Employer
Worked as SAP FICO Consultant at Example Employer From May 5th 2014 to June 26th 2015
Client Name\t: Second Example Client
Duration: May 5th 2014 to June 26th 2015
`,
).projects;
assert.equal(
  nextEmployerNarrative.length,
  0,
  "A later employment narrative cannot supply either client's project role",
);
const tabColonRole = enrichCandidateUpload(
  {},
  `Client Name\t: Example Client
Role\t\t: SAP Lead Consultant
Duration\t: April 2011 to March 2016`,
).projects;
assert.equal(tabColonRole.length, 1);
assert.equal(tabColonRole[0].role, "SAP Lead Consultant");
console.log("Employer narrative boundary and tab/colon field values: passed");

const literalProjectNames = enrichCandidateUpload(
  {},
  `Project Name\tExample SAP Migration
Client\tExample Client
Role\tSAP Data Migration Consultant
Duration\tJan 2020 - Dec 2020`,
).projects;
assert.equal(literalProjectNames.length, 1);
assert.equal(literalProjectNames[0].name, "Example SAP Migration");
const customerFunctionCards = enrichCandidateUpload(
  {},
  `Customer
First Example Client
Duration
Feb 2017 - May 2017
Industry
Utilities
Project Description
BW Reporting
Function
SAP BW Developer
Responsibilities/Deliverables
Configured SAP BW.
Customer
Second Example Client
Duration
Aug 2016 - Dec 2016
Industry
Utilities
Project Description
BW Upgrade
Function
BW Functional Lead
`,
).projects;
assert.equal(customerFunctionCards.length, 2);
assert.equal(customerFunctionCards[0].client, "First Example Client");
assert.equal(customerFunctionCards[0].role, "SAP BW Developer");
assert.equal(customerFunctionCards[1].client, "Second Example Client");
assert.equal(customerFunctionCards[1].start_date, "Aug 2016");
const collapsedProjectCards = enrichCandidateUpload(
  {},
  `Project Name
Example Support
DurationNov 2014 – Feb 2015PositionABAP Consultant
Background
Supported SAP.
CompanyExample ConsultingProject NameExample Internal ReportDurationJan 2015 – Feb 2015PositionABAP Consultant
Background
Created SAP report.
CompanyExample ConsultingProject NamePartial ExampleDurationNov 2014PositionABAP Consultant`,
).projects;
assert.equal(collapsedProjectCards.length, 2);
assert.ok(collapsedProjectCards.some((row) => row.name === "Example Support"));
const internalCard = collapsedProjectCards.find(
  (row) => row.name === "Example Internal Report",
);
assert.ok(internalCard);
assert.equal(internalCard.client, "");
assert.equal(internalCard.role, "ABAP Consultant");
console.log(
  "Repeated customer/function and collapsed Word project cards: passed",
);

const missingCustomerFunction = enrichCandidateUpload(
  {},
  `Customer
First Example Client
Duration
Jan 2020 - Dec 2020
Industry
Utilities
Project Description
Example Migration
Function
Responsibilities/Deliverables
Configured SAP.
Customer
Second Example Client
Duration
Jan 2021 - Dec 2021
Industry
Utilities
Project Description
Example Rollout
Function
SAP Consultant
`,
).projects;
assert.equal(
  missingCustomerFunction.some((row) => row.client === "First Example Client"),
  false,
);
assert.equal(
  missingCustomerFunction.find((row) => row.client === "Second Example Client")
    ?.role,
  "SAP Consultant",
);

const clientFirstNamedProject = enrichCandidateUpload(
  {},
  `Employer\tExample Consulting
Client\tFirst Example Client
Duration (Month and Year)\tJune 2008 - February 2010
Industry\tManufacturing
Project Name\tExample Migration
Project Type\tImplementation and Support
Role\tSAP ABAP Developer
Employer\tSecond Example Consulting
Client\tSecond Example Client
Duration (Month and Year)\tJan 2011 - Dec 2012
Project Name\tExample Rollout
Role\tSAP ABAP Lead`,
).projects;
assert.equal(clientFirstNamedProject.length, 2);
assert.equal(clientFirstNamedProject[0].client, "First Example Client");
assert.equal(clientFirstNamedProject[0].start_date, "June 2008");
assert.equal(clientFirstNamedProject[1].client, "Second Example Client");
assert.equal(clientFirstNamedProject[1].start_date, "Jan 2011");
