import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CANDIDATE_SEARCH_BLOCKED_STATUSES,
  CANDIDATE_SEARCH_REVIEW_CONFIRMATION_STATUSES,
  CANDIDATE_SEARCH_REVIEW_EXTRACTION_STATUSES,
  candidateSearchLifecycleDecision,
} from "../lib/candidateSearchLifecycle";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";
import { candidateSearchMutationEligibility } from "../lib/candidateSearchMutationGate";

const blocked = [
  "deleted",
  "non_sap",
  "rejected_noise",
  "hidden",
  "archived",
  "needs_review",
];
for (const status of blocked) {
  assert.equal(
    candidateSearchLifecycleDecision({ status }).visible,
    false,
    `${status} must not enter normal search`,
  );
}
for (const status of ["", "active", null, undefined]) {
  assert.equal(
    candidateSearchLifecycleDecision({ status }).visible,
    true,
    `${String(status)} remains compatible with current active records`,
  );
}
assert.equal(
  candidateSearchLifecycleDecision(
    { status: "needs_review" },
    { includeReview: true },
  ).visible,
  true,
  "explicit recruiter review mode may inspect review records",
);
for (const status of ["deleted", "non_sap", "rejected_noise"]) {
  assert.equal(
    candidateSearchLifecycleDecision({ status }, { includeReview: true })
      .visible,
    false,
    `${status} must stay out of review-mode search`,
  );
}
assert.deepEqual([...CANDIDATE_SEARCH_BLOCKED_STATUSES].sort(), blocked.sort());
for (const extraction_coverage_status of CANDIDATE_SEARCH_REVIEW_EXTRACTION_STATUSES) {
  assert.equal(
    candidateSearchLifecycleDecision({
      status: "active",
      extraction_coverage_status,
    }).visible,
    false,
    `${extraction_coverage_status} must stay out even if status is stale active`,
  );
}
for (const profile_confirmation_status of CANDIDATE_SEARCH_REVIEW_CONFIRMATION_STATUSES) {
  assert.equal(
    candidateSearchLifecycleDecision({
      status: "active",
      profile_confirmation_status,
    }).visible,
    false,
    `${profile_confirmation_status} must stay out even if status is stale active`,
  );
}
assert.equal(
  candidateSearchLifecycleDecision({
    status: "active",
    extraction_coverage_status: "complete_for_validation",
    profile_confirmation_status: "candidate_confirmed",
  }).visible,
  true,
);

const mutationEligibility = candidateSearchMutationEligibility(
  [
    {
      id: "eligible",
      status: "active",
      extraction_coverage_status: "complete_for_validation",
      profile_confirmation_status: "candidate_confirmed",
    },
    { id: "ocr-review", status: "needs_review" },
  ],
  ["eligible", "ocr-review", "missing"],
);
assert.deepEqual(mutationEligibility.requestedIds, [
  "eligible",
  "ocr-review",
  "missing",
]);
assert.deepEqual([...mutationEligibility.eligibleIds], ["eligible"]);
assert.equal(mutationEligibility.allEligible, false);

const reconciliation = buildSearchIndexAudit({
  candidates: [
    {
      id: "eligible-current",
      status: "active",
      updated_at: "2026-09-25T00:00:00.000Z",
    },
    {
      id: "eligible-missing",
      status: "active",
      updated_at: "2026-09-25T00:00:00.000Z",
    },
    {
      id: "blocked-review",
      status: "needs_review",
      updated_at: "2026-09-25T00:00:00.000Z",
    },
  ],
  indexRows: [
    {
      candidate_id: "eligible-current",
      source_updated_at: "2026-09-24T00:00:00.000Z",
    },
    { candidate_id: "blocked-review" },
    { candidate_id: "orphan-index-row" },
    { candidate_id: "" },
  ],
  sampleSize: 10,
});
assert.equal(reconciliation.eligibleCandidates, 2);
assert.equal(reconciliation.blockedCandidates, 1);
assert.equal(reconciliation.missingIndexRows, 1);
assert.equal(reconciliation.staleIndexRows, 1);
assert.equal(reconciliation.blockedCandidateIndexRows, 1);
assert.equal(reconciliation.orphanIndexRows, 1);
assert.equal(reconciliation.malformedIndexRows, 1);
assert.equal(reconciliation.unexpectedIndexedCandidates, 2);
assert.equal(reconciliation.exactSetAligned, false);
assert.deepEqual(reconciliation.sampleMissingCandidateIds, [
  "eligible-missing",
]);
assert.deepEqual(reconciliation.sampleBlockedCandidateIds, ["blocked-review"]);
assert.deepEqual(reconciliation.sampleOrphanCandidateIds, ["orphan-index-row"]);

const aligned = buildSearchIndexAudit({
  candidates: [
    {
      id: "eligible-current",
      status: "active",
      updated_at: "2026-09-25T00:00:00.000Z",
    },
    { id: "blocked-review", status: "needs_review" },
  ],
  indexRows: [
    {
      candidate_id: "eligible-current",
      source_updated_at: "2026-09-25T00:00:00.000Z",
    },
  ],
});
assert.equal(aligned.exactSetAligned, true);

