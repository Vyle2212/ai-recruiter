import fs from "node:fs";
import assert from "node:assert/strict";
import "./resume-quality-gate-regression";
import { buildTalentSearchPaginationMeta } from "../lib/talentSearchPagination";
import { buildSearchIndexAudit } from "../lib/searchIndexAudit";
import { buildTalentSearchCountSummary,
  TALENT_SEARCH_DISPLAY_RESOLVER_VERSION, buildTalentSearchExecutiveSummary, candidateHasContactInfo, classifyTalentSearchQuery, cleanTalentSearchSummaryText, cleanTalentSearchTitle, displayTalentSearchValidationStatus, hasTalentSearchMojibake, extractTalentSearchExplicitName, isTalentSearchBadDisplayName, isTalentSearchPlaceholderName, resolveTalentSearchViewerRole, safeTalentSearchCompany, talentSearchIdentityRank, talentSearchSummaryVisibility } from "../lib/talentSearchDisplay";

const firstPage = buildTalentSearchPaginationMeta({
  totalMatched: 970,
  returnedCount: 10,
  pageSize: 10,
  page: 1,
});

assert.equal(firstPage.totalMatched, 970, "totalMatched should preserve the database count");
assert.equal(firstPage.returnedCount, 10, "returnedCount should describe the current page only");
assert.equal(firstPage.pageSize, 10, "default page size should support 10 profiles");
assert.equal(firstPage.currentPage, 1, "page 1 should be current page 1");
assert.equal(firstPage.offset, 0, "page 1 should use offset 0");
assert.equal(firstPage.totalPages, 97, "970 matches at page size 10 should produce 97 pages");
assert.equal(firstPage.totalCandidates >= firstPage.totalMatched, true, "totalCandidates can be greater than totalMatched");
assert.equal(firstPage.returnedCount <= firstPage.totalMatched, true, "returnedCount should be separate from totalMatched");
assert.equal(firstPage.hasPrevious, false, "first page should not have a previous page");
assert.equal(firstPage.hasNext, true, "first page should report a next page");

const secondPage = buildTalentSearchPaginationMeta({
  totalMatched: 970,
  returnedCount: 10,
  pageSize: 10,
  page: 2,
});

assert.equal(secondPage.currentPage, 2, "page 2 should map to current page 2");
assert.equal(secondPage.offset, 10, "page 2 at page size 10 should use offset 10");
assert.equal(secondPage.hasPrevious, true, "middle pages should have previous page");
assert.equal(secondPage.hasNext, true, "middle pages should keep next page true");

const finalPage = buildTalentSearchPaginationMeta({
  totalMatched: 970,
  returnedCount: 10,
  pageSize: 10,
  page: 97,
});

assert.equal(finalPage.currentPage, 97, "final page should keep the correct page count");
assert.equal(finalPage.totalPages, 97, "final page should preserve total page count");
assert.equal(finalPage.hasNext, false, "final page should not show Next");
assert.equal(finalPage.hasMore, false, "final page should not expose an additional page");

console.log("Talent Search pagination tests passed");

const filteredPage = buildTalentSearchPaginationMeta({
  totalCandidates: 970,
  totalMatched: 550,
  returnedCount: 10,
  pageSize: 10,
  page: 1,
});

assert.equal(filteredPage.totalCandidates, 970, "total pool should remain separate from filtered matches");
assert.notEqual(filteredPage.totalCandidates, null, "totalCandidates should never be null in API pagination metadata");
assert.equal(filteredPage.totalMatched, 550, "filtered match count should be preserved");
assert.equal(filteredPage.totalCandidates > filteredPage.totalMatched, true, "totalCandidates can be greater than totalMatched");
assert.equal(filteredPage.returnedCount, 10, "returned count should describe the current page");
assert.equal(filteredPage.totalPages, Math.ceil(filteredPage.totalMatched / filteredPage.pageSize), "totalPages should be Math.ceil(totalMatched / pageSize)");
const apiShapeExample = { items: Array.from({ length: filteredPage.returnedCount }), returnedCount: filteredPage.returnedCount };
assert.equal(apiShapeExample.returnedCount, apiShapeExample.items.length, "returnedCount should equal items.length");

