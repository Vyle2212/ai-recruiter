import assert from "node:assert/strict";

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
        "fico-primary",

      candidateName:
        "FICO Primary Candidate",

      currentTitle:
        "Senior SAP Finance Consultant",

      country:
        "Malaysia",

      location:
        "Malaysia",

      skills: [
        "SAP FICO",
        "FI",
        "CO",
      ],

      sapModules: [
        "FICO",
        "FI",
        "CO",
      ],

      profileQualityScore:
        90,

      dataConfidenceScore:
        85,

      updatedAt:
        new Date().toISOString(),
    },

    {
      candidateId:
        "fico-title",

      candidateName:
        "FICO Title Candidate",

      currentTitle:
        "SAP FICO Consultant",

      country:
        "Malaysia",

      location:
        "Malaysia",

      skills: [
        "SAP",
        "Finance",
      ],

      sapModules: [
        "BW",
        "CO",
      ],

      profileQualityScore:
        88,

      dataConfidenceScore:
        82,

      updatedAt:
        new Date().toISOString(),
    },

    {
      candidateId:
        "sd-secondary-co",

      candidateName:
        "SD Candidate",

      currentTitle:
        "Senior SAP SD Consultant",

      country:
        "Malaysia",

      location:
        "Malaysia",

      skills: [
        "SAP SD",
        "CO",
      ],

      sapModules: [
        "SD",
        "CO",
      ],

      profileQualityScore:
        95,

      dataConfidenceScore:
        90,

      updatedAt:
        new Date().toISOString(),
    },

    {
      candidateId:
        "ps-candidate",

      candidateName:
        "PS Candidate",

      currentTitle:
        "SAP PS Team Lead",

      country:
        "Malaysia",

      location:
        "Malaysia",

      skills: [
        "SAP PS",
      ],

      sapModules: [
        "PS",
      ],

      profileQualityScore:
        96,

      dataConfidenceScore:
        92,

      updatedAt:
        new Date().toISOString(),
    },
  ];

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
      },

      minimumScore:
        20,

      pageSize:
        20,
    },
  );

const ids =
  response.results.map(
    (result) =>
      result.candidateId,
  );

assert.ok(
  ids.includes(
    "fico-primary",
  ),
);

assert.ok(
  ids.includes(
    "fico-title",
  ),
);

assert.ok(
  !ids.includes(
    "sd-secondary-co",
  ),
);

assert.ok(
  !ids.includes(
    "ps-candidate",
  ),
);

assert.equal(
  response.summary.totalMatched,
  2,
);

assert.ok(
  (
    response.results[0]
      ?.score.skillScore ||
    0
  ) >=
    88,
);

console.log(
  "candidateSearchV2ModuleRelevance.test.ts passed",
);