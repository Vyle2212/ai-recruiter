import fs from "node:fs";
import assert from "node:assert/strict";
import { classifyCandidateSearchVisibility } from "../lib/candidateSearchVisibility";
import { classifySearchableProfileQuality } from "../lib/searchableProfileQualityGate";
import { talentSearchEmployerDisplay, talentSearchExpectedSalaryDisplay } from "../lib/talentSearchCardDisplay";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";
import { buildTalentSearchPaginationMeta } from "../lib/talentSearchPagination";
import { classifyTalentSearchQuery, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, safeTalentSearchCompany, talentSearchIdentityRank } from "../lib/talentSearchDisplay";

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

const visibilityFixture = [
  { id: "ready", name: "Lee Wah Ken", current_company: "Accenture Malaysia", current_title: "SAP MM Consultant", primary_module: "MM", email: "lee@example.com", years: 12, profile_quality_score: 82 },
  { id: "blocked", name: "Candidate profile pending validation", current_company: "Accenture Malaysia", current_title: "SAP MM Consultant", primary_module: "MM", email: "blocked@example.com", years: 8, profile_quality_score: 82 },
  { id: "missing-module", name: "Aina Rahman", current_company: "Accenture Malaysia", current_title: "SAP Consultant", primary_module: "UNKNOWN", email: "aina@example.com", years: 7, profile_quality_score: 82 },
];
const recruiterVisibleFixture = visibilityFixture.filter((candidate) => !classifyCandidateSearchVisibility(candidate).blocked_from_recruiter_search);
assert.deepEqual(recruiterVisibleFixture.map((candidate) => candidate.id), ["ready"], "API default visibility should exclude Validation Queue candidates");
assert.equal(classifyCandidateSearchVisibility(visibilityFixture[1]).search_visibility, "VALIDATION_QUEUE", "placeholder profiles should be Validation Queue only");


for (const badName of [
  "Candidate profile pending validation",
  "Profile Under Review",
  "From Data Acquisition To Reporting",
  "Date Of Birth 01 Jan 1980",
  "Managed & Delivered Projects",
  "Roles and Responsibilities",
  "Professional Certificate SAP",
  "Bachelor Of Information Technology",
  "Curriculum Vitae ROA R. Maroda",
  "Personal Particular",
  "Professional Objective",
  "Authorization Concepts",
  "Relevant MAST EWM",
  "Subjectmatterex Mdmanalyst",
]) {
  assert.equal(isTalentSearchPlaceholderName(badName) || isTalentSearchBadDisplayName(badName), true, `${badName} should be hidden from default recruiter search`);
}

for (const badEmployer of ["in the world", "where as my goal in", "Managed &", "Roles and", "Achievement artifacts available for viewing", "Date Of Birth", "Personal Particular", "Professional Objective", "Authorization Concepts", "March", "April", "September", "October", "November", "Project Responsibilities", "SAP", "MM module"]) {
  assert.equal(safeTalentSearchCompany(badEmployer), "Not disclosed", `${badEmployer} should not display as current employer`);
}
assert.equal(safeTalentSearchCompany("Accenture Malaysia"), "Accenture Malaysia", "trusted company-like employer should remain displayable");
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
for (const badQuery of ["Candidate profile pending validation", "Date Of Birth", "Professional Objective", "Personal Particular", "Authorization Concepts", "From Data Acquisition To Reporting", "Curriculum Vitae", "Subjectmatterex", "Mdmanalyst"]) {
  assert.equal(isTalentSearchPlaceholderName(badQuery) || isTalentSearchBadDisplayName(badQuery) || classifyTalentSearchQuery(badQuery) === "placeholder", true, `${badQuery} should not produce normal recruiter results`);
}


const marketGateFixture = [
  { id: "market-ready", name: "Lee Wah Ken", current_company: "Accenture Malaysia", current_title: "SAP MM Consultant", primary_module: "MM", email: "lee@example.com", phone: "+60 12 345 6789", location: "Malaysia", profile_quality_score: 85, raw_text: "SAP MM S/4HANA ECC rollout support AMS migration" },
  { id: "placeholder-market", name: "Candidate profile pending validation", current_company: "Accenture Malaysia", current_title: "SAP MM Consultant", primary_module: "MM", email: "hidden@example.com", location: "Malaysia", profile_quality_score: 85, raw_text: "SAP MM S/4HANA" },
  { id: "must-repair-market", name: "Tojo Tomy", current_company: "Not disclosed", current_title: "SAP PP Certified PP consultant having 14+ years of professional SAP experience.", primary_module: "PP", email: "tojo@example.com", location: "Malaysia", profile_quality_score: 85, raw_text: "SAP PP S/4HANA implementation support" },
];
const marketVisibleFixture = marketGateFixture.filter((candidate) => {
  const quality = classifySearchableProfileQuality(candidate);
  return quality.reviewCategory === "search_ready" || quality.reviewCategory === "searchable_but_needs_enrichment";
});
assert.deepEqual(marketVisibleFixture.map((candidate) => candidate.id), ["market-ready"], "default Talent Search should exclude placeholder and must_repair_before_search candidates");
assert.equal(classifySearchableProfileQuality(marketGateFixture[0]).reviewCategory, "search_ready", "valid searchable profiles still appear");
assert.equal(classifySearchableProfileQuality(marketGateFixture[2]).reviewCategory, "must_repair_before_search", "long summary title is must_repair_before_search");