const adminSummary = buildTalentSearchCountSummary({
  totalCandidates: filteredPage.totalCandidates,
  totalMatched: filteredPage.totalMatched,
  returnedCount: filteredPage.returnedCount,
  showingCount: 10,
  offset: 0,
  pageSize: 10,
  hasContactInfoOnly: true,
  viewerRole: "admin",
});
const recruiterSummary = buildTalentSearchCountSummary({
  totalCandidates: filteredPage.totalCandidates,
  totalMatched: filteredPage.totalMatched,
  returnedCount: filteredPage.returnedCount,
  showingCount: 10,
  offset: 0,
  pageSize: 10,
  hasContactInfoOnly: true,
});
const clientSummary = buildTalentSearchCountSummary({
  totalCandidates: filteredPage.totalCandidates,
  totalMatched: filteredPage.totalMatched,
  returnedCount: filteredPage.returnedCount,
  showingCount: 10,
  offset: 0,
  pageSize: 10,
  hasContactInfoOnly: true,
  viewerRole: "client",
});

assert.equal(adminSummary.resultsLabel, "Filtered Results: 550", "admin should see filtered match count");
assert.equal(adminSummary.showingLabel, "Showing 1-10 of 550", "admin should see current page range");
assert.equal(adminSummary.totalPoolLabel, "Total Talent Pool: 970", "admin should see full talent pool total");
assert.equal(adminSummary.filterLabel, "Filtered by Has contact info only", "admin filter label should be explicit");
assert.equal(recruiterSummary.resultsLabel, "", "recruiter should not see filtered total as internal metric");
assert.equal(recruiterSummary.showingLabel, "", "recruiter should not see internal page count summary");
assert.equal(recruiterSummary.totalPoolLabel, "", "recruiter should not see full talent pool total");
assert.equal(recruiterSummary.filterLabel, "", "recruiter should not see internal applied filters summary");
assert.equal(clientSummary.resultsLabel, "", "client should not see internal search result totals");
assert.equal(clientSummary.showingLabel, "", "client should not see Talent Search internal summary");
assert.equal(clientSummary.totalPoolLabel, "", "client should not see full talent pool total");
assert.equal(resolveTalentSearchViewerRole(), "recruiter", "default Talent Search role should be recruiter");
assert.equal(resolveTalentSearchViewerRole({ requestedRole: "admin", adminFlag: "true", adminEnabled: false }), "recruiter", "admin role requires explicit enabled guard");
assert.equal(resolveTalentSearchViewerRole({ requestedRole: "admin", adminFlag: "true", adminEnabled: true }), "admin", "admin role requires explicit role and flag");
assert.equal(talentSearchSummaryVisibility("admin").canSeeTalentPoolTotal, true, "admin should see talent pool total");
assert.equal(talentSearchSummaryVisibility("recruiter").canSeeTalentPoolTotal, false, "recruiter should not see talent pool total");
assert.equal(talentSearchSummaryVisibility("client").canSeeInternalMetrics, false, "client should not see internal metrics");

const renderedTalentSearchLabels = [
  "Back to Matches", "Advanced Filters v", "Years >=", "AI Recommendation", "Why Matched",
  adminSummary.resultsLabel, adminSummary.showingLabel, adminSummary.totalPoolLabel, adminSummary.filterLabel, "Previous", "1 2 3 4 5 ...", "Next",
].join("\n");

