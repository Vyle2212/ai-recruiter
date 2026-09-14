import assert from "node:assert/strict";

import {
  acceptanceFinalDecision,
  acceptanceFixtureLeaseRecord,
  acceptanceFixtureState,
  fixtureInstallAllowed,
  fixtureRemovalAllowed,
  parseAcceptanceExternalMode,
  type AcceptanceFixtureLeaseExpectation,
  type AcceptanceFixturePresence,
} from "../lib/acceptanceFixtureLease";

const expected: AcceptanceFixtureLeaseExpectation = {
  runId: "ptf1c2-gh-100-1",
  syntheticNamespace: "ptf1c2/ptf1c2-gh-100-1",
  environmentId: "acceptance-a",
  projectRef: "acceptance-project",
  expectedCommitSha: "a".repeat(40),
  expiresAt: "2030-01-01T00:00:00.000Z",
};
const empty: AcceptanceFixturePresence = {
  registry: null,
  candidateById: false,
  candidateByMarker: false,
  indexByCandidateId: false,
};
const owned = {
  ...acceptanceFixtureLeaseRecord(expected),
};

assert.equal(acceptanceFixtureState(empty, expected), "available");
assert.equal(fixtureInstallAllowed("available"), true);
assert.equal(
  acceptanceFixtureState(
    {
      registry: owned,
      candidateById: true,
      candidateByMarker: true,
      indexByCandidateId: true,
    },
    expected,
  ),
  "owned_complete",
);
assert.equal(
  acceptanceFixtureState(
    {
      registry: {
        ...owned,
        expires_at: "2030-01-01T00:00:00+00:00",
      },
      candidateById: true,
      candidateByMarker: true,
      indexByCandidateId: true,
    },
    expected,
  ),
  "owned_complete",
);
assert.equal(
  acceptanceFixtureState(
    {
      registry: owned,
      candidateById: true,
      candidateByMarker: true,
      indexByCandidateId: false,
    },
    expected,
  ),
  "owned_partial",
);
assert.equal(
  fixtureRemovalAllowed({ state: "owned_partial", registry: owned, expected })
    .allowed,
  true,
);
assert.equal(
  acceptanceFixtureState({ ...empty, candidateById: true }, expected),
  "orphan_candidate",
);
assert.equal(
  acceptanceFixtureState({ ...empty, indexByCandidateId: true }, expected),
  "orphan_index",
);
const foreign = { ...owned, owner_run_id: "ptf1c2-gh-foreign-1" };
assert.equal(
  acceptanceFixtureState(
    {
      registry: foreign,
      candidateById: true,
      candidateByMarker: true,
      indexByCandidateId: true,
    },
    expected,
    new Date("2029-01-01"),
  ),
  "foreign_active",
);
assert.equal(
  fixtureRemovalAllowed({
    state: "foreign_active",
    registry: foreign,
    expected,
  }).allowed,
  false,
);
const expired = { ...foreign, expires_at: "2020-01-01T00:00:00.000Z" };
assert.equal(
  acceptanceFixtureState(
    {
      registry: expired,
      candidateById: true,
      candidateByMarker: true,
      indexByCandidateId: true,
    },
    expected,
    new Date("2029-01-01"),
  ),
  "foreign_expired",
);
assert.equal(
  fixtureRemovalAllowed({
    state: "foreign_expired",
    registry: expired,
    expected,
  }).allowed,
  false,
);
assert.equal(
  fixtureRemovalAllowed({
    state: "foreign_expired",
    registry: expired,
    expected,
    protectedExpiredCleanup: true,
  }).allowed,
  true,
);
assert.equal(
  acceptanceFixtureState(
    {
      registry: foreign,
      candidateById: false,
      candidateByMarker: false,
      indexByCandidateId: false,
    },
    expected,
    new Date("2019-01-01"),
  ),
  "registry_without_candidate",
);
assert.deepEqual(
  fixtureRemovalAllowed({ state: "available", registry: null, expected }),
  { allowed: true, idempotent: true },
);
assert.equal(parseAcceptanceExternalMode("required"), "required");
assert.equal(parseAcceptanceExternalMode("disabled"), "disabled");
assert.throws(() => parseAcceptanceExternalMode("optional"));
assert.equal(
  acceptanceFinalDecision({
    externalMode: "required",
    testsPassed: true,
    externalTestsExecuted: false,
    externalProviderDisabled: false,
    fixtureInstalled: true,
    fixtureRemoved: true,
    cleanupVerified: true,
    authenticatedRoleMatrixComplete: true,
  }),
  "NO_GO",
);
assert.equal(
  acceptanceFinalDecision({
    externalMode: "disabled",
    testsPassed: true,
    externalTestsExecuted: false,
    externalProviderDisabled: true,
    fixtureInstalled: true,
    fixtureRemoved: true,
    cleanupVerified: true,
    authenticatedRoleMatrixComplete: true,
  }),
  "PASS_INTERNAL_ONLY",
);
assert.equal(
  acceptanceFinalDecision({
    externalMode: "required",
    testsPassed: true,
    externalTestsExecuted: true,
    externalProviderDisabled: false,
    fixtureInstalled: true,
    fixtureRemoved: true,
    cleanupVerified: true,
    authenticatedRoleMatrixComplete: true,
  }),
  "PASS_FULL_SCOPE",
);

console.log("Authenticated acceptance fixture lease tests passed.");
