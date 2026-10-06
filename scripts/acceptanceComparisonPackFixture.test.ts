import assert from "node:assert/strict";
import {
  acceptanceComparisonPackFixture,
  validateAcceptanceComparisonPack,
} from "../lib/acceptanceComparisonPackFixture";
import { searchV2ComparisonCandidates } from "../lib/searchV2Comparison";

const run = "ptf1c2-gh-123456-1";
const pack = acceptanceComparisonPackFixture(run);
assert.equal(pack.candidates.length, 25);
validateAcceptanceComparisonPack(run, pack.candidates);
assert.deepEqual(pack, acceptanceComparisonPackFixture(run));
const next = acceptanceComparisonPackFixture("ptf1c2-gh-123456-2");
const nextIds = new Set(next.candidates.map((row) => row.id));
assert.ok(pack.candidates.every((row) => !nextIds.has(row.id)));
assert.throws(() => acceptanceComparisonPackFixture("production"));
assert.throws(() =>
  validateAcceptanceComparisonPack(run, pack.candidates.slice(1)),
);
assert.throws(() => validateAcceptanceComparisonPack(run, next.candidates));
assert.throws(() =>
  validateAcceptanceComparisonPack(run, [
    ...pack.candidates.slice(1),
    pack.candidates[1],
  ]),
);
assert.throws(() =>
  validateAcceptanceComparisonPack(
    run,
    pack.candidates.map((row, i) =>
      i ? row : { ...row, profile_confirmation_status: "not_claimed" },
    ),
  ),
);
assert.throws(() =>
  validateAcceptanceComparisonPack(
    run,
    pack.candidates.map((row, i) =>
      i ? row : { ...row, email: "real@example.com" },
    ),
  ),
);
const ranked = pack.candidates.map((row) => ({ candidateId: row.id }));
const shortlisted = new Set(ranked.slice(0, 21).map((row) => row.candidateId));
for (const scope of ["matches", "shortlisted"] as const) {
  for (const size of [5, 10, 20]) {
    const result = searchV2ComparisonCandidates(
      ranked,
      shortlisted,
      scope,
      ranked[24].candidateId,
    ).slice(0, size);
    assert.equal(result.length, size);
    assert.equal(new Set(result.map((row) => row.candidateId)).size, size);
    assert.equal(result[0].candidateId, ranked[24].candidateId);
  }
}
console.log("Acceptance comparison pack fixture isolation passed.");