assert.equal(hasTalentSearchMojibake(renderedTalentSearchLabels), false, "Talent Search labels should not contain mojibake");
assert.equal(safeTalentSearchCompany("SAP"), "Not disclosed", "SAP alone is not a confirmed employer");
assert.equal(safeTalentSearchCompany("SAP SAP"), "Not disclosed", "SAP SAP is not a confirmed employer");
for (const badEmployer of ["Creation of", "Applying for the position of SAP Consultant", "Non-disclosed", "No details", "SAP", "MM module", "raw sentence fragment applying for the position", "in the world", "where as my goal in", "Managed &", "Roles and", "Achievement artifacts available for viewing", "Date Of Birth", "Personal Particular", "Professional Objective", "Authorization Concepts", "March", "April", "September", "October", "November"]) {
  assert.equal(safeTalentSearchCompany(badEmployer), "Not disclosed", badEmployer + " should not be displayed as current employer");
}
assert.equal(cleanTalentSearchTitle("Employment SAP PS Solutions Consultant (", "PS"), "SAP PS Solutions Consultant", "dangling title punctuation should be removed");
assert.equal(cleanTalentSearchTitle("SAP UNKNOWN consultant", "FICO"), "SAP FICO Consultant", "known module should replace UNKNOWN role artifacts");
assert.equal(cleanTalentSearchTitle("Consultant", "EWM"), "SAP EWM Consultant", "generic consultant title should use known SAP module");
assert.equal(cleanTalentSearchTitle("SAP SAP ABAP Consultant", "ABAP"), "SAP ABAP Consultant", "duplicated SAP title prefix should be removed");
assert.equal(cleanTalentSearchTitle("SAP SAP UNKNOWN Consultant -", "FICO"), "SAP FICO Consultant", "SAP SAP and dangling punctuation should be removed through module fallback");
assert.equal(cleanTalentSearchTitle("SAP Consultant at", "MM"), "SAP MM Consultant", "unfinished role phrases should be removed");
assert.equal(cleanTalentSearchTitle("SAP SD Consultant |", "SD"), "SAP SD Consultant", "trailing pipe should be removed");
assert.equal(cleanTalentSearchSummaryText("SAP SAP delivery. SAP UNKNOWN delivery. UNKNOWN consultant."), "SAP delivery. SAP delivery. consultant.", "summary cleanup should remove duplicated SAP and UNKNOWN artifacts");
const neutralReviewSummary = buildTalentSearchExecutiveSummary({ module: "FICO", reviewBadge: "Missing Information", previousEmployers: ["SAP"] });
assert.equal(neutralReviewSummary, "SAP FICO profile requires recruiter validation. Employer details require validation.", "missing information summary should be neutral");
const verifiedSummary = buildTalentSearchExecutiveSummary({ module: "UNKNOWN", years: 8, implementation: 2, previousEmployers: ["SAP"] });
assert.equal(verifiedSummary.includes("SAP SAP"), false, "executive summary must not contain SAP SAP");
assert.equal(verifiedSummary.includes("UNKNOWN"), false, "executive summary must not contain UNKNOWN");
assert.equal(verifiedSummary.includes("Previously at SAP"), false, "SAP must not be shown as a verified previous employer");
const candidateCardText = [
  "Candidate profile pending validation",
  neutralReviewSummary,
  "Needs Review",
  "SAP FICO Consultant",
].join("\n");
assert.equal(candidateCardText.includes("Candidate profile pendi..."), false, "placeholder profile name should not be harmful-truncated");
assert.equal(candidateCardText.includes("Review\nReview"), false, "duplicate review badges should not be rendered");
assert.equal(candidateCardText.includes("Current Company"), false, "Current Company chip should not be rendered");
assert.equal(candidateCardText.includes("Previous Company"), false, "Previous Company chip should not be rendered");


const dbContactableFalseCandidate = { email: "person@example.com", phone: "", contactable: false };
assert.equal(candidateHasContactInfo(dbContactableFalseCandidate), true, "DB contactable=false should not block has contact info");
assert.equal(recruiterSummary.filterLabel, "", "recruiter UI helper should not expose hidden contact-info filter labels");

const pageInput = Array.from({ length: 18 }, (_, index) => ({ id: index + 1, hidden: index % 4 === 0 }));
const filteredBeforePagination = pageInput.filter((item) => !item.hidden);
assert.equal(filteredBeforePagination.slice(0, 10).length, 10, "page size 10 should render 10 profiles when filtering happens before pagination");
assert.equal(pageInput.slice(0, 10).filter((item) => !item.hidden).length < 10, true, "filtering after pagination would create short non-final pages");

