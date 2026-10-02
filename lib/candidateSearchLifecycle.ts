export const CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES = [
  "deleted",
  "non_sap",
  "rejected_noise",
  "hidden",
  "archived",
] as const;

export const CANDIDATE_SEARCH_REVIEW_STATUSES = ["needs_review"] as const;

export const CANDIDATE_SEARCH_REVIEW_EXTRACTION_STATUSES = [
  "incomplete_needs_review",
] as const;

export const CANDIDATE_SEARCH_REVIEW_CONFIRMATION_STATUSES = [
  "not_claimed",
  "claimed_incomplete",
  "recruiter_review_required",
] as const;

export const CANDIDATE_SEARCH_BLOCKED_STATUSES = [
  ...CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES,
  ...CANDIDATE_SEARCH_REVIEW_STATUSES,
] as const;

const permanentlyBlocked = new Set<string>(
  CANDIDATE_SEARCH_PERMANENTLY_BLOCKED_STATUSES,
);
const reviewOnly = new Set<string>(CANDIDATE_SEARCH_REVIEW_STATUSES);
const reviewExtraction = new Set<string>(
  CANDIDATE_SEARCH_REVIEW_EXTRACTION_STATUSES,
);
const reviewConfirmation = new Set<string>(
  CANDIDATE_SEARCH_REVIEW_CONFIRMATION_STATUSES,
);

/** Only a known missing optional lifecycle column permits a legacy retry. */
export function missingOptionalLifecycleColumn(
  error: {
    code?: string;
    message?: string;
  } | null,
) {
  if (error?.code !== "42703") return null;
  return (
    /\b(extraction_coverage_status|profile_confirmation_status)\b/i
      .exec(error.message || "")?.[1]
      ?.toLowerCase() || null
  );
}

/** Retry only absent migration-owned lifecycle fields; preserve all other errors. */
export async function selectCandidateLifecycleCompatible<T>(
  columns: string,
  run: (columns: string) => PromiseLike<{
    data: T | null;
    error: { code?: string; message?: string } | null;
  }>,
) {
  let selection = columns;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await run(selection);
    const missing = missingOptionalLifecycleColumn(result.error);
    if (!missing || !new RegExp(`\\b${missing}\\b`, "i").test(selection))
      return result;
    selection = selection
      .replace(new RegExp(`\\b${missing}\\s*,?\\s*`, "gi"), "")
      .replace(/,\s*,/g, ",")
      .replace(/,\s*([)])/g, "$1")
      .replace(/,\s*$/, "");
  }
  throw new Error("Candidate lifecycle compatibility retry exhausted.");
}

export function normalizedCandidateLifecycleStatus(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function candidateSearchLifecycleDecision(
  candidate:
    | {
        status?: unknown;
        extraction_coverage_status?: unknown;
        profile_confirmation_status?: unknown;
      }
    | null
    | undefined,
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
  if (
    !options.includeReview &&
    (reviewExtraction.has(
      normalizedCandidateLifecycleStatus(candidate?.extraction_coverage_status),
    ) ||
      reviewConfirmation.has(
        normalizedCandidateLifecycleStatus(
          candidate?.profile_confirmation_status,
        ),
      ))
  ) {
    return {
      visible: false,
      status,
      reason: "review_required" as const,
    };
  }
  return { visible: true, status, reason: null };
}
