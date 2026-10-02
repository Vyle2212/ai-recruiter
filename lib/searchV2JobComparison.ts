/** Preserve ranking while keeping a selected baseline in view. */
export function selectJobComparisonResults<T extends { candidateId: string }>(
  ranked: readonly T[],
  shortlistedIds: ReadonlySet<string>,
  anchorCandidateId = "",
): T[] {
  const scoped = ranked.filter((candidate) =>
    shortlistedIds.has(candidate.candidateId),
  );
  const anchor = ranked.find(
    (candidate) => candidate.candidateId === anchorCandidateId,
  );
  return anchor && !shortlistedIds.has(anchor.candidateId)
    ? [anchor, ...scoped]
    : scoped;
}