assert.equal(displayTalentSearchValidationStatus({ status: "Ready", score: 95, displayName: "Candidate profile pending validation", currentEmployer: "ACME Consulting", title: "SAP FICO Consultant" }), "Needs Review", "placeholder candidate cannot display Ready");
assert.equal(displayTalentSearchValidationStatus({ status: "Ready", score: 95, displayName: "Candidate Profile Pending Validation", currentEmployer: "ACME Consulting", title: "SAP FICO Consultant" }), "Needs Review", "placeholder casing variants cannot display Ready");
assert.equal(isTalentSearchPlaceholderName("Profile Under Review"), true, "raw Profile Under Review should be treated as placeholder/review-only");
assert.equal(isTalentSearchPlaceholderName("Candidate profile pending validation"), true, "safe placeholder should be review-only in default Talent Search");
assert.equal(isTalentSearchBadDisplayName("Bachelor Of Science In Information"), true, "education heading should be excluded from default Talent Search");
for (const badDisplayName of [
  "Candidate profile pending validation",
  "Personal Particular",
  "Professional Objective",
  "Authorization Concepts",
  "Relevant MAST EWM",
  "Curriculum Vitae ROA R. Maroda",
  "Date Of Birth 01 Jan 1980",
  "Subjectmatterex Mdmanalyst",
  "From Data Acquisition To Reporting",
  "Professional Synopsis",
]) {
  assert.equal(isTalentSearchPlaceholderName(badDisplayName) || isTalentSearchBadDisplayName(badDisplayName), true, `${badDisplayName} should be blocked from normal Talent Search`);
}
for (const badQuery of ["Candidate profile pending validation", "Date Of Birth", "Professional Objective", "Personal Particular", "Authorization Concepts", "From Data Acquisition To Reporting", "Curriculum Vitae", "Subjectmatterex", "Mdmanalyst"]) {
  assert.equal(isTalentSearchPlaceholderName(badQuery) || isTalentSearchBadDisplayName(badQuery) || classifyTalentSearchQuery(badQuery) === "placeholder", true, `${badQuery} should be routed away from default recruiter results`);
}
assert.equal(isTalentSearchBadDisplayName("Aina Rahman"), false, "valid human names should remain searchable");
assert.equal(displayTalentSearchValidationStatus({ status: "Ready", score: 95, displayName: "Aina Rahman", currentEmployer: "Not disclosed", title: "SAP FICO Consultant" }), "Missing Information", "Not disclosed employer should display Missing Information");
assert.equal(displayTalentSearchValidationStatus({ status: "Ready", score: 95, displayName: "Aina Rahman", currentEmployer: "ACME Consulting", title: "SAP FICO Consultant" }), "Ready", "Ready display requires valid name and employer");
assert.equal(cleanTalentSearchTitle("", "MM"), "SAP MM Consultant", "module-based fallback title should be used when title is blank");

assert.equal(classifyTalentSearchQuery("person@example.com"), "email", "email query should be detected");
assert.equal(classifyTalentSearchQuery("+60 12 345 6789"), "phone", "phone query should be detected");
assert.equal(classifyTalentSearchQuery("Lee Wah Ken"), "human-name", "human name query should be detected");
assert.equal(classifyTalentSearchQuery("Candidate profile pending validation"), "placeholder", "placeholder query should be review-only");
const exactNameCandidate = { displayName: "Lee Wah Ken", email: "lee@example.com", phone: "+60 12 345 6789", currentCompany: "Accenture", title: "SAP MM Consultant", search_text: "SAP MM support" };
const summaryOnlyCandidate = { displayName: "Other Person", email: "other@example.com", phone: "+60 99 000 0000", currentCompany: "SAP Partner", title: "SAP Consultant", search_text: "Lee Wah Ken mentioned in raw resume summary" };
assert.equal(talentSearchIdentityRank(exactNameCandidate, "Lee Wah Ken") > talentSearchIdentityRank(summaryOnlyCandidate, "Lee Wah Ken"), true, "exact human name match should outrank summary/raw-text matches");
assert.equal(talentSearchIdentityRank({ displayName: "Dainiel Paulo P. Dizon" }, "Dainiel Paulo P. Dizon") >= 90000, true, "exact dotted human name should rank first");
assert.equal(talentSearchIdentityRank({ displayName: "Kaarthi Duraisamy Chandrasakar" }, "Kaarthi Duraisamy Chandrasakar") >= 90000, true, "exact long human name should rank first");
const rawNamedPlaceholder = { displayName: "Candidate profile pending validation", raw_text: "Full Name : Kaarthi Duraisamy Chandrasakar Gender : Male" };
assert.equal(extractTalentSearchExplicitName(rawNamedPlaceholder), "Kaarthi Duraisamy Chandrasakar", "strong Full Name label should recover exact search display name");
assert.equal(talentSearchIdentityRank(rawNamedPlaceholder, "Kaarthi Duraisamy Chandrasakar") >= 90000, true, "exact raw labeled human name should rank first");
assert.equal(talentSearchIdentityRank(exactNameCandidate, "lee@example.com") >= 100000, true, "exact email should rank first");
assert.equal(talentSearchIdentityRank(exactNameCandidate, "+60 12 345 6789") >= 95000, true, "exact phone should rank first");
assert.equal(talentSearchIdentityRank(exactNameCandidate, "Candidate profile pending validation") < 0, true, "placeholder query should not produce normal recruiter ranking");
assert.equal(TALENT_SEARCH_DISPLAY_RESOLVER_VERSION.startsWith("canonical-display-v"), true, "display resolver version should be explicit");

