import { createHash } from "node:crypto";

import { buildCandidateSearchIndexRow } from "./candidateSearchIndex";
import { candidateSearchLifecycleDecision } from "./candidateSearchLifecycle";
import { buildSearchIndexAudit } from "./searchIndexAudit";

type AnyRecord = Record<string, any>;

export type SearchIndexExactSetRepairRequest = {
  artifact: "candidate_search_index_exact_set_repair_v1";
  targetCommitSha: string;
  planFingerprint: string;
  expectedCandidateCount: number;
  expectedIndexCount: number;
  expectedDeleteCount: number;
  expectedRemainingIndexCount: number;
  candidateVersions: Array<{
    candidateId: string;
    updatedAt: string | null;
  }>;
  indexVersions: Array<{
    candidateId: string;
    sourceUpdatedAt: string | null;
    updatedAt: string | null;
  }>;
  deleteCandidateIds: string[];
};

export type SearchIndexExactSetRepairReport = {
  artifact: "candidate_search_index_exact_set_repair_preview_v1";
  targetCommitSha: string;
  planFingerprint: string;
  candidatesChecked: number;
  indexRowsChecked: number;
  rowsPlannedForDeletion: number;
  rowsExpectedAfterRepair: number;
  exactSetAfterRepair: true;
  databaseWrites: 0;
  readyForSingleTransactionRpc: true;
  privacy: {
    candidateIdentifiersSerialized: 0;
    candidateContactsSerialized: 0;
    cvContentsSerialized: 0;
  };
};

const COMMIT_SHA = /^[0-9a-f]{40}$/;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function identifier(value: unknown) {
  return String(value ?? "").trim();
}

function nullableTimestamp(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (!Number.isFinite(Date.parse(normalized)))
    throw new Error("search_index_repair_timestamp_invalid");
  return normalized;
}

function assertUniqueIdentifiers(values: string[], code: string) {
  if (values.some((value) => !value) || new Set(values).size !== values.length)
    throw new Error(code);
}

export function verifySearchIndexExactSetRepairRequest(
  input: unknown,
  expectedCommitSha?: string,
): SearchIndexExactSetRepairRequest {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("search_index_repair_request_invalid");
  const value = input as Record<string, unknown>;
  if (
    value.artifact !== "candidate_search_index_exact_set_repair_v1" ||
    !COMMIT_SHA.test(String(value.targetCommitSha || ""))
  )
    throw new Error("search_index_repair_request_invalid");
  if (
    expectedCommitSha !== undefined &&
    value.targetCommitSha !== expectedCommitSha
  )
    throw new Error("search_index_repair_commit_mismatch");
  if (
    !Array.isArray(value.candidateVersions) ||
    !Array.isArray(value.indexVersions) ||
    !Array.isArray(value.deleteCandidateIds)
  )
    throw new Error("search_index_repair_request_invalid");

  const nonNegativeInteger = (item: unknown, code: string) => {
    if (!Number.isSafeInteger(item) || Number(item) < 0) throw new Error(code);
    return Number(item);
  };
  const candidateVersions = value.candidateVersions.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("search_index_repair_candidate_snapshot_invalid");
    const row = item as Record<string, unknown>;
    return {
      candidateId: identifier(row.candidateId),
      updatedAt: nullableTimestamp(row.updatedAt),
    };
  });
  const indexVersions = value.indexVersions.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("search_index_repair_index_snapshot_invalid");
    const row = item as Record<string, unknown>;
    return {
      candidateId: identifier(row.candidateId),
      sourceUpdatedAt: nullableTimestamp(row.sourceUpdatedAt),
      updatedAt: nullableTimestamp(row.updatedAt),
    };
  });
  const deleteCandidateIds = value.deleteCandidateIds.map(identifier);
  assertUniqueIdentifiers(
    candidateVersions.map((row) => row.candidateId),
    "search_index_repair_candidate_snapshot_invalid",
  );
  assertUniqueIdentifiers(
    indexVersions.map((row) => row.candidateId),
    "search_index_repair_index_snapshot_invalid",
  );
  assertUniqueIdentifiers(
    deleteCandidateIds,
    "search_index_repair_delete_set_invalid",
  );

  const expectedCandidateCount = nonNegativeInteger(
    value.expectedCandidateCount,
    "search_index_repair_count_invalid",
  );
  const expectedIndexCount = nonNegativeInteger(
    value.expectedIndexCount,
    "search_index_repair_count_invalid",
  );
  const expectedDeleteCount = nonNegativeInteger(
    value.expectedDeleteCount,
    "search_index_repair_count_invalid",
  );
  const expectedRemainingIndexCount = nonNegativeInteger(
    value.expectedRemainingIndexCount,
    "search_index_repair_count_invalid",
  );
  const indexedIds = new Set(indexVersions.map((row) => row.candidateId));
  if (
    expectedCandidateCount !== candidateVersions.length ||
    expectedIndexCount !== indexVersions.length ||
    expectedDeleteCount !== deleteCandidateIds.length ||
    expectedDeleteCount <= 0 ||
    expectedRemainingIndexCount + expectedDeleteCount !== expectedIndexCount ||
    deleteCandidateIds.some((candidateId) => !indexedIds.has(candidateId))
  )
    throw new Error("search_index_repair_count_invalid");

  const planBasis = {
    artifact: "candidate_search_index_exact_set_repair_v1" as const,
    targetCommitSha: String(value.targetCommitSha),
    expectedCandidateCount,
    expectedIndexCount,
    expectedDeleteCount,
    expectedRemainingIndexCount,
    candidateVersions,
    indexVersions,
    deleteCandidateIds,
  };
  const planFingerprint = String(value.planFingerprint || "");
  if (!/^[0-9a-f]{64}$/.test(planFingerprint))
    throw new Error("search_index_repair_fingerprint_invalid");
  if (fingerprint(planBasis) !== planFingerprint)
    throw new Error("search_index_repair_fingerprint_mismatch");
  return { ...planBasis, planFingerprint };
}

