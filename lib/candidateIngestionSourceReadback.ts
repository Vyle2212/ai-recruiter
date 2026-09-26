export type CandidateSourceReadback = {
  current: (reference: string) => Promise<{ id: string } | null>;
  completedCandidateIds: (reference: string) => Promise<string[]>;
  candidateById: (id: string) => Promise<{ id: string } | null>;
};

/** A later CV can replace candidates.source_file while the earlier original
 * remains a completed job. Keep both sources of evidence consistent, and
 * never treat a deleted candidate as permission to recreate it implicitly.
 */
export async function findCandidateForIngestedSource(
  reference: string,
  readback: CandidateSourceReadback,
): Promise<{ id: string } | null> {
  const current = await readback.current(reference);
  const history = await readback.completedCandidateIds(reference);
  const distinct = [...new Set(history)];
  if (
    distinct.length > 1 ||
    (current && distinct.length && current.id !== distinct[0])
  )
    throw new Error("INGESTION_SOURCE_OWNERSHIP_CONFLICT");
  if (current) return current;
  if (!distinct.length) return null;
  const historicalCandidate = await readback.candidateById(distinct[0]);
  if (!historicalCandidate || historicalCandidate.id !== distinct[0])
    throw new Error("INGESTION_SOURCE_CANDIDATE_MISSING");
  return historicalCandidate;
}
