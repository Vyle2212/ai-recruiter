import {
  ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
  ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
  ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER,
  ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
  type AcceptanceSyntheticRegistryRecord,
} from "./acceptanceSyntheticCandidateFixture";
import { pseudonymousAcceptanceIdentifier } from "./acceptanceEnvironmentSafety";

export type AcceptanceFixtureLeaseExpectation = {
  runId: string;
  syntheticNamespace: string;
  environmentId: string;
  projectRef: string;
  expectedCommitSha: string;
  expiresAt: string;
};

export type AcceptanceFixturePresence = {
  registry: AcceptanceSyntheticRegistryRecord | null;
  candidateById: boolean;
  candidateByMarker: boolean;
  indexByCandidateId: boolean;
};

export type AcceptanceFixtureState =
  | "available"
  | "owned_complete"
  | "owned_partial"
  | "foreign_active"
  | "foreign_expired"
  | "orphan_candidate"
  | "orphan_index"
  | "registry_without_candidate";

const clean = (value: unknown) => String(value || "").trim();

export function acceptanceFixtureLeaseRecord(
  expected: AcceptanceFixtureLeaseExpectation,
) {
  return {
    marker: ACCEPTANCE_SYNTHETIC_REGISTRY_MARKER,
    candidate_id: ACCEPTANCE_SYNTHETIC_CANDIDATE_ID,
    fixture_version: ACCEPTANCE_SYNTHETIC_FIXTURE_VERSION,
    synthetic_namespace: expected.syntheticNamespace,
    owner_run_id: expected.runId,
    owner_hash: pseudonymousAcceptanceIdentifier(expected.runId),
    environment_id: expected.environmentId,
    project_ref: expected.projectRef,
    expected_commit_sha: expected.expectedCommitSha,
    expires_at: expected.expiresAt,
    search_query: ACCEPTANCE_SYNTHETIC_CANDIDATE_MARKER,
    active: true,
  };
}

export function registryBelongsToRun(
  registry: AcceptanceSyntheticRegistryRecord | null,
  expected: AcceptanceFixtureLeaseExpectation,
) {
  if (!registry) return false;
  const lease = acceptanceFixtureLeaseRecord(expected);
  const expiryMatches =
    Number.isFinite(Date.parse(clean(registry.expires_at))) &&
    Date.parse(clean(registry.expires_at)) === Date.parse(lease.expires_at);
  return (
    expiryMatches &&
    registry.active === true &&
    Object.entries(lease)
      .filter(([key]) => !["expires_at", "active"].includes(key))
      .every(
        ([key, value]) =>
          clean(registry[key as keyof AcceptanceSyntheticRegistryRecord]) ===
          clean(value),
      )
  );
}

export function acceptanceFixtureState(
  presence: AcceptanceFixturePresence,
  expected: AcceptanceFixtureLeaseExpectation,
  now = new Date(),
): AcceptanceFixtureState {
  const { registry, candidateById, candidateByMarker, indexByCandidateId } =
    presence;
  if (!registry) {
    if (indexByCandidateId) return "orphan_index";
    if (candidateById || candidateByMarker) return "orphan_candidate";
    return "available";
  }
  if (registryBelongsToRun(registry, expected)) {
    return candidateById && candidateByMarker && indexByCandidateId
      ? "owned_complete"
      : "owned_partial";
  }
  const expiry = Date.parse(clean(registry.expires_at));
  if (Number.isFinite(expiry) && expiry <= now.getTime())
    return "foreign_expired";
  if (!candidateById || !candidateByMarker) return "registry_without_candidate";
  return "foreign_active";
}

export function fixtureInstallAllowed(state: AcceptanceFixtureState) {
  return state === "available";
}

export function fixtureRemovalAllowed(input: {
  state: AcceptanceFixtureState;
  registry: AcceptanceSyntheticRegistryRecord | null;
  expected: AcceptanceFixtureLeaseExpectation;
  protectedExpiredCleanup?: boolean;
}) {
  if (input.state === "available") return { allowed: true, idempotent: true };
  if (
    ["owned_complete", "owned_partial"].includes(input.state) &&
    registryBelongsToRun(input.registry, input.expected)
  )
    return { allowed: true, idempotent: false };
  if (
    input.state === "foreign_expired" &&
    input.protectedExpiredCleanup === true
  )
    return { allowed: true, idempotent: false };
  return { allowed: false, idempotent: false };
}

export type AcceptanceExternalMode = "required" | "disabled";

export function parseAcceptanceExternalMode(value: unknown) {
  const mode = clean(value);
  if (mode !== "required" && mode !== "disabled")
    throw new Error("acceptance_external_mode_invalid");
  return mode as AcceptanceExternalMode;
}

export function acceptanceFinalDecision(input: {
  externalMode: AcceptanceExternalMode;
  testsPassed: boolean;
  externalTestsExecuted: boolean;
  externalProviderDisabled: boolean;
  fixtureInstalled: boolean;
  fixtureRemoved: boolean;
  cleanupVerified: boolean;
  authenticatedRoleMatrixComplete: boolean;
}) {
  if (
    !input.testsPassed ||
    !input.fixtureInstalled ||
    !input.fixtureRemoved ||
    !input.cleanupVerified ||
    !input.authenticatedRoleMatrixComplete
  )
    return "NO_GO" as const;
  if (input.externalMode === "required")
    return input.externalTestsExecuted ? ("PASS_FULL_SCOPE" as const) : "NO_GO";
  return input.externalProviderDisabled
    ? ("PASS_INTERNAL_ONLY" as const)
    : ("NO_GO" as const);
}
