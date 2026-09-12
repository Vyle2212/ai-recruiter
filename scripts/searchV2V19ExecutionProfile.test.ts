import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSearchExecutionProfile,
  buildSearchV2BrowserRequest,
  executionProfileRequest,
  searchV2TierCounts,
  visibleSearchV2Results,
} from "../lib/searchV2ExecutionProfile";
import { SEARCH_V2_VERSION } from "../lib/searchV2Shared";
import {
  searchV2ExecutionProfileHash,
  searchV2DiagnosticHeaders,
} from "../lib/searchV2Server";
import { paginateRankedCandidatesV2 } from "../lib/candidateSearchV2Engine";
import type { CandidateSearchV2Result } from "../lib/candidateSearchV2Types";

const browser = buildSearchV2BrowserRequest({
  query: "SAP OTC Consultant Singapore",
  matchQuality: "relevant",
});
assert.equal(browser.minimumScore, 50);
assert.equal(browser.matchQuality, "relevant");
assert.equal(browser.mode, "hybrid");
assert.equal(browser.pageSize, 20);
const context = {
  datasetRevision: "fixture-r1",
  authorizationScopeHash: "safe-scope",
};
const profile = buildSearchExecutionProfile(browser, context);
assert.equal(profile.minimumScore, 50);
assert.equal(profile.matchQuality, "relevant");
assert.equal(executionProfileRequest(profile).minimumScore, 50);
assert.throws(
  () => buildSearchExecutionProfile({ ...browser, minimumScore: 0 }, context),
  /same execution profile/,
);

const anyProfile = buildSearchExecutionProfile(
  buildSearchV2BrowserRequest({ query: browser.query, matchQuality: "any" }),
  context,
);
const strongProfile = buildSearchExecutionProfile(
  buildSearchV2BrowserRequest({ query: browser.query, matchQuality: "strong" }),
  context,
);
assert.notEqual(
  searchV2ExecutionProfileHash(profile),
  searchV2ExecutionProfileHash(anyProfile),
);
assert.notEqual(
  searchV2ExecutionProfileHash(profile),
  searchV2ExecutionProfileHash(strongProfile),
);
assert.notEqual(
  searchV2ExecutionProfileHash(profile),
  searchV2ExecutionProfileHash({ ...profile, minimumScore: 51 }),
);

const result = (
  id: string,
  score: number,
  tier: CandidateSearchV2Result["targetEvidence"]["tier"],
) =>
  ({
    candidateId: id,
    score: { finalScore: score },
    targetEvidence: { tier },
  }) as CandidateSearchV2Result;
const eligible = [
  result("verified", 90, "exact_verified"),
  result("supported", 70, "exact_supported"),
  result("related-visible", 50, "related"),
  result("related-tail", 49, "related"),
];
const visible = visibleSearchV2Results(eligible, profile);
assert.deepEqual(
  visible.map((item) => item.candidateId),
  ["verified", "supported", "related-visible"],
);
assert.equal(eligible.length, 4);
assert.equal(visible.length, 3);
assert.deepEqual(searchV2TierCounts(visible), {
  exact_verified: 1,
  exact_supported: 1,
  related: 1,
  none: 0,
});
const page = paginateRankedCandidatesV2(visible, 4, {
  ...browser,
  page: 1,
  pageSize: 2,
});
assert.equal(page.summary.totalMatched, 3);
assert.equal(page.summary.returned, 2);

const headers = searchV2DiagnosticHeaders(
  "fixture-r1",
  "miss",
  { total: 1 },
  {
    hash: searchV2ExecutionProfileHash(profile),
    minimumScore: profile.minimumScore,
    matchQuality: profile.matchQuality,
    readiness: "ready",
  },
);
assert.equal(headers["X-Search-Minimum-Score"], "50");
assert.equal(headers["X-Search-Match-Quality"], "relevant");
assert.equal(headers["X-Search-Readiness"], "ready");
assert.equal(headers["X-Search-Version"], SEARCH_V2_VERSION);
assert.equal(headers["X-Search-Dataset-Cache"], "unknown");
assert(!JSON.stringify(headers).includes("safe-scope"));

const ui = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(ui, /buildSearchV2BrowserRequest/);
assert.match(ui, /matchQuality: requestMatchQuality/);
assert.match(ui, /latestRequestIdRef/);
assert.match(ui, /AbortController/);
const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
assert.match(route, /eligibleTotal/);
assert.match(route, /visibleTotal/);
assert.match(route, /buildSearchExecutionProfile/);
assert.match(route, /searchCacheKey\(profile\)/);
assert.match(route, /void prewarmCandidateSearchV2Dataset\(\)/);
assert.match(route, /searchV2ReadinessHttpContract/);
assert.match(route, /X-Search-Prewarm-Duration/);
const instrumentation = readFileSync("instrumentation.ts", "utf8");
const nodeInstrumentation = readFileSync("instrumentation-node.ts", "utf8");
assert.match(instrumentation, /NEXT_RUNTIME === "nodejs"/);
assert.match(instrumentation, /registerSearchV2NodePrewarm/);
assert.doesNotMatch(instrumentation, /searchV2Dataset|node:crypto/);
assert.match(nodeInstrumentation, /waitForSearchV2ProjectionReadiness/);
assert.match(nodeInstrumentation, /await waitForSearchV2ProjectionReadiness/);
const datasetSource = readFileSync("lib/searchV2Dataset.ts", "utf8");
assert.match(
  datasetSource,
  /status: "cold" \| "warming" \| "ready" \| "failed"/,
);
assert.match(datasetSource, /SEARCH_INDEX_WARM_TIMEOUT/);
assert.match(datasetSource, /__candidateSearchV2IndexLifecycleV1/);
console.log("Search V2 v19 execution-profile parity and prewarm tests passed");
