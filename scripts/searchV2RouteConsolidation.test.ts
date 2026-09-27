import assert from "node:assert/strict";
import fs from "node:fs";

const canonical = "/recruiter/talent-search/v2";
for (const route of [
  "app/search/page.tsx",
  "app/matches/page.tsx",
  "app/matches/[jobId]/page.tsx",
  "app/recruiter/talent-search/page.tsx",
  "app/recruiter/talent-search/results/page.tsx",
  "app/recruiter/candidate360-v2/[candidateId]/page.tsx",
]) {
  const source = fs.readFileSync(route, "utf8");
  assert.match(source, /redirect\(/, `${route} must redirect`);
  assert.ok(
    source.includes(canonical) ||
      (route === "app/recruiter/talent-search/results/page.tsx" &&
        source.includes("searchV2LegacyResultsUrl")),
    `${route} must use Search V2`,
  );
  assert.doesNotMatch(
    source,
    /api\/search-candidates|api\/matches|CandidateCard/i,
  );
}

const nav = fs.readFileSync("app/recruiter/layout.tsx", "utf8");
assert.ok(nav.includes(`["Search","${canonical}"]`));
const client = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
assert.match(client, /\/api\/recruiter\/search-v2/);
assert.doesNotMatch(client, /\/api\/search-candidates/);
assert.match(client, /Back to Dashboard/);

for (const route of [
  "app/recruiter/dashboard/page.tsx",
  "app/recruiter/smart-shortlist/page.tsx",
  "app/recruiter/candidate-compare/page.tsx",
  "app/recruiter/pack-compare/page.tsx",
  "app/recruiter/saved-searches/page.tsx",
]) {
  const source = fs.readFileSync(route, "utf8");
  assert.doesNotMatch(
    source,
    /href="\/recruiter\/talent-search"|href="\/search"/,
  );
}
assert.doesNotMatch(
  fs.readFileSync("app/jobs/[id]/page.tsx", "utf8"),
  /\/matches/,
);
assert.ok(
  fs
    .readFileSync("app/submission/page.tsx", "utf8")
    .includes("/recruiter/submission-generator"),
);
const compare = fs.readFileSync(
  "components/candidate-compare-workspace.tsx",
  "utf8",
);
assert.match(compare, /params\.set\("sapModules", module/);
assert.match(compare, /params\.set\("q", keyword/);
assert.doesNotMatch(compare, /"\/search(?:\?|"|\b)/);
console.log("searchV2RouteConsolidation.test.ts passed");
