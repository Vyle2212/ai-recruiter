import { candidateSearchLifecycleDecision } from "./candidateSearchLifecycle";

type AnyRecord = Record<string, any>;

export type SearchIndexAuditInput = {
  candidates: AnyRecord[];
  indexRows: AnyRecord[];
  /** Exact IDs for which the canonical row builder returned a row. */
  indexableCandidateIds?: string[];
  sampleSize?: number;
};

export type SearchIndexAuditSummary = {
  candidatesCount: number;
  eligibleCandidates: number;
  blockedCandidates: number;
  searchIndexRows: number;
  uniqueIndexedCandidates: number;
  missingIndexRows: number;
  staleIndexRows: number;
  duplicateIndexRows: number;
  blockedCandidateIndexRows: number;
  orphanIndexRows: number;
  malformedIndexRows: number;
  unexpectedIndexedCandidates: number;
  exactSetAligned: boolean;
  staleIndexRowIds: string[];
  duplicateIndexCandidateIds: string[];
  sampleMissingCandidateIds: string[];
  sampleStaleCandidateIds: string[];
  sampleDuplicateCandidateIds: string[];
  sampleBlockedCandidateIds: string[];
  sampleOrphanCandidateIds: string[];
  recommendation: string;
};

function idOf(value: any) {
  return String(value || "").trim();
}

function timeOf(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function buildSearchIndexAudit(
  input: SearchIndexAuditInput,
): SearchIndexAuditSummary {
  const sampleSize = input.sampleSize ?? 20;
  const candidates = input.candidates || [];
  const indexRows = input.indexRows || [];
  const candidateById = new Map(
    candidates
      .map((row) => [idOf(row.id || row.candidate_id), row])
      .filter(([id]) => Boolean(id)) as [string, AnyRecord][],
  );
  const candidateIds = new Set(candidateById.keys());
  const canonicalIndexableIds =
    input.indexableCandidateIds === undefined
      ? null
      : new Set(input.indexableCandidateIds.map(idOf).filter(Boolean));
  const eligibleCandidateIds = new Set(
    [...candidateById.entries()]
      .filter(
        ([candidateId, candidate]) =>
          candidateSearchLifecycleDecision(candidate).visible &&
          (!canonicalIndexableIds || canonicalIndexableIds.has(candidateId)),
      )
      .map(([candidateId]) => candidateId),
  );
  const indexCounts = new Map<string, number>();
  const indexedIds = new Set<string>();

  for (const row of indexRows) {
    const candidateId = idOf(row.candidate_id || row.id);
    if (!candidateId) continue;
    indexedIds.add(candidateId);
    indexCounts.set(candidateId, (indexCounts.get(candidateId) || 0) + 1);
  }

  const missing = [...eligibleCandidateIds]
    .filter((candidateId) => !indexedIds.has(candidateId))
    .sort();
  const duplicateIds = [...indexCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([candidateId]) => candidateId)
    .sort();

  const staleIds: string[] = [];
  for (const row of indexRows) {
    const candidateId = idOf(row.candidate_id || row.id);
    if (!candidateId || !eligibleCandidateIds.has(candidateId)) continue;
    const candidate = candidateById.get(candidateId) || {};
    const candidateUpdatedAt = timeOf(
      candidate.updated_at || candidate.source_updated_at,
    );
    const indexUpdatedAt = timeOf(row.source_updated_at || row.updated_at);
    if (
      candidateUpdatedAt &&
      (!indexUpdatedAt || candidateUpdatedAt > indexUpdatedAt)
    )
      staleIds.push(candidateId);
  }
  const uniqueStaleIds = [...new Set(staleIds)].sort();
  const blockedCandidateIds = [...indexedIds]
    .filter(
      (candidateId) =>
        candidateIds.has(candidateId) && !eligibleCandidateIds.has(candidateId),
    )
    .sort();
  const orphanCandidateIds = [...indexedIds]
    .filter((candidateId) => !candidateIds.has(candidateId))
    .sort();
  const blockedCandidateIdSet = new Set(blockedCandidateIds);
  const orphanCandidateIdSet = new Set(orphanCandidateIds);
  const blockedCandidateIndexRows = indexRows.filter((row) =>
    blockedCandidateIdSet.has(idOf(row.candidate_id || row.id)),
  ).length;
  const orphanIndexRows = indexRows.filter((row) =>
    orphanCandidateIdSet.has(idOf(row.candidate_id || row.id)),
  ).length;
  const malformedIndexRows = indexRows.filter(
    (row) => !idOf(row.candidate_id || row.id),
  ).length;
  const exactSetAligned =
    missing.length === 0 &&
    duplicateIds.length === 0 &&
    uniqueStaleIds.length === 0 &&
    blockedCandidateIds.length === 0 &&
    orphanCandidateIds.length === 0 &&
    malformedIndexRows === 0;

  const recommendationParts: string[] = [];
  if (missing.length)
    recommendationParts.push(
      "Rebuild candidate_search_index for missing canonically indexable candidates before relying on index-only search coverage.",
    );
  if (blockedCandidateIds.length)
    recommendationParts.push(
      "Remove lifecycle- or quality-blocked candidates from candidate_search_index.",
    );
  if (orphanCandidateIds.length)
    recommendationParts.push(
      "Remove orphan candidate_search_index rows with no source candidate.",
    );
  if (malformedIndexRows)
    recommendationParts.push(
      "Remove malformed candidate_search_index rows without a candidate id.",
    );
  if (duplicateIds.length)
    recommendationParts.push(
      "Deduplicate candidate_search_index rows by candidate_id.",
    );
  if (uniqueStaleIds.length)
    recommendationParts.push(
      "Refresh stale candidate_search_index rows whose source candidates changed after indexing.",
    );
  if (!recommendationParts.length)
    recommendationParts.push(
      "Search index is an exact, current set of canonically indexable candidate ids.",
    );

  return {
    candidatesCount: candidateIds.size,
    eligibleCandidates: eligibleCandidateIds.size,
    blockedCandidates: candidateIds.size - eligibleCandidateIds.size,
    searchIndexRows: indexRows.length,
    uniqueIndexedCandidates: indexedIds.size,
    missingIndexRows: missing.length,
    staleIndexRows: uniqueStaleIds.length,
    duplicateIndexRows: duplicateIds.length,
    blockedCandidateIndexRows,
    orphanIndexRows,
    malformedIndexRows,
    unexpectedIndexedCandidates:
      blockedCandidateIds.length + orphanCandidateIds.length,
    exactSetAligned,
    staleIndexRowIds: uniqueStaleIds,
    duplicateIndexCandidateIds: duplicateIds,
    sampleMissingCandidateIds: missing.slice(0, sampleSize),
    sampleStaleCandidateIds: uniqueStaleIds.slice(0, sampleSize),
    sampleDuplicateCandidateIds: duplicateIds.slice(0, sampleSize),
    sampleBlockedCandidateIds: blockedCandidateIds.slice(0, sampleSize),
    sampleOrphanCandidateIds: orphanCandidateIds.slice(0, sampleSize),
    recommendation: recommendationParts.join(" "),
  };
}
