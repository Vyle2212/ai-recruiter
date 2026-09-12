import assert from "node:assert/strict";
import type { CandidateSearchV2Document } from "../lib/candidateSearchV2Types";
import { buildSearchV2FastReview } from "../lib/searchV2FastReview";
import { searchV2HistoryQueryIdentity } from "../lib/searchV2History";
import {
  canonicalLookupMatches,
  confirmSearchV2IdentityIntent,
  detectSearchV2UnifiedIntent,
  identityOnlyCandidateProjection,
} from "../lib/searchV2UnifiedIntent";
import { normalizeSearchV2Query } from "../lib/searchV2QueryNormalization";

const gunawanQueries = [
  "Gunawan Lie",
  "Gunawan Lie:",
  "Gunawan Lie;",
  "Gunawan Lie,",
  "Gunawan Lie.",
  '"Gunawan Lie"',
  "“Gunawan Lie”",
  "(Gunawan Lie)",
  "[Gunawan Lie]",
  "Gunawan   Lie",
  "Gunawan Lie\n",
  "Gunawan Lie ",
  "Candidate: Gunawan Lie",
  "Name: Gunawan Lie",
  "Search for Gunawan Lie",
  "🔎 Gunawan Lie ✨",
];

const compoundGunawanQueries = [
  "Gunawan Lie:.",
  "Gunawan Lie::",
  "Gunawan Lie...",
  "Gunawan Lie!!!",
  "Gunawan Lie?!",
  "Gunawan Lie:;,.",
  "Gunawan Lie : .",
  '"Gunawan Lie:"',
  "\u201cGunawan Lie:\u201d",
  '("Gunawan Lie:.")',
  " Gunawan Lie:. ",
  "Gunawan Lie:\u200b.\u200b",
  "Gunawan Lie:\n.\n",
  "\u{1F50E} Gunawan Lie:;,. \u2728",
];
const equivalentGunawanQueries = [...gunawanQueries, ...compoundGunawanQueries];

for (const query of equivalentGunawanQueries) {
  const normalized = normalizeSearchV2Query(query);
  assert.equal(normalized.normalizedQuery, "Gunawan Lie", query);
  assert.equal(normalized.rawQuery, query, `${query} retains raw edit text`);
  assert.equal(
    normalizeSearchV2Query(normalized.normalizedQuery).normalizedQuery,
    normalized.normalizedQuery,
    `${query} normalization is idempotent`,
  );
  const intent = detectSearchV2UnifiedIntent(query);
  assert.equal(intent.searchable, true, query);
  assert.equal(intent.type, "candidate_name_lookup", query);
  assert.equal(intent.lookupValue, "Gunawan Lie", query);
}

assert.equal(normalizeSearchV2Query("Gunawan Lie:").structuredField, null);
assert.equal(
  normalizeSearchV2Query("Candidate: Gunawan Lie").structuredField,
  "candidate",
);
assert.equal(normalizeSearchV2Query("Candidate:").structuredField, null);

for (const query of ["---", " : ; , . ", "🔎✨", "\u200b\n"]) {
  assert.equal(normalizeSearchV2Query(query).normalizedQuery, "", query);
  assert.equal(detectSearchV2UnifiedIntent(query).searchable, false, query);
}

for (const query of [":;,.?!", "\u{1F50E}:;,. \u2728"]) {
  assert.equal(normalizeSearchV2Query(query).normalizedQuery, "", query);
  assert.equal(detectSearchV2UnifiedIntent(query).searchable, false, query);
}

for (const value of [
  "#A8CCB8",
  "S/4HANA",
  "FI/CO",
  "SAP PI/PO",
  "C++",
  "C#",
  ".NET",
  "Node.js",
  "O2C",
]) {
  assert.equal(normalizeSearchV2Query(value).normalizedQuery, value);
  assert.equal(normalizeSearchV2Query(`${value}:`).normalizedQuery, value);
  assert.equal(normalizeSearchV2Query(`${value}:;,.`).normalizedQuery, value);
  assert.equal(
    detectSearchV2UnifiedIntent(`${value}:`).searchable,
    true,
    value,
  );
}

