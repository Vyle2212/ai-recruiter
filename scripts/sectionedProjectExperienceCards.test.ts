import assert from "node:assert/strict";
import { sectionedProjectExperienceCards } from "../lib/sectionedProjectExperienceCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";

const cv = `EMPLOYMENT HISTORY
Example Delivery – SAP Functional Consultant
Dec 2021 – Present
CloudGo – Business Analyst
Jun 2020 – Jun 2021
PROJECT EXPERIENCE
Japanese Technology Company – Industrial Imaging
Feb 2026 – Present
Position: SAP CS Functional Consultant
Project Description: SAP S/4HANA system upgrade project covering SD and CS
modules.
Responsibilities:
• Prepared test scripts and performed SIT.
• Supported UAT and hypercare.
  Coordinated post go-live issues.
Environment: SAP S/4HANA.

Apr 2025 – Present
Position: SAP CS Functional Consultant
Project Description: AMS project supporting SD and CS across APAC.
Responsibilities:
• Gathered requirements and proposed solutions.
Environment: SAP S/4HANA.

German Company – Food Solutions
Oct 2025 – Apr 2026
Position: SAP SD Functional Consultant
Project Description: SAP ECC rollout project for Vietnam.
Responsibilities:
• Configured sales processes.
Environment: SAP ECC.

CloudGo System Development
Jun 2020 – Jun 2021
Position: CRM Business Analyst
Project Description: CRM system development project.
Responsibilities:
• Designed logistics workflows.
Environment: CRM System.
EDUCATION
Bachelor of Information Systems`;

const cards = sectionedProjectExperienceCards(cv);
assert.equal(
  cards.length,
  4,
  "the separately stated CRM assignment is retained",
);
assert.deepEqual(
  cards.map(({ client, start, end }) => [client, start, end]),
  [
    ["Japanese Technology Company – Industrial Imaging", "Feb 2026", "Present"],
    ["", "Apr 2025", "Present"],
    ["German Company – Food Solutions", "Oct 2025", "Apr 2026"],
    ["CloudGo System Development", "Jun 2020", "Jun 2021"],
  ],
);
assert.deepEqual(cards[0].responsibilities, [
  "Prepared test scripts and performed SIT.",
  "Supported UAT and hypercare. Coordinated post go-live issues.",
]);
const profile = normalizeActualCandidateSchema({
  raw_text: cv,
}).enterpriseProfile;
const projects = profile.projects.filter((project) =>
  project.sourceAssignmentIds?.some((id) =>
    id.startsWith("sectioned-project-experience-"),
  ),
);
assert.equal(projects.length, 4);
assert.ok(projects.every((project) => !project.employer));
assert.ok(
  projects.every((project) =>
    project.fieldEvidence.dates?.provenance[0]?.excerpt?.includes(
      project.start,
    ),
  ),
);
assert.ok(
  profile.employmentTimeline.every(
    (job) =>
      !job.company.includes("Japanese Technology Company") &&
      !job.company.includes("German Company"),
  ),
  "client project dates cannot create an employer tenure row",
);
const upload = enrichCandidateUpload({ raw_text: cv }, cv);
assert.ok(
  upload.projects.some(
    (project: Record<string, unknown>) =>
      project.client === "German Company – Food Solutions" &&
      project.employer !== "German Company – Food Solutions",
  ),
);
assert.equal(
  sectionedProjectExperienceCards(
    cv.replace("PROJECT EXPERIENCE", "EMPLOYMENT EXPERIENCE"),
  ).length,
  0,
);
assert.equal(
  sectionedProjectExperienceCards(
    cv.replace("Oct 2025 – Apr 2026", "Oct 2026 – Apr 2025"),
  ).length,
  3,
);
console.log(
  "Sectioned project cards keep clients and project dates separate from employment: PASS",
);
