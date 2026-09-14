import assert from "node:assert/strict";

import {
  ACCEPTANCE_INTERNAL_SEARCH_QUERY,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
  acceptanceSyntheticRegistryBlockers,
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

const registry = {
  marker: ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  fixture_version: ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
  synthetic_namespace: "ptf1c2a/persistent-search-fixture",
  owner_run_id: "ptf1c2-fixture-owner",
  expected_commit_sha: "b".repeat(40),
  search_query: ACCEPTANCE_INTERNAL_SEARCH_QUERY,
  active: true,
};
assert.deepEqual(
  acceptanceSyntheticRegistryBlockers(
    registry,
    "b".repeat(40),
    "ptf1c2-fixture-owner",
  ),
  [],
);
assert.ok(
  acceptanceSyntheticRegistryBlockers(null, "b".repeat(40), "owner").includes(
    "synthetic_registry_missing",
  ),
);
assert.ok(
  acceptanceSyntheticRegistryBlockers(
    registry,
    "b".repeat(40),
    "wrong-owner",
  ).includes("synthetic_registry_owner_mismatch"),
);

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

console.log("Authenticated acceptance synthetic candidate tests passed.");
