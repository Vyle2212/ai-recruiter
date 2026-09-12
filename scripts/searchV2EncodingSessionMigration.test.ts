import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSearchV2SessionSnapshot } from "../lib/searchV2SessionMigration";

const SEARCH_KEY = "candidate360.searchContext.v1";
class MemoryStorage {
  values = new Map<string, string>();
  removed: string[] = [];
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.removed.push(key); this.values.delete(key); }
}

function response() {
  return {
    generatedAt: "2026-08-23T00:00:00.000Z",
    request: { query: "SAP OTC consultant in Singapore", mode: "hybrid", page: 1, pageSize: 20, minimumScore: 50 },
    summary: { totalDocuments: 830, totalMatched: 63, eligibleTotal: 107, visibleTotal: 63, verifiedVisible: 45, supportedVisible: 4, relatedVisible: 14, appliedMinimumScore: 50, appliedMatchQuality: "relevant", returned: 0, page: 1, pageSize: 20 },
    results: [],
  };
}

const malformedStorage = new MemoryStorage();
malformedStorage.setItem(SEARCH_KEY, JSON.stringify({ response: { summary: { totalMatched: 63 }, results: [] } }));
malformedStorage.setItem("auth.session", "untouched");
malformedStorage.setItem("recruiter.preferences", "untouched");
assert.equal(loadSearchV2SessionSnapshot(malformedStorage, SEARCH_KEY).status, "evicted");
assert.deepEqual(malformedStorage.removed, [SEARCH_KEY]);
assert.equal(malformedStorage.getItem("auth.session"), "untouched");
assert.equal(malformedStorage.getItem("recruiter.preferences"), "untouched");
assert.equal(loadSearchV2SessionSnapshot(malformedStorage, SEARCH_KEY).status, "missing", "reload after eviction must not restore or re-evict poison");

const legacyStorage = new MemoryStorage();
const legacyResponse = response();
delete (legacyResponse.summary as Record<string, unknown>).visibleTotal;
legacyStorage.setItem(SEARCH_KEY, JSON.stringify({ query: "SAP OTC consultant in Singapore", response: legacyResponse }));
const legacyLoad = loadSearchV2SessionSnapshot(legacyStorage, SEARCH_KEY);
assert.equal(legacyLoad.status, "restored");
if (legacyLoad.status === "restored") assert.equal(legacyLoad.response?.summary.visibleTotal, 63);
assert.deepEqual(legacyStorage.removed, []);

const v19Storage = new MemoryStorage();
v19Storage.setItem(SEARCH_KEY, JSON.stringify({ response: response() }));
const v19Load = loadSearchV2SessionSnapshot(v19Storage, SEARCH_KEY);
assert.equal(v19Load.status, "restored");
if (v19Load.status === "restored") assert.equal(v19Load.response?.summary.eligibleTotal, 107);

const visibleSources = [
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "app/recruiter/talent-search/v2/GuidedSourcingPanel.tsx",
  "lib/recruiterSearchPresentation.ts",
  "lib/searchPagination.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
for (const marker of [String.fromCodePoint(0x00c3), String.fromCodePoint(0x00c2), String.fromCodePoint(0xfffd), String.fromCodePoint(0x00e2) + String.fromCodePoint(0x20ac)]) assert.equal(visibleSources.includes(marker), false, `client-visible sources must not contain code points ${[...marker].map((value) => value.codePointAt(0)?.toString(16)).join("-")}`);
assert.match(visibleSources, /\{"\\u00D7"\}/, "chip close icon must use an encoding-stable escape");
assert.match(visibleSources, /\{"\\u00B7"\}/, "pagination separator must use an encoding-stable escape");
assert.match(visibleSources, /Showing \{response\.summary\.returned\}[\s\S]*Page \{response\.summary\.page\}/);
assert.match(visibleSources, /loadSearchV2SessionSnapshot\(window\.sessionStorage, CANDIDATE360_SEARCH_CONTEXT_KEY\)/);
const restoreEffect = visibleSources.slice(visibleSources.indexOf("const loadedSnapshot"), visibleSources.indexOf("useEffect(() => {", visibleSources.indexOf("const loadedSnapshot") + 1));
assert.doesNotMatch(restoreEffect, /setError/, "startup eviction must not create a persistent response error banner");
assert.match(visibleSources, /normalizeSearchV2Response\(payload\)/, "network responses remain strictly validated");
assert.match(visibleSources, /Your previous results were kept/, "invalid network/cache responses retain the sanitized recoverable error");

console.log("Search V2 encoding and session migration tests passed");