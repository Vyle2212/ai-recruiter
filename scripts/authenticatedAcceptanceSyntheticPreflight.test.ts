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

assert.equal(ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION, "ptf1c2a-candidate-v2");

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
