type Candidate = Record<string, any>;
type IndexRow = Record<string, any>;

export function planCanonicalSearchIndexRebuild(input: {
  candidates: Candidate[];
  indexRows: IndexRow[];
  refreshExisting: boolean;
  buildRow: (candidate: Candidate) => IndexRow | null;
}) {
  const indexedIds = new Set(
    input.indexRows
      .map((row) => String(row.candidate_id || "").trim())
      .filter(Boolean),
  );
  const rowsToWrite: IndexRow[] = [];
  let missingCandidates = 0;
  let selectedExisting = 0;
  let buildableMissing = 0;
  let notBuildable = 0;

  for (const candidate of input.candidates) {
    const id = String(candidate.id || "").trim();
    if (!id) continue;
    const existing = indexedIds.has(id);
    if (!existing) missingCandidates++;
    if (existing && !input.refreshExisting) continue;
    if (existing) selectedExisting++;

    // One source of truth: the same eligibility and primary-module rules used
    // by the application. Do not infer an index module from raw skills here.
    const row = input.buildRow(candidate);
    if (!row || String(row.candidate_id) !== id) {
      notBuildable++;
      continue;
    }
    rowsToWrite.push(row);
    if (!existing) buildableMissing++;
  }

  return {
    rowsToWrite,
    missingCandidates,
    selectedExisting,
    buildableMissing,
    notBuildable,
  };
}
