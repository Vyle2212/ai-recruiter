import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchCanonicalCandidatesByIntent } from "../lib/candidateSearchV2Engine";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import {
  canonicalLookupMatches,
  detectSearchV2UnifiedIntent,
  identityOnlyCandidateProjection,
} from "../lib/searchV2UnifiedIntent";
import { canonicalTalentSearchIdentity } from "../lib/talentSearchDisplay";

const profileEvidence = {
  name: true,
  title: true,
  employer: true,
  location: true,
  experienceDuration: false,
  employmentHistory: true,
  projectHistory: false,
  education: false,
  certifications: false,
  skills: true,
};
const candidate = (
  candidateId: string,
  candidateName: string,
  overrides: Partial<CandidateSearchV2Document> = {},
): CandidateSearchV2Document => ({
  candidateId,
  canonicalCandidateId: candidateId,
  sourceCandidateIds: [candidateId],
  candidateName,
  alternateNames: [],
  currentTitle: "Business Support Analyst (SAP FICO)",
  currentEmployer: "PT Farpoint Prima",
  historicalEmployers: ["PT Farpoint Prima"],
  location: "Indonesia",
  country: "Indonesia",
  totalYearsExperience: null,
  skills: ["FICO"],
  sapModules: ["FICO"],
  languages: [],
  industries: [],
  searchableText: `${candidateName} SAP FICO`,
  profileEvidence,
  domainEvidence: { FICO: "PRIMARY" },
  implementationEvidenceLevel: "unverified",
  seniorityEvidenceLevel: "unverified",
  locationEvidenceState: "VERIFIED",
  trustedCandidateEvidence: {
    candidateId,
    values: [
      {
        value: "FICO",
        sourceType: "direct_skill",
        sourceField: "skills",
        sourceRecordId: candidateId,
        provenance: "candidate_record_raw",
        trusted: true,
      },
    ],
  },
  ...overrides,
});

const indra = candidate("person-indra", "Indra Permana");
const teck = candidate("person-teck", "Teck Chiewlim", {
  currentTitle: "SAP FICO Functional Consultant",
  currentEmployer: "Magnus Management Consultants",
});
const gunawan = candidate("person-gunawan", "Gunawan Lie", {
  currentTitle: null,
  currentEmployer: null,
  searchableText: "Senior SAP consultant with experience of over 20 years",
});
const stableAnonymousId = "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8";
const anonymous = candidate(stableAnonymousId, "", {
  currentTitle: "SAP PS Team Lead",
});
const sameNameOne = candidate("same-name-one", "MICAELA JOYCE OLEDAN", {
  location: "Malaysia",
});
const sameNameTwo = candidate("same-name-two", "MICAELA JOYCE OLEDAN", {
  location: "Philippines",
});
const accenture = candidate("accenture-person", "Grounded Employer", {
  currentEmployer: "Current Co",
  historicalEmployers: ["Accenture Technology Solutions"],
});
const clientOnly = candidate("client-only", "Project Client Only", {
  currentEmployer: "Employer Co",
  historicalEmployers: ["Employer Co"],
  searchableText: "Client: Accenture",
});
const documents = [
  indra,
  teck,
  gunawan,
  anonymous,
  sameNameOne,
  sameNameTwo,
  accenture,
  clientOnly,
];
const namelessWithUnsafeAlternate = candidate(
  "person-nameless-indra-fragment",
  "",
);
namelessWithUnsafeAlternate.candidateName = null;
namelessWithUnsafeAlternate.alternateNames = ["Indra"];
assert.equal(
  canonicalLookupMatches(
    [...documents, namelessWithUnsafeAlternate],
    detectSearchV2UnifiedIntent("Indra"),
  ).some(
    ({ document }) =>
      document.candidateId === namelessWithUnsafeAlternate.candidateId,
  ),
  false,
  "a raw alternate-name fragment cannot make a nameless profile an identity match",
);

for (const name of [
  "Indra Permana",
  "indra   permana",
  "Teck Chiewlim",
  "Gunawan",
]) {
  const intent = detectSearchV2UnifiedIntent(name);
  assert.equal(intent.type, "candidate_name_lookup");
  assert.ok(intent.searchable);
}
assert.equal(
  canonicalLookupMatches(
    documents,
    detectSearchV2UnifiedIntent("Indra Permana"),
  )[0]?.document.candidateId,
  "person-indra",
);
assert.equal(
  canonicalLookupMatches(documents, detectSearchV2UnifiedIntent("Gunawan"))[0]
    ?.document.candidateId,
  "person-gunawan",
);
assert.equal(
  canonicalLookupMatches(documents, detectSearchV2UnifiedIntent("Gunawan"))[0]
    ?.matchRank,
  1,
  "a partial name remains distinct from an exact identity match",
);
assert.equal(
  canonicalLookupMatches(documents, detectSearchV2UnifiedIntent("#A8CCB8"))[0]
    ?.document.candidateId,
  anonymous.candidateId,
);
for (const tokenQuery of ["A8CCB8", "#a8ccb8", "a8ccb8"]) {
  const tokenIntent = detectSearchV2UnifiedIntent(tokenQuery);
  assert.equal(tokenIntent.type, "identity_token_lookup");
  assert.equal(tokenIntent.lookupValue, "#A8CCB8");
  assert.equal(
    canonicalLookupMatches(documents, tokenIntent)[0]?.document.candidateId,
    anonymous.candidateId,
  );
}
assert.notEqual(
  detectSearchV2UnifiedIntent("consult").type,
  "identity_token_lookup",
  "ordinary words are not token-shaped identities",
);
assert.equal(
  canonicalLookupMatches(documents, detectSearchV2UnifiedIntent("#A8CCC8"))[0]
    ?.document.candidateId,
  anonymous.candidateId,
  "published legacy alias remains resolvable when unique",
);
assert.equal(
  canonicalLookupMatches(
    [...documents, candidate("other-person-A8CCA8", "Other Person")],
    detectSearchV2UnifiedIntent("#A8CCA8"),
  )[0]?.document.candidateId,
  "other-person-A8CCA8",
  "similar tokens do not use fuzzy identity migration",
);
assert.equal(
  canonicalTalentSearchIdentity(stableAnonymousId, "").identityToken,
  "#A8CCB8",
);
assert.equal(
  canonicalTalentSearchIdentity(
    stableAnonymousId,
    "Changed normalized title and employer",
  ).identityToken,
  "#A8CCB8",
  "public token is independent of mutable profile fields",
);
assert.equal(
  canonicalLookupMatches(
    documents,
    detectSearchV2UnifiedIntent("Micaela Joyce Oledan"),
  ).length,
  2,
  "same-name canonical people remain distinct",
);

