import assert from "node:assert/strict";
import fs from "node:fs";
import { selectJobComparisonResults } from "../lib/searchV2JobComparison";

const ranked = Array.from({ length: 45 }, (_, rank) => ({
  candidateId: `candidate-${rank + 1}`,
  rank: rank + 1,
}));
const savedForThisJob = new Set([
  "candidate-3",
  "candidate-28",
  "candidate-43",
]);

assert.deepEqual(
  selectJobComparisonResults(ranked, savedForThisJob, "candidate-2").map(
    ({ rank }) => rank,
  ),
  [2, 3, 28, 43],
  "a saved candidate beyond page one remains in the same ranked job result",
);
assert.deepEqual(
  selectJobComparisonResults(ranked, savedForThisJob, "candidate-28").map(
    ({ rank }) => rank,
  ),
  [3, 28, 43],
  "a shortlisted baseline is not duplicated",
);
assert.deepEqual(
  selectJobComparisonResults(ranked, new Set(), "unknown"),
  [],
  "an unknown baseline cannot add a profile outside the search",
);

const routeSource = fs.readFileSync(
  "app/api/recruiter/search-v2/route.ts",
  "utf8",
);
assert.match(
  routeSource,
  /\.eq\("owner_profile_id", ownerProfileId\)/,
  "job comparison must remain bound to the authenticated recruiter profile",
);
assert.match(
  routeSource,
  /organizationId[\s\S]{0,160}\.eq\("organization_id", organizationId\)[\s\S]{0,160}\.is\("organization_id", null\)/,
  "job comparison must remain bound to the authenticated organization scope",
);
assert.match(
  routeSource,
  /\.eq\("scope_key", `job:\$\{comparison\.jobId\.toLowerCase\(\)\}`\)/,
  "job comparison must not read a shortlist outside the selected job scope",
);
assert.match(
  routeSource,
  /\.range\(offset, offset \+ 499\)/,
  "job comparison reads must remain paginated",
);
assert.match(
  routeSource,
  /if \(offset === 10000\)[\s\S]{0,120}throw new Error\("Shortlist exceeds comparison limit\."\)/,
  "job comparison must fail closed rather than silently truncate an oversized shortlist",
);
console.log("Search V2 job comparison tests passed.");
