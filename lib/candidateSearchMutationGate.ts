import { candidateSearchLifecycleDecision } from "./candidateSearchLifecycle";

type CandidateLifecycleRow = {
  id?: unknown;
  status?: string | null;
  extraction_coverage_status?: string | null;
  profile_confirmation_status?: string | null;
};

const normalizedIds = (values: unknown[]) => [
  ...new Set(
    values.map((value) => String(value || "").trim()).filter(Boolean),
  ),
];

export function candidateSearchMutationEligibility(
  rows: CandidateLifecycleRow[],
  candidateIds: unknown[],
) {
  const requestedIds = normalizedIds(candidateIds);
  const requested = new Set(requestedIds);
  const eligibleIds = new Set(
    rows
      .filter((row) => requested.has(String(row.id || "").trim()))
      .filter((row) => candidateSearchLifecycleDecision(row).visible)
      .map((row) => String(row.id || "").trim()),
  );
  return {
    requestedIds,
    eligibleIds,
    allEligible: eligibleIds.size === requestedIds.length,
  } as const;
}

export async function loadCandidateSearchMutationEligibility(
  client: any,
  candidateIds: unknown[],
) {
  const requestedIds = normalizedIds(candidateIds);
  if (!requestedIds.length)
    return candidateSearchMutationEligibility([], requestedIds);
  const { data, error } = await client
    .from("candidates")
    .select(
      "id,status,extraction_coverage_status,profile_confirmation_status",
    )
    .in("id", requestedIds);
  if (error)
    throw new Error(error.message || "Unable to verify candidate eligibility.");
  return candidateSearchMutationEligibility(data || [], requestedIds);
}
