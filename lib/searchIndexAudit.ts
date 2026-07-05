type AnyRecord = Record<string, any>;

export type SearchIndexAuditInput = {
  candidates: AnyRecord[];
  indexRows: AnyRecord[];
  sampleSize?: number;
};

export type SearchIndexAuditSummary = {
  candidatesCount: number;
  searchIndexRows: number;
  missingIndexRows: number;
  staleIndexRows: number;
  duplicateIndexRows: number;
  staleIndexRowIds: string[];
  duplicateIndexCandidateIds: string[];
  sampleMissingCandidateIds: string[];
  sampleStaleCandidateIds: string[];
  sampleDuplicateCandidateIds: string[];
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

export function buildSearchIndexAudit(input: SearchIndexAuditInput): SearchIndexAuditSummary {
  const sampleSize = input.sampleSize ?? 20;
  const candidates = input.candidates || [];
  const indexRows = input.indexRows || [];
  const candidateIds = new Set(candidates.map((row) => idOf(row.id || row.candidate_id)).filter(Boolean));
  const candidateById = new Map(candidates.map((row) => [idOf(row.id || row.candidate_id), row]).filter(([id]) => Boolean(id)) as [string, AnyRecord][]);
  const indexCounts = new Map<string, number>();
  const indexedIds = new Set<string>();

  for (const row of indexRows) {
    const candidateId = idOf(row.candidate_id || row.id);
    if (!candidateId) continue;
    indexedIds.add(candidateId);
    indexCounts.set(candidateId, (indexCounts.get(candidateId) || 0) + 1);
  }

  const missing = [...candidateIds].filter((candidateId) => !indexedIds.has(candidateId)).sort();
  const duplicateIds = [...indexCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([candidateId]) => candidateId)
    .sort();

  const staleIds: string[] = [];
  for (const row of indexRows) {
    const candidateId = idOf(row.candidate_id || row.id);
    if (!candidateId || !candidateById.has(candidateId)) continue;
    const candidate = candidateById.get(candidateId) || {};
    const candidateUpdatedAt = timeOf(candidate.updated_at || candidate.source_updated_at);
    const indexUpdatedAt = timeOf(row.source_updated_at || row.updated_at);
    if (candidateUpdatedAt && indexUpdatedAt && candidateUpdatedAt > indexUpdatedAt) staleIds.push(candidateId);
  }
  const uniqueStaleIds = [...new Set(staleIds)].sort();

  const recommendationParts: string[] = [];
  if (missing.length) recommendationParts.push("Rebuild candidate_search_index for missing candidates before relying on index-only search coverage.");
  if (duplicateIds.length) recommendationParts.push("Deduplicate candidate_search_index rows by candidate_id.");
  if (uniqueStaleIds.length) recommendationParts.push("Refresh stale candidate_search_index rows whose source candidates changed after indexing.");
  if (!recommendationParts.length) recommendationParts.push("Search index coverage is aligned with candidates table ids.");

  return {
    candidatesCount: candidateIds.size,
    searchIndexRows: indexRows.length,
    missingIndexRows: missing.length,
    staleIndexRows: uniqueStaleIds.length,
    duplicateIndexRows: duplicateIds.length,
    staleIndexRowIds: uniqueStaleIds,
    duplicateIndexCandidateIds: duplicateIds,
    sampleMissingCandidateIds: missing.slice(0, sampleSize),
    sampleStaleCandidateIds: uniqueStaleIds.slice(0, sampleSize),
    sampleDuplicateCandidateIds: duplicateIds.slice(0, sampleSize),
    recommendation: recommendationParts.join(" "),
  };
}
