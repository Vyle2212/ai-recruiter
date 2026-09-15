import assert from "node:assert/strict";

import {
  ACCEPTANCE_INTERNAL_SEARCH_QUERY,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
  acceptanceSyntheticCandidateRecord,
  validateAcceptanceSyntheticCandidate,
} from "../lib/acceptanceSyntheticCandidateFixture";

const fixture = acceptanceSyntheticCandidateRecord();
const valid = validateAcceptanceSyntheticCandidate(fixture);
assert.equal(valid.valid, true, valid.blockers.join(","));
assert.equal(ACCEPTANCE_INTERNAL_SEARCH_QUERY, fixture.name);
assert.equal(ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER, fixture.name);
assert.equal(valid.canonical.employmentRecords, 2);
assert.ok(valid.canonical.projectRecords >= 1);
assert.equal(valid.canonical.currentEmploymentRecords, 1);
assert.ok((valid.canonical.totalCareerYears || 0) >= 7);

assert.equal(ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION, "ptf1c2a-candidate-v3");

for (const mutation of [
  { name: "Real Person" },
  { email: "person@example.com" },
  { phone: "+1 555 555 5555" },
  { linkedin_url: "https://linkedin.com/in/example" },
  { resume_text: "Generic profile" },
]) {
  const result = validateAcceptanceSyntheticCandidate({
    ...fixture,
    ...mutation,
  });
  assert.equal(result.valid, false);
}
const serialized = JSON.stringify(fixture);
assert.doesNotMatch(
  serialized,
  /linkedin\.com|example\.com|@gmail\.|@outlook\./i,
);
assert.match(serialized, /acceptance\.invalid/);

console.log("Authenticated acceptance synthetic candidate tests passed.");

// The selected database schema stores these columns as TEXT, not JSONB.
for (const field of [
  "experience",
  "education",
  "extraction_confidence",
  "confidence",
] as const) {
  assert.equal(typeof fixture[field], "string", field);
}
assert.equal(JSON.parse(fixture.experience).length, 2);
const databaseRoundTrip = JSON.parse(JSON.stringify(fixture));
assert.equal(
  validateAcceptanceSyntheticCandidate(databaseRoundTrip).valid,
  true,
);
assert.equal(
  validateAcceptanceSyntheticCandidate({ ...fixture, experience: "[]" }).valid,
  false,
);

// Reproduce the deployed dataset's canonical-name override, not the raw adapter.
const {
  normalizeActualCandidateSchema,
} = require("../lib/candidate360SchemaNormalize");
const { buildCandidateSearchIndexRow } = require("../lib/candidateSearchIndex");
const {
  candidateSearchV2ProjectionDocument,
} = require("../lib/candidateSearchV2Projection");
const {
  detectSearchV2UnifiedIntent,
  canonicalLookupMatches,
} = require("../lib/searchV2UnifiedIntent");
function lookup(record: typeof fixture) {
  const canonical = normalizeActualCandidateSchema(record);
  const document = candidateSearchV2ProjectionDocument({
    ...buildCandidateSearchIndexRow(record),
    display_name: canonical.candidateName || null,
  });
  return canonicalLookupMatches(
    [document],
    detectSearchV2UnifiedIntent(record.name),
  );
}
assert.equal(lookup({ ...fixture, name: "PTF Synthetic Tester" }).length, 0);
assert.equal(lookup(fixture).length, 1);
assert.equal(
  lookup(fixture)[0].document.candidateId,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
);
console.log(
  "Canonical indexed name lookup regression passed (old fixture zero, corrected fixture one).",
);
