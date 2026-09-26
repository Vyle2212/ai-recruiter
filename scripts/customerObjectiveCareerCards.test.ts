import assert from "node:assert/strict";
import { customerObjectiveCareerCards } from "../lib/customerObjectiveCareerCards";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";
import { enrichCandidateUpload } from "../lib/candidateUploadEnrichment";

const cv = `SAP PP Consultant
PROFESSIONAL EXPERIENCE
EXAMPLE DELIVERY VIETNAM
• SAP PP/PM Consultant
• My main responsibilities are: delivery and support.
Customer: Buyer Alpha                Jan 2020 – Dec 2021
Objective SAP Public Cloud Implementation Project.
Role SAP PP/PM Consultant.
Customer: Buyer Beta                 Feb 2022 – Aug 2023
Objective SAP upgrade and rollout
for regional manufacturing.
Role SAP PP Consultant.
SECOND DELIVERY COMPANY
• SAP PP Consultant
Customer: Buyer Gamma                Sep 2024 – Now
Objective SAP implementation for a new plant.
Role SAP PP Consultant.
EDUCATION
Bachelor of Information Systems`;
const cards = customerObjectiveCareerCards(cv);
assert.deepEqual(
  cards.employment.map(({ company, title }) => [company, title]),
  [
    ["EXAMPLE DELIVERY VIETNAM", "SAP PP/PM Consultant"],
    ["SECOND DELIVERY COMPANY", "SAP PP Consultant"],
  ],
);
assert.deepEqual(
  cards.projects.map(({ employer, client, start, end }) => [
    employer,
    client,
    start,
    end,
  ]),
  [
    ["EXAMPLE DELIVERY VIETNAM", "Buyer Alpha", "Jan 2020", "Dec 2021"],
    ["EXAMPLE DELIVERY VIETNAM", "Buyer Beta", "Feb 2022", "Aug 2023"],
    ["SECOND DELIVERY COMPANY", "Buyer Gamma", "Sep 2024", "Now"],
  ],
);
const profile = normalizeActualCandidateSchema({
  raw_text: cv,
}).enterpriseProfile;
assert.deepEqual(
  profile.employmentTimeline
    .map(({ company, title, start, end }) => [company, title, start, end])
    .sort(),
  [
    ["EXAMPLE DELIVERY VIETNAM", "SAP PP/PM Consultant", "", ""],
    ["SECOND DELIVERY COMPANY", "SAP PP Consultant", "", ""],
  ],
);
assert.deepEqual(
  profile.projects
    .map(({ employer, client, role, start, end }) => [
      employer,
      client,
      role,
      start,
      end,
    ])
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
  [
    [
      "EXAMPLE DELIVERY VIETNAM",
      "Buyer Alpha",
      "SAP PP/PM Consultant",
      "Jan 2020",
      "Dec 2021",
    ],
    [
      "EXAMPLE DELIVERY VIETNAM",
      "Buyer Beta",
      "SAP PP Consultant",
      "Feb 2022",
      "Aug 2023",
    ],
    [
      "SECOND DELIVERY COMPANY",
      "Buyer Gamma",
      "SAP PP Consultant",
      "Sep 2024",
      "Now",
    ],
  ],
);
assert.ok(
  profile.employmentTimeline.every((job) => !job.start && !job.end),
  "project dates cannot become stated employment tenure",
);
assert.ok(
  profile.projects.every((project) => project.client !== project.employer),
);
assert.ok(
  profile.projects.every(
    (project) =>
      project.fieldEvidence.dates?.provenance[0]?.excerpt?.includes(
        project.client,
      ) &&
      project.fieldEvidence.employer?.provenance[0]?.excerpt?.includes(
        project.employer || "",
      ),
  ),
  "each project keeps source evidence for its employer and its own dates",
);
const uploaded = enrichCandidateUpload({ raw_text: cv }, cv);
assert.deepEqual(
  uploaded.employment_history
    .map((job: { employer: string }) => job.employer)
    .sort(),
  ["EXAMPLE DELIVERY VIETNAM", "SECOND DELIVERY COMPANY"],
);
assert.equal(
  uploaded.current_company,
  null,
  "a current project alone does not prove a current employment assertion",
);
assert.equal(uploaded.projects.length, 3);
assert.deepEqual(
  uploaded.projects
    .map((project: Record<string, unknown>) => String(project.employer))
    .sort(),
  [
    "EXAMPLE DELIVERY VIETNAM",
    "EXAMPLE DELIVERY VIETNAM",
    "SECOND DELIVERY COMPANY",
  ],
);

for (const invalid of [
  cv.replace("PROFESSIONAL EXPERIENCE", "PROJECT EXPERIENCE"),
  cv.replace("Jan 2020 – Dec 2021", "Jan 2022 – Dec 2021"),
]) {
  const parsed = customerObjectiveCareerCards(invalid);
  assert.ok(parsed.projects.length < 3);
}
assert.equal(
  customerObjectiveCareerCards(
    cv.replace("Role SAP PP/PM Consultant.", "Role SAP End User."),
  ).projects.length,
  2,
);
console.log(
  "Customer project cards retain employer, role and date ownership: PASS",
);
