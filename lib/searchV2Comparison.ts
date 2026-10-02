export type SearchV2ComparisonScope = "matches" | "shortlisted";

export function searchV2ComparisonCandidates<
  Candidate extends { candidateId: string },
>(
  candidates: readonly Candidate[],
  shortlistedIds: ReadonlySet<string>,
  scope: SearchV2ComparisonScope,
  anchorCandidateId = "",
) {
  const scoped =
    scope === "shortlisted"
      ? candidates.filter((candidate) =>
          shortlistedIds.has(candidate.candidateId),
        )
      : [...candidates];
  const anchor = candidates.find(
    (candidate) => candidate.candidateId === anchorCandidateId,
  );
  if (!anchor) return scoped;
  return [
    anchor,
    ...scoped.filter(
      (candidate) => candidate.candidateId !== anchorCandidateId,
    ),
  ];
}
