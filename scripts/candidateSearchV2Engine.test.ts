import assert from "node:assert/strict";

import {
  normalizeCandidateSearchV2Request,
} from "../lib/candidateSearchV2Request";

import {
  searchCandidatesV2,
} from "../lib/candidateSearchV2Engine";

import type {
  CandidateSearchV2Document,
} from "../lib/candidateSearchV2Types";

const documents:
  CandidateSearchV2Document[] = [
    {
      candidateId:
        "candidate-a",

      candidateName:
        "Candidate A",

      currentTitle:
        "Senior SAP FICO Consultant",

      currentEmployer:
        "Consulting Company",

      country:
        "Malaysia",

      location:
        "Kuala Lumpur",

      totalYearsExperience:
        12,

      relevantYearsExperience:
        9,

      domainEvidence: {
        FICO: "PRIMARY",
      },

      seniorityEvidenceLevel:
        "verified_structured_evidence",

      locationEvidenceState:
        "VERIFIED",

      trustedCandidateEvidence: {
        candidateId: "candidate-a",
        values: [
          {
            value: "Senior SAP FICO Consultant",
            sourceType: "raw_title",
            sourceField: "candidates.current_title",
            sourceRecordId: "candidate-a",
            provenance: "candidate_record_raw",
            trusted: true,
          },
          {
            value: "SAP FICO implementation project",
            sourceType: "raw_project",
            sourceField: "candidates.projects",
            sourceRecordId: "candidate-a",
            provenance: "candidate_record_raw",
            trusted: true,
          },
        ],
      },

      skills: [
        "SAP FICO",
        "S/4HANA",
        "R2R",
      ],

      sapModules: [
        "FI",
        "CO",
      ],

      industries: [
        "Consulting",
        "Manufacturing",
      ],

      languages: [
        "English",
      ],

      workflowStatus:
        "ready_for_shortlist",

      qualityStatus:
        "validated",

      profileQualityScore:
        92,

      dataConfidenceScore:
        88,

      semanticSimilarity:
        0.91,

      updatedAt:
        new Date().toISOString(),
    },

    {
      candidateId:
        "candidate-b",

      candidateName:
        "Candidate B",

      currentTitle:
        "SAP MM Consultant",

      currentEmployer:
        null,

      country:
        "Malaysia",

      location:
        "Penang",

      totalYearsExperience:
        7,

      relevantYearsExperience:
        5,

      skills: [
        "SAP MM",
        "Procurement",
      ],

      sapModules: [
        "MM",
      ],

      industries: [
        "Manufacturing",
      ],

      profileQualityScore:
        68,

      dataConfidenceScore:
        42,

      semanticSimilarity:
        0.41,

      updatedAt:
        "2024-01-01T00:00:00.000Z",
    },
  ];

const normalized =
  normalizeCandidateSearchV2Request(
    {
      query:
        "Senior SAP FICO Malaysia",

      filters: {
        skills: [
          "SAP FICO",
        ],

        countries: [
          "Malaysia",
        ],
      },

      pageSize:
        500,
    },
  );

assert.equal(
  normalized.page,
  1,
);

assert.equal(
  normalized.pageSize,
  100,
);

assert.deepEqual(
  normalized.filters.countries,
  [
    "malaysia",
  ],
);

const response =
  searchCandidatesV2(
    documents,
    {
      query:
        "Senior SAP FICO Malaysia",

      mode:
        "hybrid",

      filters: {
        countries: [
          "Malaysia",
        ],

        skills: [
          "SAP FICO",
        ],

        minimumTotalYearsExperience:
          8,
      },

      page:
        1,

      pageSize:
        20,

      minimumScore:
        20,
    },
  );

assert.equal(
  response.safety.readOnly,
  true,
);

assert.equal(
  response.safety.candidateWrites,
  0,
);

assert.equal(
  response.summary.totalDocuments,
  2,
);

assert.equal(
  response.summary.totalMatched,
  1,
);

assert.equal(
  response.results.length,
  1,
);

assert.equal(
  response.results[0]
    ?.candidateId,
  "candidate-a",
);

assert.ok(
  (
    response.results[0]
      ?.score.finalScore ||
    0
  ) >
    70,
);

assert.deepEqual(
  response.results[0]
    ?.explanation
    .matchedSkills,
  [
    "sap fico",
  ],
);

assert.equal(
  response.results[0]
    ?.explanation
    .confidenceLevel,
  "high",
);

const paginated =
  searchCandidatesV2(
    documents,
    {
      query:
        "SAP",

      page:
        2,

      pageSize:
        1,
    },
  );

assert.equal(
  paginated.summary.page,
  2,
);

assert.equal(
  paginated.results.length,
  1,
);

console.log(
  "candidateSearchV2Engine.test.ts passed",
);