const employerDisplay = talentSearchEmployerDisplay({
  current_company: "Fallback Current",
  experience: [
    { company: "Current Co", start_date: "2022-01-01", end_date: "Present", current: true },
    { company: "Previous Co", start_date: "2018-02-01", end_date: "2021-12-01" },
  ],
});
assert.equal(employerDisplay.currentEmployer.label.includes("Current Co"), true, "search card renders current employer when available");
assert.equal(employerDisplay.currentEmployer.label.includes("Present"), true, "current employer includes date range when available");
assert.equal(employerDisplay.previousEmployer.label.includes("Previous Co"), true, "search card renders previous employer when available");
assert.equal(talentSearchExpectedSalaryDisplay({ expected_salary: "8000+", expected_salary_currency: "MYR" }), "MYR 8,000+ monthly", "expected salary renders only when available and formatted");
assert.equal(talentSearchExpectedSalaryDisplay({}), "", "expected salary hides when unavailable");
const routeSource = fs.readFileSync(new URL("../app/api/search-candidates/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("totalCandidates: pagination.totalCandidates"), true, "Search API should return top-level totalCandidates");
assert.equal(routeSource.includes("searchIndexRows"), true, "Search API debug should include searchIndexRows");
assert.equal(routeSource.includes("missingFromSearchIndex"), true, "Search API debug should include missingFromSearchIndex");
assert.equal(routeSource.includes("sourceRows: sourceRows.length"), true, "Search API debug should include sourceRows");
assert.equal(routeSource.includes("visibleRows: visibleRows.length"), true, "Search API debug should include visibleRows");
assert.equal(routeSource.includes("toSearchListItem"), true, "Search API should sanitize list response items");
assert.equal(routeSource.includes("classifyCandidateSearchVisibility"), true, "Search API should use shared recruiter-search visibility gate");
assert.equal(routeSource.includes("classifySearchableProfileQuality"), true, "Search API should enforce Searchable Profile Quality Gate v2");
assert.equal(routeSource.includes("must_repair_before_search"), true, "Search API should exclude must_repair_before_search by default");
assert.equal(routeSource.includes("includeReview"), true, "Search API should support includeReview admin/debug mode alias");
assert.equal(routeSource.includes("select(CANDIDATE_LIGHT_FIELDS"), true, "Search API list path should use lightweight candidate fields");
assert.equal(routeSource.includes("delete out.raw_text"), true, "Search API list response should remove raw_text");
assert.equal(routeSource.includes("delete out.resume_text"), true, "Search API list response should remove resume_text");
assert.equal(routeSource.includes("delete out.parsed_json"), true, "Search API list response should remove parsed_json");
assert.equal(routeSource.includes("delete out.embedding"), true, "Search API list response should remove embedding");
assert.equal(routeSource.includes("raw_cv"), true, "Search API should explicitly strip raw_cv from list responses");
const visibilityHelperSource = fs.readFileSync(new URL("../lib/candidateSearchVisibility.ts", import.meta.url), "utf8");
assert.equal(visibilityHelperSource.includes("blocked_from_recruiter_search"), true, "Shared visibility helper should classify Validation Queue blocks internally");
const allowedFieldsBlock = routeSource.match(/const SEARCH_LIST_ALLOWED_FIELDS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
assert.equal(allowedFieldsBlock.includes("blocked_from_recruiter_search"), false, "default search list payload should not include blocked_from_recruiter_search");
assert.equal(allowedFieldsBlock.includes("search_visibility"), false, "default search list payload should not include search_visibility");
assert.equal(allowedFieldsBlock.includes("validation_queue_reason"), false, "default search list payload should not include validation_queue_reason");
assert.equal(allowedFieldsBlock.includes("latestCvLabel"), false, "search list payload should not include Latest CV label");
assert.equal(allowedFieldsBlock.includes("currentEmployerDisplay"), true, "search list payload should include current employer display field");
assert.equal(allowedFieldsBlock.includes("previousEmployerDisplay"), true, "search list payload should include previous employer display field");
assert.equal(allowedFieldsBlock.includes("expectedSalaryDisplay"), true, "search list payload should include expected salary display field");
const extractionAuditSource = fs.readFileSync(new URL("../scripts/auditCandidateExtractionQuality.ts", import.meta.url), "utf8");
assert.equal(extractionAuditSource.includes("classifyCandidateSearchVisibility"), true, "Extraction audit should use shared recruiter-search visibility gate");

const searchPageSource = fs.readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
assert.equal(searchPageSource.includes("sortCandidatesForRecruiter"), false, "Talent Search UI must not client-side resort API results");
assert.equal(searchPageSource.includes("const nextCandidates = rawCandidates;"), true, "Talent Search UI should preserve API item order exactly");
assert.equal(searchPageSource.includes("summaryVisibility.canSeeInternalMetrics"), true, "internal diagnostics should remain role-gated and hidden from recruiter UI");
assert.equal(searchPageSource.includes("Latest CV"), false, "search card does not render Latest CV");
assert.equal(searchPageSource.includes("updatedLine"), true, "search card renders Updated month/year");
assert.equal(searchPageSource.includes("Current Employer:"), true, "search card renders current employer");
assert.equal(searchPageSource.includes("Previous Employer:"), true, "search card renders previous employer");
assert.equal(searchPageSource.includes("Expected Salary:"), true, "search card renders expected salary conditionally");

console.log("Search quality gate tests passed");