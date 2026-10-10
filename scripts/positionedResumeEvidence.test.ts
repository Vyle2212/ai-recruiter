import assert from "node:assert/strict";
import {
  pipeEmploymentCards,
  positionedResumeSections,
  trackedHeaderName,
} from "../lib/positionedResumeEvidence";
import { buildCandidate360Profile } from "../lib/candidate360Profile";
import { createCvPdfRenderer } from "../lib/pdfTextLayout";

const text = [
  "A l ex S m it h",
  "Address: South Jakarta",
  "CORE COMPETENCIES",
  "SAP FI",
  "\f",
  "PROFESSIONAL EXPERIENCE",
  "Expert, IT SAP FICO | Example Paper Group",
  "Subsidiary (Sept 2025 – Present)",
  "SAP FICO Consultant | Example Technology",
  "Services (June 2024 – September 2025)",
  "CERTIFICATION",
  "SAP Certified Application Associate – SAP",
  "S/4HANA for Financial Accounting",
  "Associates (SAP S/4HANA 2021).",
  "\f",
  "Cash flow responsibility must not become a certificate.",
  "LANGUAGES SKILLS",
  "Bahasa Indonesia",
  "Reading, Speaking, and Writing: Native",
  "English",
  "Reading, Speaking, and Writing: Fluent",
  "TOEFL Score: 513",
  "EDUCATION",
  "Master Degree",
  "Master of Business Administration (M.B.A),",
  "Finance | Example University",
  "2015 – 2017",
  "Bachelor Degree",
  "Bachelor of Economics",
  "Finance | Example College",
  "2008 – 2014",
  "COURSES",
  "Unrelated training",
  "\f",
  "PROJECT SUMMARY EXPERIENCE",
  "Clients\tProject Type\tRole",
  "Example Public Agency\tSAP Greenfield Implementation\tSAP Consultant",
  "Example Transport\tSAP Rollout\tData Migration Lead",
].join("\n");

assert.equal(
  trackedHeaderName(text, "Alex_Smith_Expert_ITSAPFICO.pdf"),
  "Alex Smith",
);
assert.equal(
  trackedHeaderName(text, "Another_Person_Expert_ITSAPFICO.pdf"),
  undefined,
);
assert.equal(
  trackedHeaderName("PROFESSIONAL EXPERIENCE", "Alex_Smith.pdf"),
  undefined,
);
const jobs = pipeEmploymentCards(text);
assert.equal(jobs.length, 2);
assert.equal(jobs[0].employer, "Example Paper Group Subsidiary");
assert.equal(jobs[0].title, "Expert, IT SAP FICO");
assert.equal(jobs[0].current, true);
assert.equal(jobs[1].employer, "Example Technology Services");
assert.equal(jobs[1].current, false);
assert.equal(
  pipeEmploymentCards(
    "SAP FI | Example Customer\nRole: SAP Consultant\nJune 2024 – September 2025",
  ).length,
  0,
);
const sections = positionedResumeSections(text);
assert.equal(sections.education.length, 2);
assert.equal(sections.education[0].institution, "Example University");
assert.equal(sections.education[0].graduation_year, "2017");
assert.deepEqual(sections.certifications, [
  "SAP Certified Application Associate – SAP S/4HANA for Financial Accounting Associates (SAP S/4HANA 2021).",
]);
assert.deepEqual(sections.languages, [
  { language: "Bahasa Indonesia", proficiency: "Native" },
  { language: "English", proficiency: "Fluent" },
]);
assert.equal(sections.projects.length, 2);
assert.ok(
  sections.projects.every(
    (project) => !project.start_date && !project.end_date && !project.employer,
  ),
);
const projected = buildCandidate360Profile({
  languages: [
    { language: { value: "English" }, proficiency: { value: "Fluent" } },
    { language: "Unknown", proficiency: { value: null } },
  ],
});
assert.equal(projected.languages[0].proficiency.value, "Fluent");
assert.equal(projected.languages[1].proficiency.value, "");
assert.ok(!JSON.stringify(projected.languages).includes("[object Object]"));
async function verifyProjectGeometry() {
  const item = (str: string, x: number, y: number) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
    width: str.length * 4,
  });
  const rendered = await createCvPdfRenderer()({
    getTextContent: async () => ({
      items: [
        item("PROJECT SUMMARY EXPERIENCE", 40, 760),
        item("Clients", 120, 730),
        item("Project Type", 300, 730),
        item("Role", 480, 730),
        item("Example Agency", 40, 700),
        item("SAP Implementation", 200, 700),
        item("SAP Consultant", 400, 700),
        item("Example Paper Group", 40, 650),
        item("SAP Conversion", 200, 650),
        item("Expert, IT SAP FI", 400, 650),
        item("– Subsidiary", 158, 635),
      ],
    }),
  });
  const rows = positionedResumeSections(rendered).projects;
  assert.equal(rows.length, 2);
  assert.equal(rows[1].client, "Example Paper Group – Subsidiary");
  assert.equal(rows[1].name, "SAP Conversion");
  assert.equal(rows[1].role, "Expert, IT SAP FI");
}
void verifyProjectGeometry().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
console.log(
  "Positioned resume evidence and scalar projection regressions passed.",
);
