import assert from "node:assert/strict";

import {
  adaptCandidateToSearchV2Document,
} from "../lib/candidateSearchV2Adapter";

const ficoCandidate =
  adaptCandidateToSearchV2Document(
    {
      id:
        "candidate-v27-fico",

      name:
        "FICO Candidate",

      location:
        "Malaysia",

      country:
        null,

      current_title:
        "Senior SAP FICO Consultant",

      current_company:
        "Example Consulting",

      years:
        12,

      skills:
        null,

      sap_modules:
        null,

      primary_module:
        "FICO",

      secondary_modules: [
        "FI",
        "CO",
      ],

      raw_text:
        "Senior SAP FICO consultant with S/4HANA implementation experience.",

      profile_quality_score:
        88,
    },
  );

assert.equal(
  ficoCandidate.country,
  "Malaysia",
);

assert.equal(
  ficoCandidate.location,
  "Malaysia",
);

assert.equal(
  ficoCandidate.totalYearsExperience,
  12,
);

assert.ok(
  ficoCandidate.sapModules?.includes(
    "SAP FICO",
  ),
);

assert.ok(
  ficoCandidate.skills?.includes(
    "SAP FICO",
  ),
);

assert.match(
  ficoCandidate.searchableText || "",
  /S\/4HANA implementation experience/i,
);

const fiCoCandidate =
  adaptCandidateToSearchV2Document(
    {
      id:
        "candidate-v27-fi-co",

      location:
        "Kuala Lumpur, Malaysia",

      primary_module:
        "FI",

      secondary_modules: [
        "CO",
      ],
    },
  );

assert.ok(
  fiCoCandidate.sapModules?.includes(
    "FICO",
  ),
);

assert.ok(
  fiCoCandidate.sapModules?.includes(
    "SAP FICO",
  ),
);

assert.ok(
  fiCoCandidate.skills?.includes(
    "SAP FICO",
  ),
);

console.log(
  "candidateSearchV2AdapterV27.test.ts passed",
);