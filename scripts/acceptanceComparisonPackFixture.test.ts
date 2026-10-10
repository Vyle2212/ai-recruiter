import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptanceComparisonPackFixture,
  validateAcceptanceComparisonPack,
} from "../lib/acceptanceComparisonPackFixture";
import { searchV2ComparisonCandidates } from "../lib/searchV2Comparison";
import { buildCandidateSearchIndexRow } from "../lib/candidateSearchIndex";
import { candidateSearchV2ProjectionDocument, dedupeCandidateSearchV2Documents } from "../lib/candidateSearchV2Projection";
import { canonicalLookupMatches, detectSearchV2UnifiedIntent } from "../lib/searchV2UnifiedIntent";
import { normalizeSearchV2Query } from "../lib/searchV2QueryNormalization";
import { normalizeActualCandidateSchema } from "../lib/candidate360SchemaNormalize";

const run = "ptf1c2-gh-123456-1";
const pack = acceptanceComparisonPackFixture(run);
assert.equal(pack.candidates.length, 25);
validateAcceptanceComparisonPack(run, pack.candidates);
assert.deepEqual(pack, acceptanceComparisonPackFixture(run));
const next = acceptanceComparisonPackFixture("ptf1c2-gh-123456-2");
const nextIds = new Set(next.candidates.map((row) => row.id));
// Match the route's normalization before intent detection and real index projection.
const intent = detectSearchV2UnifiedIntent(normalizeSearchV2Query(pack.query).normalizedQuery);
assert.equal(intent.type, "candidate_name_lookup");
assert.equal(intent.searchable, true);
const documents = [...pack.candidates, ...next.candidates].map((row) =>
  ({ ...candidateSearchV2ProjectionDocument({ ...buildCandidateSearchIndexRow(row), display_name: normalizeActualCandidateSchema(row).candidateName || null }),
    identitySignals: { sourceDocumentHash: createHash("sha256").update(row.resume_text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()).digest("hex") },
  }),
);
assert.equal(dedupeCandidateSearchV2Documents(documents).documents.length, 50);
assert.deepEqual(
  new Set(canonicalLookupMatches(documents, intent).map(({ document }) => document.candidateId)),
  new Set(pack.candidates.map((row) => row.id)),
);
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
