import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptySearchV2Response, normalizeSearchV2Response } from "../lib/searchV2ResponseContract";

function response(overrides: Record<string, unknown> = {}) {
  const results = Array.from({ length: 20 }, (_, index) => ({ candidateId: `candidate-${index}` }));
  const base = {
    generatedAt: "2026-08-23T00:00:00.000Z",
    request: { query: "SAP OTC consultant in Singapore", mode: "hybrid", page: 1, pageSize: 20, minimumScore: 50 },
    summary: {
      totalDocuments: 500, totalMatched: 63, eligibleTotal: 107, visibleTotal: 63,
      verifiedVisible: 45, supportedVisible: 4, relatedVisible: 14,
      appliedMinimumScore: 50, appliedMatchQuality: "relevant", returned: 20, page: 1, pageSize: 20,
    },
    results,
  };
  return { ...base, ...overrides };
}

const empty = emptySearchV2Response();
assert.equal(empty.summary.visibleTotal, 0);
assert.equal(normalizeSearchV2Response(empty, { allowEmptyInitialization: true }).ok, true);
assert.equal(`${empty.summary.visibleTotal.toLocaleString()} candidates found`, "0 candidates found");

const canonical = normalizeSearchV2Response(response());
assert.equal(canonical.ok, true);
if (canonical.ok) {
  assert.equal(canonical.response.summary.visibleTotal, 63);
  assert.equal(canonical.response.summary.eligibleTotal, 107);
}

const legacyValue = response();
delete (legacyValue.summary as Record<string, unknown>).visibleTotal;
const legacy = normalizeSearchV2Response(legacyValue);
assert.equal(legacy.ok, true);
if (legacy.ok) assert.equal(legacy.response.summary.visibleTotal, 63);

const pageTwo = response({
  request: { query: "SAP OTC consultant in Singapore", mode: "hybrid", page: 2, pageSize: 20, minimumScore: 50 },
  summary: { ...(response().summary as object), page: 2 },
});
const normalizedPageTwo = normalizeSearchV2Response(pageTwo);
assert.equal(normalizedPageTwo.ok, true);
if (normalizedPageTwo.ok) assert.equal(normalizedPageTwo.response.summary.visibleTotal, 63, "pagination must retain the population total, not results.length");

const paginatedWithoutTotal = response();
delete (paginatedWithoutTotal.summary as Record<string, unknown>).visibleTotal;
delete (paginatedWithoutTotal.summary as Record<string, unknown>).totalMatched;
assert.equal(normalizeSearchV2Response(paginatedWithoutTotal).ok, false, "a real paginated response must never use results.length as its total");

for (const invalid of [undefined, null, Number.NaN, "63", -1]) {
  const value = response();
  (value.summary as Record<string, unknown>).visibleTotal = invalid;
  assert.equal(normalizeSearchV2Response(value).ok, false, `invalid visibleTotal ${String(invalid)} must be rejected`);
}

const clientSource = readFileSync("app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx", "utf8");
assert.match(clientSource, /loadSearchV2SessionSnapshot\(window\.sessionStorage, CANDIDATE360_SEARCH_CONTEXT_KEY\)/);
assert.match(clientSource, /normalizeSearchV2Response\(cachedPage\)/);
assert.match(clientSource, /normalizeSearchV2Response\(payload\)/);
assert.match(clientSource, /latestRequestIdRef\.current !== requestId \|\| abortController\.signal\.aborted/);
assert.match(clientSource, /Your previous results were kept/);
assert.doesNotMatch(clientSource, /summary\.visibleTotal\?\./, "presentation must consume the normalized contract, not hide malformed state");

console.log("searchV2ResponseContract tests passed");