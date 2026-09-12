import assert from "node:assert/strict";
import fs from "node:fs";

import {
  adaptCandidatesToSearchV2Documents,
  adaptCandidateToSearchV2Document,
} from "../lib/candidateSearchV2Adapter";

import { searchCandidatesV2 } from "../lib/candidateSearchV2Engine";

const candidate = adaptCandidateToSearchV2Document({
  id: "candidate-001",

  full_name: "Nguyen Van A",

  current_title: "Senior SAP FICO Consultant",

  current_company: "Example Consulting",

  country: "Malaysia",

  current_location: "Kuala Lumpur",

  years_of_experience: 11,

  relevant_years_experience: 8,

  skills: [
    {
      name: "SAP FICO",
    },

    "S/4HANA",

    "R2R",
  ],

  sap_modules: "FI, CO",

  industries: "Consulting; Manufacturing",

  languages: "English, Vietnamese",

  profile_quality_score: 90,

  confidence_score: 86,

  updated_at: new Date().toISOString(),
});

assert.equal(candidate.candidateId, "candidate-001");

assert.equal(candidate.candidateName, "Nguyen Van A");

assert.equal(candidate.currentTitle, "Senior SAP FICO Consultant");

assert.ok(candidate.skills?.includes("SAP FICO"));

assert.ok(candidate.skills?.includes("S/4HANA"));

assert.ok(candidate.skills?.includes("R2R"));

assert.ok(candidate.skills?.includes("FI"));

assert.ok(candidate.skills?.includes("CO"));

assert.ok(candidate.sapModules?.includes("FI"));

assert.ok(candidate.sapModules?.includes("CO"));

assert.ok(candidate.sapModules?.includes("SAP FI"));

assert.ok(candidate.sapModules?.includes("SAP CO"));

assert.ok(candidate.sapModules?.includes("FICO"));

assert.ok(candidate.sapModules?.includes("SAP FICO"));

const collection = adaptCandidatesToSearchV2Documents({
  candidates: [
    {
      id: "candidate-001",

      name: "Nguyen Van A",

      title: "Senior SAP FICO Consultant",

      country: "Malaysia",

      skills: "SAP FICO, S/4HANA",

      projects: [
        {
          id: "candidate-001-fico-delivery",
          project_name: "SAP FICO Finance Transformation",
          client: "Grounded Manufacturing Client",
          role: "SAP FICO Consultant",
          modules: ["FICO", "FI", "CO"],
          project_type: "Implementation",
          responsibilities: [
            "Configured SAP FI and CO in a bounded client assignment.",
          ],
        },
      ],
    },

    {
      id: "candidate-002",

      name: "Candidate B",

      title: "SAP MM Consultant",

      country: "Vietnam",

      skills: "SAP MM, Procurement",
    },
  ],
});

assert.equal(collection.length, 2);

const response = searchCandidatesV2(collection, {
  query: "SAP FICO",

  filters: {
    skills: ["SAP FICO"],
  },

  pageSize: 20,
});

assert.equal(response.summary.totalMatched, 1);

assert.equal(response.results[0]?.candidateId, "candidate-001");

assert.equal(response.safety.readOnly, true);

const routePath = "app/api/recruiter/search-v2/route.ts";

assert.ok(
  fs.existsSync(routePath),
  "Candidate Search V2 API route must exist.",
);

const routeSource = fs.readFileSync(routePath, "utf8");

assert.match(routeSource, /export async function POST/);

assert.match(routeSource, /fetchCandidateSource/);

assert.match(routeSource, /authorizeRecruiterJobsRead/);

assert.match(routeSource, /sanitizeSearchV2RecruiterResponse/);
assert.match(routeSource, /normalizeSearchV2Query/);
assert.match(routeSource, /dedupeCandidateSearchV2Documents/);
assert.match(routeSource, /rankedSearchCache/);
assert.match(routeSource, /SEARCH_RANKING_CACHE_VERSION/);
assert.match(routeSource, /authorizationScopeHash/);
assert.match(routeSource, /paginateRankedCandidatesV2/);
assert.match(routeSource, /cacheHit: true/);

assert.match(routeSource, /candidateWrites:\s*0/);

assert.doesNotMatch(routeSource, /\.insert\s*\(/);

assert.doesNotMatch(routeSource, /\.update\s*\(/);

assert.doesNotMatch(routeSource, /\.delete\s*\(/);

console.log("candidateSearchV2Api.test.ts passed");
