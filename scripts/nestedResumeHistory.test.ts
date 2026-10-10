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
