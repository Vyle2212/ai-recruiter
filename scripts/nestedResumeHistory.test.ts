import { careerMonthIndex } from "../lib/candidateCareerExperience";
import assert from "node:assert/strict";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";
import { evaluateCandidateExtractionCoverage } from "../lib/candidateExtractionCoverage";
import { nestedResumeHistory } from "../lib/nestedResumeHistory";

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
const narrativeProject = enrichCandidateUpload({ name: "Example Person" }, `
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
`);
const gstProject = narrativeProject.projects.find(row => row.name === "GST implementation");
assert.ok(gstProject, "Explicit narrative project role must not be omitted");
assert.equal(gstProject.role, "technical coordinator & ABAP developer");
assert.equal(gstProject.start_date, "", "Employment dates cannot fill undated project");
assert.equal(gstProject.end_date, "");
assert.equal(gstProject.client, "", "Next employer's client cannot fill prior project");
assert.ok(
  evaluateCandidateExtractionCoverage(tableSource, {
    ...tableResult,
    projects: [],
    project_history: [],
  }).missedObservedSections.includes("projects"),
);
