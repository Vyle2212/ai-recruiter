export const CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES = [
  "deleted",
  "non_sap",
  "rejected_noise",
  "hidden",
  "archived",
] as const;

export const CANDIDATE_SEARCH_REVIEW_STATUSES = ["needs_review"] as const;

export const CANDIDATE_SEARCH_BLOCKED_STATUSES = [
  ...CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES,
  ...CANDIDATE_SEARCH_REVIEW_STATUSES,
] as const;

const permanentlyBlocked = new Set<string>(
  CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES,
);
const reviewOnly = new Set<string>(CANDIDATE_SEARCH_REVIEW_STATUSES);

export function normalizedCandidateLifecycleStatus(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function candidateSearchLifecycleDecision(
  candidate: { status?: unknown } | null | undefined,
  options: { includeReview?: boolean } = {},
) {
  const status = normalizedCandidateLifecycleStatus(candidate?.status);
  if (permanentlyBlocked.has(status)) {
    return {
      visible: false,
      status,
      reason: "archived_or_inactive" as const,
    };
  }
  if (!options.includeReview && reviewOnly.has(status)) {
    return {
      visible: false,
      status,
      reason: "review_required" as const,
    };
  }
  return { visible: true, status, reason: null };
}
