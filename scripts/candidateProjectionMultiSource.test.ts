import assert from "node:assert/strict";
import {
  CANDIDATE_CANONICAL_VERSION,
  normalizeActualCandidateSchema,
  type CandidateExtractionSection,
} from "../lib/candidate360SchemaNormalize";

const profile = (value: Record<string, unknown>) =>
  normalizeActualCandidateSchema(value).enterpriseProfile;

const structured = profile({
  id: "structured",
  experience: [
    {
      id: "e1",
      company: "A",
      title: "Consultant",
      start_date: "2020-01",
      end_date: "2022-03",
      responsibilities: ["Led implementation and go-live"],
    },
  ],
});
assert.equal(structured.employmentTimeline.length, 1);
assert.equal(structured.employmentTimeline[0].duration, "2 years 2 months");
assert.equal(
  structured.employmentTimeline[0].provenance?.[0].sourceType,
  "employment",
);
assert.equal(
  structured.projects.length,
  0,
  "employment responsibilities without an assignment anchor are not promoted to projects",
);

const legacy = profile({
  id: "legacy",
  parsed_json: {
    profile: {
      career: {
        workHistory: {
          items: [
            {
              employer: "Legacy Co",
              position: "Engineer",
              from: "2018",
              to: "2020",
            },
          ],
        },
      },
    },
  },
});
assert.equal(legacy.employmentTimeline[0]?.company, "Legacy Co");

const currentOnly = profile({
  id: "current",
  current_title: "Engineering Manager",
  current_company: "Current Co",
  location: "Singapore",
});
assert.equal(currentOnly.employmentTimeline[0]?.title, "Engineering Manager");
assert.equal(currentOnly.employmentTimeline[0]?.start, "");
assert.equal(currentOnly.employmentTimeline[0]?.duration, "");
assert.equal(currentOnly.quality.extraction.experience.status, "extracted");

const malformedRow = profile({
  id: "malformed-row",
  experience: [null, "bad row", { company: "Good Co", title: "Developer" }],
  projects: [
    null,
    42,
    {
      client: "Client",
      role: "Developer",
      description: "Migration project delivery",
    },
  ],
});
assert.equal(malformedRow.employmentTimeline.length, 1);
assert.equal(malformedRow.projects.length, 1);

const duplicate = profile({
  id: "dedupe",
  experience: [
    {
      company: "Delivery Partner Sdn Bhd",
      title: "Analyst",
      start: "2020",
      end: "2021",
    },
    {
      employer: "Delivery Partner Sdn Bhd",
      role: "Analyst",
      from: "2020",
      to: "2021",
    },
  ],
  projects: [
    {
      client: "Customer Industries Berhad",
      role: "Analyst",
      start: "2020",
      end: "2021",
    },
    {
      customer: "Customer Industries Berhad",
      position: "Analyst",
      from: "2020",
      to: "2021",
    },
  ],
});
assert.equal(duplicate.employmentTimeline.length, 1);
assert.equal(duplicate.projects.length, 1);
assert.deepEqual(
  profile({
    id: "dedupe",
    experience: [
      {
        company: "Delivery Partner Sdn Bhd",
        title: "Analyst",
        start: "2020",
        end: "2021",
      },
      {
        employer: "Delivery Partner Sdn Bhd",
        role: "Analyst",
        from: "2020",
        to: "2021",
      },
    ],
    projects: [
      {
        client: "Customer Industries Berhad",
        role: "Analyst",
        start: "2020",
        end: "2021",
      },
      {
        customer: "Customer Industries Berhad",
        position: "Analyst",
        from: "2020",
        to: "2021",
      },
    ],
  }),
  duplicate,
  "retrying the same projection is idempotent",
);

const skillOnly = profile({
  id: "skill-only",
  raw_text: "Skills: SAP FICO, migration tooling, rollout planning.",
});
assert.equal(
  skillOnly.projects.length,
  0,
  "skill keywords alone never create project evidence",
);
assert.equal(skillOnly.quality.extraction.projects.status, "genuinely_none");

const narrativeAssignment = profile({
  id: "narrative",
  raw_text:
    "At the client assignment, delivered an SAP integration project and supported go-live activities.",
});
assert.equal(
  narrativeAssignment.projects.length,
  0,
  "a generic lifecycle claim without a named assignment is not a project",
);

const graduate = profile({
  id: "graduate",
  raw_text: "Fresh graduate. EDUCATION Bachelor of Computer Science.",
});
assert.equal(graduate.employmentTimeline.length, 0);
assert.equal(graduate.projects.length, 0);
assert.equal(graduate.quality.extraction.experience.status, "genuinely_none");
assert.equal(graduate.quality.extraction.projects.status, "genuinely_none");

const unavailable = profile({ id: "unavailable" });
assert.equal(
  unavailable.quality.extraction.experience.status,
  "source_unavailable",
);
assert.equal(
  unavailable.quality.extraction.projects.status,
  "source_unavailable",
);

const candidateA = profile({
  id: "a",
  current_title: "Developer",
  current_company: "A",
});
const candidateB = profile({ id: "b", raw_text: "Fresh graduate." });
assert.equal(candidateA.employmentTimeline[0].company, "A");
assert.equal(
  candidateB.employmentTimeline.length,
  0,
  "candidate A evidence never leaks to candidate B",
);

const pending: CandidateExtractionSection = {
  status: "extraction_pending",
  version: CANDIDATE_CANONICAL_VERSION,
  sourceRef: "queue:job-1",
  fallbackExcerpt: "",
  attemptedRoutes: [],
  failureReason: "",
  retryable: true,
};
const retryableFailure: CandidateExtractionSection = {
  ...pending,
  status: "extraction_failed",
  failureReason: "malformed_encrypted_source",
  retryable: true,
};
assert.equal(pending.status, "extraction_pending");
assert.equal(retryableFailure.retryable, true);

console.log(
  "candidate multi-source Experience/Projects projection tests passed",
);
