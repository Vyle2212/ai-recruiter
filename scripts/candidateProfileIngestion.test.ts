import assert from "node:assert/strict";
import {
  evaluateCandidateProfileCompletion,
  mergeCandidateProfileVersion,
  resolveCandidateIngestion,
} from "../lib/candidateProfileIngestion";
import { classifyCandidateText } from "../lib/candidateFileGuards";
import { evaluateCandidateExtractionCoverage } from "../lib/candidateExtractionCoverage";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";

const fullText =
  "Jane Doe SAP MM consultant procurement implementation rollout migration workshops integration testing support reporting governance master data inventory purchasing configuration blueprint hypercare stakeholder regional architecture cutover deployment documentation training";
const existing = [
  {
    id: "candidate-a",
    name: "Jane Doe",
    email: "jane@example.com",
    raw_text: fullText,
    current_company: "Acme",
    current_title: "SAP MM Consultant",
  },
  {
    id: "candidate-b",
    name: "Alex Tan",
    email: "alex@example.com",
    raw_text: fullText.replace("Jane Doe", "Alex Tan"),
  },
];

assert.equal(
  resolveCandidateIngestion(
    { name: "Jane Doe", email: " JANE@example.com " },
    existing,
  ).disposition,
  "update_existing",
);
assert.equal(
  resolveCandidateIngestion(
    { name: "New Person", email: "new@example.com" },
    existing,
  ).disposition,
  "create_new",
);
assert.equal(
  resolveCandidateIngestion({ name: "Jane Doe" }, existing).disposition,
  "create_new",
  "same name alone must never overwrite an existing profile",
);
assert.equal(
  resolveCandidateIngestion(
    { name: "Jane Doe", raw_text: `${fullText} updated` },
    existing,
  ).candidateId,
  "candidate-a",
);
assert.equal(
  resolveCandidateIngestion({ name: "Jane Doe", email: "jane@example.com" }, [
    existing[0],
    { ...existing[0], id: "candidate-c" },
  ]).disposition,
  "hold_for_identity_review",
);

const complete = evaluateCandidateProfileCompletion({
  name: "Jane Doe",
  email: "jane@example.com",
  location: "Malaysia",
  current_title: "SAP MM Consultant",
  current_company: "Acme",
  skills: ["Procurement"],
  projects: [
    {
      client: "Example Client",
      role: "SAP MM Consultant",
      start_date: "2022-01",
      end_date: "2023-12",
    },
  ],
  education: ["Bachelor of Computing"],
  languages: ["English"],
  primary_module: "MM",
  is_sap_profile: true,
  candidate_confirmed: true,
  experience: [
    {
      company: "Acme",
      title: "SAP MM Consultant",
      start_date: "2022-01",
      current: true,
    },
  ],
});
assert.equal(complete.searchable, true);
assert.equal(
  evaluateCandidateProfileCompletion({
    name: "Jane Doe",
    email: "jane@example.com",
  }).searchable,
  false,
);
assert.equal(
  evaluateCandidateProfileCompletion({
    name: "Jane Doe",
    email: "jane@example.com",
  }).missingRequiredFields.includes("candidate_accuracy_confirmation"),
  true,
);
assert.equal(
  evaluateCandidateProfileCompletion(
    {
      name: "Admin Uploaded",
      email: "admin-upload@example.com",
      location: "Malaysia",
      current_title: "SAP MM Consultant",
      current_company: "Acme",
      skills: ["Procurement"],
      projects: [
        {
          client: "Example Client",
          role: "Consultant",
          start_date: "2022-01",
          end_date: "2023-12",
        },
      ],
      education: ["Bachelor of Computing"],
      languages: ["English"],
      primary_module: "MM",
      is_sap_profile: true,
      experience: [
        {
          company: "Acme",
          title: "Consultant",
          start_date: "2022-01",
          current: true,
        },
      ],
    },
    { requireCandidateConfirmation: false },
  ).searchable,
  true,
  "complete admin uploads can be client-ready before candidate signup",
);