export function buildSearchIndexExactSetRepair(input: {
  candidates: AnyRecord[];
  indexRows: AnyRecord[];
  targetCommitSha: string;
}): {
  request: SearchIndexExactSetRepairRequest;
  report: SearchIndexExactSetRepairReport;
} {
  if (!COMMIT_SHA.test(input.targetCommitSha))
    throw new Error("search_index_repair_commit_invalid");

  const candidateVersions = input.candidates
    .map((candidate) => ({
      candidateId: identifier(candidate.id ?? candidate.candidate_id),
      updatedAt: nullableTimestamp(candidate.updated_at),
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const indexVersions = input.indexRows
    .map((row) => ({
      candidateId: identifier(row.candidate_id ?? row.id),
      sourceUpdatedAt: nullableTimestamp(row.source_updated_at),
      updatedAt: nullableTimestamp(row.updated_at),
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));

  assertUniqueIdentifiers(
    candidateVersions.map((row) => row.candidateId),
    "search_index_repair_candidate_snapshot_invalid",
  );
  assertUniqueIdentifiers(
    indexVersions.map((row) => row.candidateId),
    "search_index_repair_index_snapshot_invalid",
  );

  const builderIndexableCandidateIds = input.candidates.flatMap((candidate) => {
    const row = buildCandidateSearchIndexRow(candidate);
    return row ? [identifier(row.candidate_id)] : [];
  });
  const builderIndexable = new Set(builderIndexableCandidateIds);
  const indexableCandidateIds = input.candidates
    .filter(
      (candidate) =>
        candidateSearchLifecycleDecision(candidate).visible &&
        builderIndexable.has(
          identifier(candidate.id ?? candidate.candidate_id),
        ),
    )
    .map((candidate) => identifier(candidate.id ?? candidate.candidate_id));
  const audit = buildSearchIndexAudit({
    candidates: input.candidates,
    indexRows: input.indexRows,
    indexableCandidateIds,
    sampleSize: 0,
  });

  if (
    audit.missingIndexRows !== 0 ||
    audit.staleIndexRows !== 0 ||
    audit.duplicateIndexRows !== 0 ||
    audit.orphanIndexRows !== 0 ||
    audit.malformedIndexRows !== 0
  )
    throw new Error("search_index_repair_not_delete_only");

  const indexable = new Set(indexableCandidateIds);
  const deleteCandidateIds = indexVersions
    .map((row) => row.candidateId)
    .filter((candidateId) => !indexable.has(candidateId));
  if (
    deleteCandidateIds.length === 0 ||
    deleteCandidateIds.length !== audit.blockedCandidateIndexRows
  )
    throw new Error("search_index_repair_delete_set_mismatch");

  const expectedRemainingIndexCount =
    indexVersions.length - deleteCandidateIds.length;
  if (
    expectedRemainingIndexCount !== audit.eligibleCandidates ||
    expectedRemainingIndexCount !== indexable.size
  )
    throw new Error("search_index_repair_remaining_set_mismatch");

  const planBasis = {
    artifact: "candidate_search_index_exact_set_repair_v1" as const,
    targetCommitSha: input.targetCommitSha,
    expectedCandidateCount: candidateVersions.length,
    expectedIndexCount: indexVersions.length,
    expectedDeleteCount: deleteCandidateIds.length,
    expectedRemainingIndexCount,
    candidateVersions,
    indexVersions,
    deleteCandidateIds,
  };
  const planFingerprint = fingerprint(planBasis);
  const request: SearchIndexExactSetRepairRequest = {
    ...planBasis,
    planFingerprint,
  };
  return {
    request,
    report: {
      artifact: "candidate_search_index_exact_set_repair_preview_v1",
      targetCommitSha: input.targetCommitSha,
      planFingerprint,
      candidatesChecked: candidateVersions.length,
      indexRowsChecked: indexVersions.length,
      rowsPlannedForDeletion: deleteCandidateIds.length,
      rowsExpectedAfterRepair: expectedRemainingIndexCount,
      exactSetAfterRepair: true,
      databaseWrites: 0,
      readyForSingleTransactionRpc: true,
      privacy: {
        candidateIdentifiersSerialized: 0,
        candidateContactsSerialized: 0,
        cvContentsSerialized: 0,
      },
    },
  };
}