const pureName = searchCanonicalCandidatesByIntent(
  documents,
  { query: "Indra Permana", minimumScore: 50 },
  detectSearchV2UnifiedIntent("Indra Permana"),
);
assert.equal(pureName.length, 1);
assert.equal(
  pureName[0].candidateId,
  indra.candidateId,
  "explicit identity bypasses the Relevant discovery threshold",
);
const hybridIntent = detectSearchV2UnifiedIntent(
  "Indra Permana SAP FICO implementation",
);
assert.equal(hybridIntent.type, "hybrid_candidate_evaluation");
const hybrid = searchCanonicalCandidatesByIntent(
  documents,
  { query: "Indra Permana SAP FICO implementation", minimumScore: 50 },
  hybridIntent,
);
assert.equal(
  hybrid[0]?.candidateId,
  indra.candidateId,
  "named candidate remains visible when implementation evidence is unverified",
);
assert.ok(
  hybrid[0]?.criteriaDiagnostic || hybrid[0]?.integrity,
  "hybrid lookup retains evaluation diagnostics",
);

assert.equal(
  detectSearchV2UnifiedIntent("SAP FICO Consultant").type,
  "title_search",
);
assert.equal(
  detectSearchV2UnifiedIntent(
    "SAP FICO consultant in Malaysia with 8+ years and implementation experience",
  ).type,
  "requirements_search",
);
const companyIntent = detectSearchV2UnifiedIntent(
  "SAP consultants from Accenture",
);
assert.equal(companyIntent.type, "company_search");
assert.deepEqual(
  canonicalLookupMatches(documents, companyIntent).map(
    (item) => item.document.candidateId,
  ),
  ["accenture-person"],
  "only grounded employers satisfy company lookup",
);
assert.equal(
  detectSearchV2UnifiedIntent(
    "Job description: responsibilities and required qualifications for SAP Finance",
  ).type,
  "job_description_search",
);
assert.equal(detectSearchV2UnifiedIntent("---").searchable, false);

const large = Array.from({ length: 822 }, (_, index) =>
  candidate(`population-${index}`, `Person ${index}`),
);
large.push(teck);
const started = performance.now();
const direct = canonicalLookupMatches(
  large,
  detectSearchV2UnifiedIntent("Teck Chiewlim"),
);
assert.equal(direct.length, 1);
assert.ok(
  performance.now() - started < 250,
  "canonical name lookup avoids full scoring and completes within a bounded local time",
);
assert.notEqual(direct[0].document.currentTitle, "com");
const identityProjection = identityOnlyCandidateProjection(direct[0].document);
assert.equal(identityProjection.fitEvaluation, null);
assert.equal(identityProjection.score, null);
assert.equal(identityProjection.requiredCoveragePercent, null);
const canonicalCompletenessProjection = identityOnlyCandidateProjection(
  candidate("complete", "Complete Candidate", {
    profileQualityScore: 78,
    dataConfidenceScore: 91,
    sourceCompletenessScore: 89,
  }),
);
assert.deepEqual(
  [
    canonicalCompletenessProjection.profileCompletenessPercent,
    canonicalCompletenessProjection.profileDataConfidencePercent,
    canonicalCompletenessProjection.sourceCompletenessPercent,
  ],
  [78, 91, 89],
  "identity retrieval preserves the three canonical profile metrics without search-context recomputation",
);

const review = readFileSync(
  "app/recruiter/talent-search/v2/SearchPreparationReview.tsx",
  "utf8",
);
const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
assert.match(review, /Search intent:/);
assert.match(
  review,
  /No searchable name, title, company, skill or requirement was\s+recognized/,
);
assert.match(client, /candidate.*found/);
assert.match(route, /searchCanonicalCandidatesByIntent/);
assert.match(route, /SEARCH_INTENT_UNRECOGNIZED/);
assert.match(route, /identityOnlyCandidateProjection/);
assert.match(route, /evaluationMode: "identity_only"/);
assert.match(client, /Recruiter fit: Not evaluated/);
assert.match(client, /named candidate.*evaluated/);

console.log("Search V2 unified intent and canonical lookup tests passed.");
