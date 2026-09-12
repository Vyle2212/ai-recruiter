import type { GuidedSearchHandoff } from "./guidedSourcingTypes";
import { canonicalSearchV2QueryKey } from "./searchV2QueryNormalization";

export type GuidedSearchIdentity = Readonly<{
  planId: string;
  sourceMode: NonNullable<GuidedSearchHandoff["provenance"]["sourceType"]>;
  sourceIdentity: string;
  sourceFingerprint: string;
  preparedQuery: string;
  normalizedQueryHash: string;
  integrityPlanVersion: GuidedSearchHandoff["integrityPlan"]["version"];
  confirmationRevision: number;
}>;

export type GuidedSearchSnapshot = Readonly<{
  identity: GuidedSearchIdentity;
  integrityPlan: GuidedSearchHandoff["integrityPlan"];
  provenance: GuidedSearchHandoff["provenance"];
}>;

export function normalizePreparedSearchQuery(value: string) {
  return canonicalSearchV2QueryKey(value);
}

export function normalizedPreparedQueryHash(value: string) {
  const normalized = normalizePreparedSearchQuery(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildGuidedSearchIdentity(
  handoff: GuidedSearchHandoff,
  confirmationRevision: number,
): GuidedSearchIdentity {
  const sourceMode = handoff.provenance.sourceType || "guided";
  const sourceFingerprint =
    handoff.provenance.sourceFingerprint || handoff.integrityPlan.planIdentity;
  return {
    planId: handoff.integrityPlan.planIdentity,
    sourceMode,
    sourceIdentity:
      handoff.provenance.sourceIdentity ||
      handoff.provenance.jobId ||
      `${sourceMode}:${sourceFingerprint}`,
    sourceFingerprint,
    preparedQuery: handoff.query,
    normalizedQueryHash: normalizedPreparedQueryHash(handoff.query),
    integrityPlanVersion: handoff.integrityPlan.version,
    confirmationRevision,
  };
}

export function guidedIdentityMatchesQuery(
  identity: GuidedSearchIdentity | null | undefined,
  query: string,
) {
  return Boolean(
    identity &&
    identity.normalizedQueryHash === normalizedPreparedQueryHash(query),
  );
}

export function validGuidedSearchSnapshot(
  value: unknown,
  query: string,
): value is GuidedSearchSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<GuidedSearchSnapshot>;
  const identity = snapshot.identity as
    Partial<GuidedSearchIdentity> | undefined;
  return Boolean(
    identity &&
    typeof identity.planId === "string" &&
    typeof identity.sourceIdentity === "string" &&
    typeof identity.sourceFingerprint === "string" &&
    typeof identity.preparedQuery === "string" &&
    typeof identity.normalizedQueryHash === "string" &&
    Number.isInteger(identity.confirmationRevision) &&
    snapshot.integrityPlan?.version === "search-integrity-v20" &&
    snapshot.integrityPlan.planIdentity === identity.planId &&
    snapshot.provenance &&
    guidedIdentityMatchesQuery(identity as GuidedSearchIdentity, query),
  );
}
