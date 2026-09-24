import assert from "node:assert/strict";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";

const candidates = [
  {
    id: "candidate-complete",
    status: "active",
    updated_at: "2026-09-25T00:00:00.000Z",
  },
  {
    id: "candidate-incomplete",
    status: "active",
    updated_at: "2026-09-25T00:00:00.000Z",
  },
  {
    id: "candidate-needs-review",
    status: "needs_review",
    updated_at: "2026-09-25T00:00:00.000Z",
  },
];

const misaligned = buildSearchIndexAudit({
  candidates,
  indexRows: [
    {
      candidate_id: "candidate-incomplete",
      source_updated_at: "2026-09-25T00:00:00.000Z",
    },
    {
      candidate_id: "candidate-needs-review",
      source_updated_at: "2026-09-25T00:00:00.000Z",
    },
  ],
  indexableCandidateIds: ["candidate-complete"],
});

assert.equal(misaligned.eligibleCandidates, 1);
assert.equal(misaligned.blockedCandidates, 2);
assert.equal(misaligned.missingIndexRows, 1);
assert.equal(misaligned.blockedCandidateIndexRows, 2);
assert.equal(misaligned.unexpectedIndexedCandidates, 2);
assert.equal(misaligned.exactSetAligned, false);
assert.match(misaligned.recommendation, /quality-blocked/);

const aligned = buildSearchIndexAudit({
  candidates,
  indexRows: [
    {
      candidate_id: "candidate-complete",
      source_updated_at: "2026-09-25T00:00:00.000Z",
    },
  ],
  indexableCandidateIds: ["candidate-complete"],
});

assert.equal(aligned.missingIndexRows, 0);
assert.equal(aligned.blockedCandidateIndexRows, 0);
assert.equal(aligned.unexpectedIndexedCandidates, 0);
assert.equal(aligned.exactSetAligned, true);

console.log("Search index canonical eligibility audit tests passed.");
