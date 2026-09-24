import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildSearchIndexExactSetRepair } from "../lib/searchIndexExactSetRepair";

const commitSha = "a".repeat(40);
const timestamp = "2026-09-25T01:00:00.000Z";
const completeCandidate = {
  id: "synthetic-complete",
  status: "active",
  updated_at: timestamp,
  name: "Synthetic Candidate",
  primary_module: "FICO",
  email: "synthetic@example.invalid",
};
const blockedCandidate = {
  id: "synthetic-review",
  status: "needs_review",
  updated_at: timestamp,
  name: "Review Candidate",
  primary_module: "SD",
  email: "review@example.invalid",
};
const indexRows = [completeCandidate, blockedCandidate].map((candidate) => ({
  candidate_id: candidate.id,
  source_updated_at: candidate.updated_at,
  updated_at: timestamp,
}));

const { request, report } = buildSearchIndexExactSetRepair({
  candidates: [completeCandidate, blockedCandidate],
  indexRows,
  targetCommitSha: commitSha,
});
assert.equal(request.expectedDeleteCount, 1);
assert.deepEqual(request.deleteCandidateIds, [blockedCandidate.id]);
assert.equal(request.expectedRemainingIndexCount, 1);
assert.equal(report.rowsPlannedForDeletion, 1);
assert.equal(report.databaseWrites, 0);
assert.equal(report.privacy.candidateIdentifiersSerialized, 0);
assert.doesNotMatch(
  JSON.stringify(report),
  /synthetic-complete|synthetic-review/,
);

assert.throws(
  () =>
    buildSearchIndexExactSetRepair({
      candidates: [completeCandidate, blockedCandidate],
      indexRows: [indexRows[1]],
      targetCommitSha: commitSha,
    }),
  /not_delete_only/,
);
assert.throws(
  () =>
    buildSearchIndexExactSetRepair({
      candidates: [completeCandidate],
      indexRows: [indexRows[0], indexRows[0]],
      targetCommitSha: commitSha,
    }),
  /index_snapshot_invalid/,
);

const sql = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "supabase/manual/202609250000_candidate_search_index_exact_set_repair.sql",
  ),
  "utf8",
);
for (const boundary of [
  /security invoker/i,
  /set search_path = pg_catalog, public/i,
  /lock table public\.candidates in share mode/i,
  /lock table public\.candidate_search_index in share row exclusive mode/i,
  /candidate snapshot changed/i,
  /index snapshot changed/i,
  /delete from public\.candidate_search_index/i,
  /deletion count mismatch/i,
  /exact readback mismatch/i,
  /revoke all on function public\.apply_candidate_search_index_exact_set_repair\(jsonb\)[\s\S]*from public, anon, authenticated/i,
  /grant execute on function public\.apply_candidate_search_index_exact_set_repair\(jsonb\)[\s\S]*to service_role/i,
])
  assert.match(sql, boundary);
assert.doesNotMatch(sql, /delete from public\.candidates/i);
assert.doesNotMatch(sql, /security definer/i);

const runner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/prepareSearchIndexExactSetRepair.ts",
  ),
  "utf8",
);
assert.match(runner, /status", "--porcelain/);
assert.match(runner, /\.search-index-repair-private\.json/);
assert.match(runner, /mode: 0o600/);
assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(runner, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.doesNotMatch(runner, /console\.log\(JSON\.stringify\(request\)\)/);

console.log("Search-index exact-set repair regression passed.");