for (const value of ["Élodie O'Connor-Smith", "José María", "李 明"]) {
  assert.equal(normalizeSearchV2Query(`“${value}”`).normalizedQuery, value);
  assert.equal(detectSearchV2UnifiedIntent(`“${value}”`).searchable, true);
}

for (const query of [
  "SAP FICO:",
  "Senior SAP Consultant,",
  "Singapore.",
  "Skill: C++",
  "Title: Senior SAP Consultant",
  "Company: DXC Technology",
])
  assert.equal(detectSearchV2UnifiedIntent(query).searchable, true, query);

const document = (
  candidateId: string,
  candidateName: string,
  currentEmployer = "",
) =>
  ({
    candidateId,
    candidateName,
    currentEmployer,
    historicalEmployers: currentEmployer ? [currentEmployer] : [],
    talentPool: "internal_profiles",
  }) as CandidateSearchV2Document;

const population = [
  document("gunawan", "Gunawan Lie"),
  document("near-name", "Gunawan Lien"),
  document("dxc-person", "Alex Tan", "DXC Technology"),
];
const cleanIntent = confirmSearchV2IdentityIntent(population, "Gunawan Lie");
const punctuatedIntent = confirmSearchV2IdentityIntent(
  population,
  "Gunawan Lie:",
);
assert.deepEqual(punctuatedIntent, cleanIntent);
const cleanMatches = canonicalLookupMatches(population, cleanIntent);
const punctuatedMatches = canonicalLookupMatches(population, punctuatedIntent);
assert.deepEqual(
  punctuatedMatches.map((item) => [item.document.candidateId, item.matchRank]),
  cleanMatches.map((item) => [item.document.candidateId, item.matchRank]),
);
assert.deepEqual(
  cleanMatches.map((item) => item.document.candidateId),
  ["gunawan"],
  "one exact name excludes near-name partial matches",
);
assert.deepEqual(
  identityOnlyCandidateProjection(cleanMatches[0].document, "exact"),
  identityOnlyCandidateProjection(punctuatedMatches[0].document, "exact"),
  "identity projection, exact label inputs, score and ranking are unchanged",
);

for (const query of equivalentGunawanQueries) {
  const equivalentIntent = confirmSearchV2IdentityIntent(population, query);
  assert.deepEqual(
    equivalentIntent,
    cleanIntent,
    `${query} intent equivalence`,
  );
  assert.deepEqual(
    canonicalLookupMatches(population, equivalentIntent).map((item) => [
      item.document.candidateId,
      item.matchRank,
    ]),
    cleanMatches.map((item) => [item.document.candidateId, item.matchRank]),
    `${query} result and rank equivalence`,
  );
}

const duplicatePopulation = [
  document("duplicate-b", "Gunawan Lie"),
  document("duplicate-a", "Gunawan Lie"),
];
assert.deepEqual(
  canonicalLookupMatches(
    duplicatePopulation,
    detectSearchV2UnifiedIntent('"Gunawan Lie"'),
  ).map((item) => item.document.candidateId),
  ["duplicate-a", "duplicate-b"],
  "duplicate exact identities remain deterministic and are all returned",
);
assert.equal(
  canonicalLookupMatches(
    population,
    detectSearchV2UnifiedIntent("Person Who Does Not Exist"),
  ).length,
  0,
);

const companyIntent = confirmSearchV2IdentityIntent(
  population,
  "DXC Technology;",
);
assert.equal(companyIntent.type, "company_search");
assert.deepEqual(
  canonicalLookupMatches(population, companyIntent).map(
    (item) => item.document.candidateId,
  ),
  ["dxc-person"],
);

const review = buildSearchV2FastReview({
  query: "Gunawan Lie:",
  talentPool: "internal_profiles",
});
assert.equal(review.preview.query, "Gunawan Lie");
assert.equal(
  detectSearchV2UnifiedIntent(review.preview.query).label,
  "Candidate name",
);

const historyKeys = equivalentGunawanQueries.map(searchV2HistoryQueryIdentity);
assert.equal(new Set(historyKeys).size, 1);
assert.equal(historyKeys[0], "gunawan lie");

console.log("Search V2 punctuation-tolerant query normalization tests passed.");