const merge = mergeCandidateProfileVersion({
  existing: { name: "Candidate Confirmed Name", current_title: "Old title" },
  incoming: { name: "Parser Name", current_title: "New title" },
  incomingSource: "admin_upload",
  fieldSources: { name: "candidate_confirmed", current_title: "admin_upload" },
});
assert.equal(merge.merged.name, "Candidate Confirmed Name");
assert.equal(merge.merged.current_title, "New title");
assert.deepEqual(merge.preservedTrustedFields, ["name"]);

assert.equal(
  classifyCandidateText(
    "Software engineer with Java Spring Boot React Node.js microservices development testing architecture deployment operations education certification email developer@example.com phone +60123456789 work experience",
  ).shouldSave,
  false,
);
assert.equal(
  classifyCandidateText(
    `${fullText} email jane@example.com phone +60123456789 work experience education certification`,
  ).recordType,
  "SAP_CV",
);

const covered = evaluateCandidateExtractionCoverage(
  `Jane Doe\nEmail: jane@example.com\nWORK EXPERIENCE\nSAP MM Consultant | Acme | Jan 2022 - Present\nPROJECT EXPERIENCE\nClient: Example Client\nEDUCATION\nBachelor of Computing\nCERTIFICATIONS\nSAP Certified Associate\nSKILLS\nSAP MM, Procurement\nLANGUAGES\nEnglish`,
  {
    name: "Jane Doe",
    email: "jane@example.com",
    location: "Malaysia",
    current_title: "SAP MM Consultant",
    current_company: "Acme",
    primary_module: "MM",
    skills: ["SAP MM", "Procurement"],
    experience: [
      {
        employer: "Acme",
        title: "SAP MM Consultant",
        start_date: "2022-01",
        current: true,
      },
    ],
    projects: [
      {
        client: "Example Client",
        role: "SAP MM Consultant",
        start_date: "2022-01",
        end_date: "2023-12",
      },
    ],
    education: ["Bachelor of Computing"],
    certifications: ["SAP Certified Associate"],
    languages: ["English"],
    is_sap_profile: true,
  },
);
assert.equal(covered.status, "complete_for_validation");
assert.equal(covered.coveragePercent, 100);

const multipleProjectSource = `SYNTHETIC SAP CONSULTANT
WORK EXPERIENCE
SAP MM Consultant | Synthetic Consulting | Jan 2020 - Present
PROJECT EXPERIENCE
Client: Synthetic Client A
Project: Procurement rollout
Client: Synthetic Client B
Project: S/4HANA migration
EDUCATION
Bachelor of Computing
SKILLS
SAP MM, Procurement
LANGUAGES
English`;
const multipleProjectCandidate = {
  name: "Synthetic Consultant",
  email: "synthetic@example.invalid",
  location: "Malaysia",
  current_title: "SAP MM Consultant",
  current_company: "Synthetic Consulting",
  primary_module: "MM",
  skills: ["SAP MM"],
  experience: [
    {
      employer: "Synthetic Consulting",
      title: "SAP MM Consultant",
      start_date: "2020-01",
      current: true,
    },
  ],
  education: ["Bachelor of Computing"],
  languages: ["English"],
  is_sap_profile: true,
};
const oneProject = {
  client: "Synthetic Client A",
  role: "SAP MM Consultant",
  start_date: "2020-01",
  end_date: "2021-01",
};
const secondProject = {
  client: "Synthetic Client B",
  role: "SAP MM Consultant",
  start_date: "2021-02",
  end_date: "2022-03",
};
const partialProjects = evaluateCandidateExtractionCoverage(
  multipleProjectSource,
  { ...multipleProjectCandidate, projects: [oneProject] },
);
assert.equal(partialProjects.status, "incomplete_needs_review");
assert.ok(partialProjects.missedObservedSections.includes("projects"));
assert.equal(
  evaluateCandidateExtractionCoverage(multipleProjectSource, {
    ...multipleProjectCandidate,
    projects: [oneProject, secondProject],
  }).status,
  "complete_for_validation",
);
assert.equal(
  evaluateCandidateExtractionCoverage(multipleProjectSource, {
    ...multipleProjectCandidate,
    projects: JSON.stringify([oneProject, secondProject]),
  }).status,
  "complete_for_validation",
);

