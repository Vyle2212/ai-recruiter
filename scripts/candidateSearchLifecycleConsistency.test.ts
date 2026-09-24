import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CANDIDATE_SEARCH_BLOCKED_STATUSES,
  candidateSearchLifecycleDecision,
} from "../lib/candidateSearchLifecycle";

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

const read = (path: string) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");
const searchV2 = read("../app/api/recruiter/search-v2/route.ts");
const lifecycleAdapter = read("../lib/searchV2CandidateLifecycle.ts");
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
assert.match(lifecycleAdapter, /\.select\("id,status"\)/);
assert.match(lifecycleAdapter, /CANDIDATE_SEARCH_BLOCKED_STATUSES/);
assert.match(lifecycleAdapter, /documents\.filter\(/);
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
] as const) {
  assert.match(
    source,
    /candidateSearchLifecycleDecision\(/,
    `${surface} must enforce current candidate lifecycle state`,
  );
}
assert.match(vectorSearch, /id,\s*status,/);
assert.match(directMatchWrite, /\.select\("id,status"\)/);
assert.match(shortlistWrite, /\.select\("id,name,email,raw_text,status"\)/);
assert.match(
  ownedUpdate,
  /delete from public\.candidate_search_index where candidate_id = p_candidate_id/,
);

console.log("candidateSearchLifecycleConsistency.test.ts passed");
