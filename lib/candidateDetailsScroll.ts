export const CANDIDATE_DETAILS_SCROLL_VERSION =
  "candidate-details-scroll-v1-tab-and-person";

export function resetCandidateDetailsScroll(
  container: Pick<HTMLElement, "scrollTop"> | null,
) {
  if (container) container.scrollTop = 0;
}