const multipleEmploymentSource = `SYNTHETIC SAP CONSULTANT
PROFESSIONAL EXPERIENCE
Employer: Synthetic Consulting A
Role: SAP MM Consultant
Duration: Jan 2020 - Dec 2022
Company Name: Synthetic Consulting B
Job Title: Senior SAP MM Consultant
Duration: Jan 2023 - Present
PROJECT EXPERIENCE
Client: Synthetic Client
Project: Procurement rollout
EDUCATION
Bachelor of Computing
SKILLS
SAP MM, Procurement
LANGUAGES
English`;
const firstEmployment = {
  employer: "Synthetic Consulting A",
  title: "SAP MM Consultant",
  start_date: "2020-01",
  end_date: "2022-12",
};
const currentEmployment = {
  employer: "Synthetic Consulting B",
  title: "Senior SAP MM Consultant",
  start_date: "2023-01",
  current: true,
};
const multipleEmploymentCandidate = {
  ...multipleProjectCandidate,
  experience: [firstEmployment],
  projects: [oneProject],
};
const partialEmployment = evaluateCandidateExtractionCoverage(
  multipleEmploymentSource,
  multipleEmploymentCandidate,
);
assert.equal(partialEmployment.status, "incomplete_needs_review");
assert.ok(partialEmployment.missedObservedSections.includes("employment"));
assert.equal(
  evaluateCandidateExtractionCoverage(multipleEmploymentSource, {
    ...multipleEmploymentCandidate,
    experience: [firstEmployment, currentEmployment],
  }).missedObservedSections.includes("employment"),
  false,
);

const projectsWithCompanyLabels = multipleEmploymentSource
  .replace(
    /PROFESSIONAL EXPERIENCE[\s\S]*?PROJECT EXPERIENCE/,
    `PROFESSIONAL EXPERIENCE
Employer: Synthetic Consulting A
Role: SAP MM Consultant
Duration: Jan 2020 - Present
PROJECT EXPERIENCE`,
  )
  .replace(
    "Client: Synthetic Client",
    `Company: Project Customer One
Company: Project Customer Two
Client: Synthetic Client`,
  );
assert.equal(
  evaluateCandidateExtractionCoverage(projectsWithCompanyLabels, {
    ...multipleEmploymentCandidate,
    experience: [firstEmployment],
  }).missedObservedSections.includes("employment"),
  false,
  "company labels in a later project section must not inflate employment count",
);

const missedEducation = evaluateCandidateExtractionCoverage(
  "Jane Doe\nWORK EXPERIENCE\nSAP Consultant 2022 - Present\nEDUCATION\nBachelor of Computing",
  {
    name: "Jane Doe",
    primary_module: "FICO",
    experience: [
      {
        employer: "Acme",
        title: "SAP Consultant",
        start_date: "2022-01",
        current: true,
      },
    ],
  },
);
assert.equal(missedEducation.status, "incomplete_needs_review");
assert.equal(
  missedEducation.missedObservedSections.includes("education"),
  true,
);

const uploadEnriched = enrichCandidateUpload(
  {
    name: "Jane Doe",
    primary_module: "MM",
    sap_modules: ["MM"],
    is_sap_profile: true,
  },
  `Jane Doe
Email: jane@example.com
Location: Singapore
SAP MM Consultant at Example Consulting Jan 2022 - Present
PROJECT EXPERIENCE
Client: Example Client
Role: SAP MM Consultant
Jan 2022 - Dec 2023
EDUCATION
Bachelor of Computing
CERTIFICATIONS
SAP Certified Associate
SKILLS
SAP MM, Procurement
LANGUAGES
English`,
);
assert.equal(uploadEnriched.experience.length, 1);
assert.equal(uploadEnriched.projects.length, 1);
assert.equal(uploadEnriched.projects[0].client, "Example Client");
assert.deepEqual(uploadEnriched.certifications, ["SAP Certified Associate"]);
assert.equal(uploadEnriched.skills.includes("Procurement"), true);

console.log("candidateProfileIngestion.test.ts passed");
