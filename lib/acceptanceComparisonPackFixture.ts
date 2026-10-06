import { createHash } from "node:crypto";
import { acceptanceSyntheticCandidateRecord } from "./acceptanceSyntheticCandidateFixture";

// A separate run-owned dataset leaves the existing one-profile acceptance intact.
export function acceptanceComparisonPackFixture(runId: string) {
  if (!/^ptf1c2-gh-\d+-\d+$/.test(runId))
    throw new Error("acceptance_pack_run_invalid");
  const digest = createHash("sha256").update(runId).digest("hex");
  const query = `Synthetic PTF Pack ${digest.slice(0, 12)}`;
  const candidates = Array.from({ length: 25 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    const idDigest = createHash("sha256")
      .update(`${runId}:comparison:${suffix}`)
      .digest("hex");
    return {
      ...acceptanceSyntheticCandidateRecord(),
      id: `${idDigest.slice(0, 8)}-${idDigest.slice(8, 12)}-4${idDigest.slice(13, 16)}-8${idDigest.slice(17, 20)}-${idDigest.slice(20, 32)}`,
      name: `${query} Tester ${suffix}`,
      email: `ptf-pack-${digest.slice(0, 12)}-${suffix}@acceptance.invalid`,
    };
  });
  return { query, candidates };
}

export function validateAcceptanceComparisonPack(
  runId: string,
  rows: readonly Record<string, unknown>[],
) {
  const expected = acceptanceComparisonPackFixture(runId).candidates;
  if (rows.length !== expected.length)
    throw new Error("acceptance_pack_count_mismatch");
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (byId.size !== rows.length)
    throw new Error("acceptance_pack_duplicate_candidate");
  for (const candidate of expected) {
    const row = byId.get(candidate.id);
    if (
      !row ||
      row.name !== candidate.name ||
      row.email !== candidate.email ||
      row.phone ||
      row.linkedin_url ||
      row.profile_confirmation_status !== "candidate_confirmed"
    )
      throw new Error("acceptance_pack_ownership_mismatch");
  }
}