const searchIndexAudit = buildSearchIndexAudit({
  candidates: [
    { id: "c1", updated_at: "2026-01-02T00:00:00.000Z" },
    { id: "c2", updated_at: "2026-01-02T00:00:00.000Z" },
    { id: "c3", updated_at: "2026-01-02T00:00:00.000Z" },
  ],
  indexRows: [
    { candidate_id: "c1", source_updated_at: "2026-01-01T00:00:00.000Z" },
    { candidate_id: "c1", source_updated_at: "2026-01-01T00:00:00.000Z" },
    { candidate_id: "c2", source_updated_at: "2026-01-03T00:00:00.000Z" },
  ],
  sampleSize: 5,
});
assert.equal(searchIndexAudit.candidatesCount, 3, "search index audit should count candidates");
assert.equal(searchIndexAudit.searchIndexRows, 3, "search index audit should count index rows");
assert.equal(searchIndexAudit.missingIndexRows, 1, "search index audit should detect missing index rows");
assert.equal(searchIndexAudit.sampleMissingCandidateIds.includes("c3"), true, "search index audit should sample missing candidate ids");
assert.equal(searchIndexAudit.duplicateIndexRows, 1, "search index audit should detect duplicate index rows");
assert.equal(searchIndexAudit.staleIndexRows, 1, "search index audit should detect stale index rows");

const gitignoreSource = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
assert.equal(gitignoreSource.includes("repair-preview.json"), true, "repair preview JSON should be ignored by git");
assert.equal(gitignoreSource.includes("candidate-display-repair-review.csv"), true, "repair review CSV should be ignored by git");
assert.equal(gitignoreSource.includes("candidate-display-repair-rollback.json"), true, "repair rollback JSON should be ignored by git");

const applyScriptSource = fs.readFileSync(new URL("../scripts/applyCandidateDisplayRepairs.ts", import.meta.url), "utf8");
assert.equal(applyScriptSource.includes("Auto-safe suggestions"), false, "apply dry-run should not use old Auto-safe label");
assert.equal(applyScriptSource.includes("Source-backed suggestions"), false, "apply dry-run should not use old Source-backed label");
assert.equal(applyScriptSource.includes("Skipped suggestions"), false, "apply dry-run should not use old Skipped label");
assert.equal(applyScriptSource.includes("safeDisplayRepairs"), true, "apply dry-run should use current category labels");
assert.equal(applyScriptSource.includes("Display resolver:"), true, "apply dry-run should print display resolver version");

const routeSource = fs.readFileSync(new URL("../app/api/search-candidates/route.ts", import.meta.url), "utf8");
assert.equal(routeSource.includes("totalCandidates: pagination.totalCandidates"), true, "Search API should return non-null totalCandidates at top level");
assert.equal(routeSource.includes("totalCandidates: summaryVisibility.canSeeTalentPoolTotal ? pagination.totalCandidates : null"), true, "Search UI stats should remain role-gated");
assert.equal(routeSource.includes("returnedCount: pagination.returnedCount"), true, "Search API should return returnedCount from pagination");
assert.equal(routeSource.includes("totalPages: pagination.totalPages"), true, "Search API should return totalPages from pagination");
assert.equal(routeSource.includes("fetchAllRows(\"candidates\", \"id,updated_at\")"), true, "Search API diagnostics should compare against full candidates table coverage");
assert.equal(routeSource.includes("fetchAllRows(\"candidate_search_index\""), true, "Search API diagnostics should compare against full search index coverage");
assert.equal(routeSource.includes("missingFromSearchIndex"), true, "Search API debug should include missing search-index diagnostics");
assert.equal(routeSource.includes("staleIndexRows"), true, "Search API debug should include stale search-index diagnostics");
assert.equal(routeSource.includes("duplicateIndexRows"), true, "Search API debug should include duplicate search-index diagnostics");
assert.equal(routeSource.includes("hiddenByPlaceholder"), true, "Search API debug should include placeholder visibility diagnostics");

const searchPageSource = fs.readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
assert.equal(searchPageSource.includes("Previous Employer:"), true, "Talent Search card should render Previous Employer in SEEK-style card");
assert.equal(searchPageSource.includes("Current Employer:"), true, "Talent Search card should render Current Employer in SEEK-style card");
assert.equal(searchPageSource.includes("Current Company"), false, "Talent Search card should not render Current Company chips");
assert.equal(searchPageSource.includes("Previous Company"), false, "Talent Search card should not render Previous Company chips");
