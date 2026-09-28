import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// Run only against the separately configured acceptance project. The release
// endpoint prevents a convenient Preview URL or the real production project
// from being mistaken for an authenticated acceptance measurement.
const baseUrl = process.env.SEARCH_V2_ACCEPTANCE_URL?.replace(/\/$/, "");
const expectedSha = process.env.SEARCH_V2_ACCEPTANCE_SHA;
const cookie = process.env.SEARCH_V2_ACCEPTANCE_COOKIE;
assert(
  baseUrl && /^https:\/\//.test(baseUrl),
  "Set HTTPS SEARCH_V2_ACCEPTANCE_URL",
);
assert(
  /^[a-f0-9]{40}$/.test(expectedSha || ""),
  "Set exact SEARCH_V2_ACCEPTANCE_SHA",
);
assert(cookie, "Set SEARCH_V2_ACCEPTANCE_COOKIE for a test recruiter account");

const releaseResponse = await fetch(`${baseUrl}/api/acceptance/release`, {
  headers: { cookie },
  cache: "no-store",
});
assert.equal(
  releaseResponse.status,
  200,
  "Acceptance release endpoint unavailable",
);
const release = await releaseResponse.json();
assert.equal(release.classification, "acceptance");
assert.equal(release.commitSha, expectedSha, "Deployment is not exact PR HEAD");

const request = {
  query: "SAP FICO Consultant Malaysia implementation",
  mode: "hybrid",
  talentPool: "internal_profiles",
  matchQuality: "relevant",
  page: 1,
  pageSize: 20,
  filters: {},
  criteria: [],
};
const timings = [];
for (let iteration = 0; iteration < 6; iteration += 1) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/recruiter/search-v2`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `Search request ${iteration + 1} failed`);
  assert.equal(payload.source?.datasetRevision !== undefined, true);
  timings.push({
    iteration: iteration + 1,
    wallMs: Math.round(performance.now() - startedAt),
    serverTiming: response.headers.get("server-timing"),
    phases: payload.source?.timing,
    cacheHit: payload.source?.cacheHit,
    returned: payload.summary?.returned,
  });
}
const warm = timings
  .slice(1)
  .map((item) => item.wallMs)
  .sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      commitSha: expectedSha,
      classification: release.classification,
      firstMs: timings[0].wallMs,
      warmMedianMs: warm[Math.floor(warm.length / 2)],
      warmMaxMs: warm.at(-1),
      timings,
    },
    null,
    2,
  ),
);