const read = (path: string) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");
const searchV2 = read("../app/api/recruiter/search-v2/route.ts");
const lifecycleAdapter = read("../lib/searchV2CandidateLifecycle.ts");
const searchIndexReadback = read("../lib/search/rebuildSearchIndex.ts");
const searchVisibility = read("../lib/candidateSearchVisibility.ts");
const legacySearch = read("../app/api/search-candidates/route.ts");
const generateMatches = read("../app/api/generate-matches/route.ts");
const matches = read("../app/api/matches/route.ts");
const legacyMatchCandidates = read("../app/api/match-candidates/route.ts");
const jobMatches = read("../app/api/matches/[jobId]/route.ts");
const vectorSearch = read("../app/api/vector-search/route.ts");
const candidateList = read("../app/api/candidates/route.ts");
const legacyCandidateList = read("../app/api/get-candidates/route.ts");
const persistedMatches = read("../app/api/get-matches/route.ts");
const directMatchWrite = read("../app/api/ai-match/route.ts");
const shortlistWrite = read("../app/api/shortlisted/route.ts");
const shortlistCandidateWrite = read(
  "../app/api/shortlist-candidates/route.ts",
);
const shortlistCollection = read("../app/api/shortlists/route.ts");
const legacyMatchJob = read("../app/api/match-job/route.ts");
const ownedUpdate = read(
  "../supabase/manual/202609240014_candidate_owned_cv_update.sql",
);

assert.match(searchV2, /applyCurrentCandidateSearchLifecycle\(/);
assert.ok(
  searchV2.indexOf("applyCurrentCandidateSearchLifecycle(") <
    searchV2.indexOf("searchCacheKey(profile)"),
  "current lifecycle state must contribute to the revision before ranked-cache lookup",
);
assert.match(
  searchV2,
  /datasetRevision = `\$\{datasetRevision\}:lifecycle-\$\{lifecycle\.visibilityRevision\}`/,
);
assert.match(lifecycleAdapter, /\.from\("candidates"\)/);
assert.match(lifecycleAdapter, /extraction_coverage_status/);
assert.match(lifecycleAdapter, /profile_confirmation_status/);
assert.match(lifecycleAdapter, /\.or\(/);
assert.match(lifecycleAdapter, /CANDIDATE_SEARCH_BLOCKED_STATUSES/);
assert.match(lifecycleAdapter, /documents\.filter\(/);
assert.match(lifecycleAdapter, /setCurrentBlockedCandidatesResolverForTests/);
assert.match(lifecycleAdapter, /process\.env\.NODE_ENV !== "test"/);
assert.match(searchIndexReadback, /\.select\("\*"\)/);
assert.match(searchIndexReadback, /buildCandidateSearchIndexRow\(candidate\)/);
assert.match(searchIndexReadback, /indexableCandidateIds/);
assert.match(searchIndexReadback, /buildSearchIndexAudit\(\{/);
assert.match(searchIndexReadback, /reconciliation\.exactSetAligned/);
assert.match(searchIndexReadback, /readyForSearch/);
assert.match(searchVisibility, /candidateSearchLifecycleDecision\(candidate\)/);
assert.match(legacySearch, /candidateSearchLifecycleDecision\(candidate/);
assert.match(generateMatches, /candidateSearchLifecycleDecision\(candidate\)/);
assert.match(matches, /candidateSearchLifecycleDecision\(candidate\)/);
for (const [surface, source] of [
  ["legacy candidate match", legacyMatchCandidates],
  ["job candidate match", jobMatches],
  ["vector search", vectorSearch],
  ["candidate list", candidateList],
  ["legacy candidate list", legacyCandidateList],
  ["persisted match list", persistedMatches],
  ["direct match write", directMatchWrite],
  ["shortlist write", shortlistWrite],
  ["shortlist candidate write", shortlistCandidateWrite],
  ["shortlist collection", shortlistCollection],
  ["legacy match RPC", legacyMatchJob],
] as const) {
  assert.match(
    source,
    /candidateSearchLifecycleDecision\(|loadCandidateSearchMutationEligibility\(/,
    `${surface} must enforce current candidate lifecycle state`,
  );
}
assert.match(vectorSearch, /id,\s*status,/);
assert.match(directMatchWrite, /extraction_coverage_status/);
assert.match(directMatchWrite, /profile_confirmation_status/);
assert.match(shortlistWrite, /extraction_coverage_status/);
assert.match(shortlistWrite, /profile_confirmation_status/);
for (const source of [
  shortlistCandidateWrite,
  shortlistCollection,
  legacyMatchJob,
]) {
  assert.match(source, /loadCandidateSearchMutationEligibility/);
  assert.match(source, /allEligible|eligibleIds/);
}
for (const source of [
  legacyMatchCandidates,
  generateMatches,
  matches,
  jobMatches,
  vectorSearch,
  directMatchWrite,
  shortlistCandidateWrite,
  shortlistCollection,
  legacyMatchJob,
]) {
  assert.match(source, /requireRecruiterSearchAuthorization/);
  assert.match(source, /recruiterSearchAuthorizationDenied/);
}
assert.match(
  ownedUpdate,
  /delete from public\.candidate_search_index where candidate_id = p_candidate_id/,
);

console.log("candidateSearchLifecycleConsistency.test.ts passed");
