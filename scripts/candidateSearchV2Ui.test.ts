import assert from "node:assert/strict";
import fs from "node:fs";
import { isTalentSearchBadDisplayName } from "../lib/talentSearchDisplay";

const pagePath = "app/recruiter/talent-search/v2/page.tsx";
const clientPath = "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx";

assert.ok(fs.existsSync(pagePath), "Candidate Search V2 page must exist.");
assert.ok(fs.existsSync(clientPath), "Candidate Search V2 client component must exist.");

const page = fs.readFileSync(pagePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");

assert.match(page, /CandidateSearchV2Client/);
assert.match(client, /"use client"/);
assert.match(client, /\/api\/recruiter\/search-v2/);
assert.match(client, /Describe who/);
assert.match(client, /Match quality/);
assert.match(client, /Advanced filters/);
assert.match(client, /parseRecruiterSearchIntent/);
assert.match(client, /recruiterQueryStatements/);
assert.match(client, /Expanded:/);
assert.match(client, /Confidence/);
assert.match(client, /recruiterMatchTier/);
assert.match(client, /recruiterCriticalGap/);
assert.match(client, /Strong Match/);
assert.match(client, /Good Match/);
assert.match(client, /Potential Match/);
assert.match(client, /Name unavailable/);
assert.match(client, /isTalentSearchBadDisplayName/);
assert.match(client, /candidateShortId/);
assert.match(client, /Shortlist/);
assert.match(client, /Open Profile/);
assert.match(client, /Previous page/);
assert.match(client, /Next page/);
assert.match(client, /candidate360SearchHref/);
assert.match(client, /shouldClearAdvancedFiltersForQueryChange/);
assert.match(client, /advancedFilterIntentKey/);
assert.match(client, /handleQueryChange/);
assert.match(client, /pageCacheRef/);
assert.match(client, /resultsSectionRef/);
assert.match(client, /scrollIntoView\(\{ behavior: "auto", block: "start" \}\)/);
assert.match(client, /aria-busy/);
assert.match(client, /Still searching\.\.\./);
assert.match(client, /pendingSearchKeyRef/);
assert.match(client, /runSearch\(response\.summary\.page \+ 1, true\)/);
assert.match(client, /paginationNavigation/);

for (const removed of ["Candidate Search V2", "Minimum score", "Open Candidate 360", "Why this candidate", "Recruiter rank", "AI score", "Employer pending verification", "Generate Interview Guide"]) {
  assert.doesNotMatch(client, new RegExp(removed, "i"));
}

assert.doesNotMatch(client, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(/);
for (const invalidName of ["Period End Closing Process.", "Responsible And Accountable.", "Monitoring Compliance", "Priorities To Keep Sla Agreement.", "CURRICULUM VITAE SAP Consultant"]) {
  assert.equal(isTalentSearchBadDisplayName(invalidName), true, `${invalidName} must be rejected as a display name`);
}
console.log("candidateSearchV2Ui.test.ts passed");
