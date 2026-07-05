import fs from "node:fs";
import assert from "node:assert/strict";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";
import { buildTalentSearchPaginationMeta } from "../lib/talentSearchPagination";
import { classifyTalentSearchQuery, talentSearchIdentityRank } from "../lib/talentSearchDisplay";

const candidates = [
  { id: "lee", updated_at: "2026-01-02T00:00:00.000Z" },
  { id: "dainiel", updated_at: "2026-01-02T00:00:00.000Z" },
  { id: "kaarthi", updated_at: "2026-01-02T00:00:00.000Z" },
  { id: "missing", updated_at: "2026-01-02T00:00:00.000Z" },
];
const indexRows = [
  { candidate_id: "lee", source_updated_at: "2026-01-02T00:00:00.000Z" },
  { candidate_id: "dainiel", source_updated_at: "2026-01-02T00:00:00.000Z" },
  { candidate_id: "kaarthi", source_updated_at: "2026-01-02T00:00:00.000Z" },
];
const coverage = buildSearchIndexAudit({ candidates, indexRows, sampleSize: 5 });
assert.equal(coverage.candidatesCount, candidates.length, "candidate_search_index coverage audit should compare against candidates table count");
assert.equal(coverage.searchIndexRows, indexRows.length, "candidate_search_index coverage audit should count index rows");
assert.equal(coverage.missingIndexRows, 1, "candidate_search_index coverage audit should detect missing rows");
assert.equal(coverage.sampleMissingCandidateIds.includes("missing"), true, "coverage audit should sample missing ids");

const pagination = buildTalentSearchPaginationMeta({
  totalCandidates: candidates.length,
  totalMatched: 3,
  returnedCount: 2,
  pageSize: 2,
  page: 1,
});
const apiShape = {
  items: [{ id: "lee" }, { id: "dainiel" }],
  totalCandidates: pagination.totalCandidates,
  totalMatched: pagination.totalMatched,
  returnedCount: pagination.returnedCount,
  page: pagination.page,
  pageSize: pagination.pageSize,
  totalPages: pagination.totalPages,
  hasMore: pagination.hasMore,
  debug: {
    totalCandidates: pagination.totalCandidates,
    searchIndexRows: coverage.searchIndexRows,
    sourceRows: coverage.searchIndexRows,
    visibleRows: pagination.totalMatched,
    hiddenRows: coverage.searchIndexRows - pagination.totalMatched,
    missingFromSearchIndex: coverage.missingIndexRows,
    staleIndexRows: coverage.staleIndexRows,
    duplicateIndexRows: coverage.duplicateIndexRows,
  },
};
assert.notEqual(apiShape.totalCandidates, null, "totalCandidates should not be null");
assert.equal(apiShape.totalCandidates, candidates.length, "totalCandidates should equal candidates table count in mocked API metadata");
assert.equal(apiShape.returnedCount, apiShape.items.length, "returnedCount should equal items.length");
assert.equal(apiShape.totalPages, Math.ceil(apiShape.totalMatched / apiShape.pageSize), "totalPages should equal Math.ceil(totalMatched / pageSize)");
assert.equal(apiShape.debug.sourceRows, apiShape.debug.searchIndexRows, "sourceRows should equal candidate_search_index count when index is source");
assert.equal(typeof apiShape.debug.missingFromSearchIndex, "number", "debug should include missingFromSearchIndex");

const lee = { id: "lee", displayName: "Lee Wah Ken", name: "Other Name", currentCompany: "Accenture", title: "SAP MM Consultant", search_text: "someone else mentioned Dainiel Paulo P. Dizon" };
const leeRawOnly = { id: "lee-raw", displayName: "Other Person", name: "Other Person", currentCompany: "Lee Wah Ken Consulting", title: "SAP Consultant", search_text: "Lee Wah Ken" };
const dainiel = { id: "dainiel", displayName: "Dainiel Paulo P. Dizon", name: "Dainiel Paulo P. Dizon", currentCompany: "DXC", title: "SAP PS Consultant", search_text: "SAP PS" };
const dainielRawOnly = { id: "dainiel-raw", displayName: "Other Person", name: "Other Person", title: "SAP Consultant", search_text: "Dainiel Paulo P. Dizon" };
const kaarthi = { id: "kaarthi", displayName: "Kaarthi Duraisamy Chandrasakar", name: "Kaarthi Duraisamy Chandrasakar", title: "SAP FICO Consultant", search_text: "SAP FICO" };

function rankFirst(query: string, rows: any[]) {
  return [...rows]
    .map((candidate) => ({ candidate, rank: talentSearchIdentityRank(candidate, query) }))
    .sort((a, b) => b.rank - a.rank)[0].candidate.id;
}

assert.equal(rankFirst("Lee Wah Ken", [leeRawOnly, lee]), "lee", "Lee Wah Ken should rank first for exact displayName match");
assert.equal(rankFirst("Dainiel Paulo P. Dizon", [dainielRawOnly, dainiel]), "dainiel", "Dainiel exact displayName should outrank raw text matches");
assert.equal(rankFirst("Kaarthi Duraisamy Chandrasakar", [leeRawOnly, kaarthi]), "kaarthi", "Kaarthi exact visible name should rank first");
assert.equal(talentSearchIdentityRank(lee, "Lee Wah Ken") > talentSearchIdentityRank(leeRawOnly, "Lee Wah Ken"), true, "exact displayName should outrank employer/title/search_text matches");
assert.equal(classifyTalentSearchQuery("Candidate profile pending validation"), "placeholder", "placeholder query should be classified as placeholder");
assert.equal(talentSearchIdentityRank({ displayName: "Candidate profile pending validation", search_text: "SAP FICO" }, "Candidate profile pending validation") < 0, true, "placeholder query should not return default recruiter results");

const routeSource = fs.readFileSync(new URL("../app/api/search-candidates/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("totalCandidates: pagination.totalCandidates"), true, "Search API should return top-level totalCandidates");
assert.equal(routeSource.includes("searchIndexRows"), true, "Search API debug should include searchIndexRows");
assert.equal(routeSource.includes("missingFromSearchIndex"), true, "Search API debug should include missingFromSearchIndex");
assert.equal(routeSource.includes("sourceRows: sourceRows.length"), true, "Search API debug should include sourceRows");
assert.equal(routeSource.includes("visibleRows: visibleRows.length"), true, "Search API debug should include visibleRows");

const searchPageSource = fs.readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
assert.equal(searchPageSource.includes("sortCandidatesForRecruiter"), false, "Talent Search UI must not client-side resort API results");
assert.equal(searchPageSource.includes("const nextCandidates = rawCandidates;"), true, "Talent Search UI should preserve API item order exactly");
assert.equal(searchPageSource.includes("summaryVisibility.canSeeInternalMetrics"), true, "internal diagnostics should remain role-gated and hidden from recruiter UI");

console.log("Search quality gate tests passed");