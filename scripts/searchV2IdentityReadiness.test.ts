import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePersonIdsForPublicIdentityToken } from "../lib/searchV2PublicIdentity";
import { detectSearchV2UnifiedIntent } from "../lib/searchV2UnifiedIntent";

for (const input of ["#0BD318", "0bd318", "#A8CCB8", "a8ccb8"]) {
  const intent = detectSearchV2UnifiedIntent(input);
  assert.equal(intent.type, "identity_token_lookup");
  assert.equal(intent.lookupValue, `#${input.replace("#", "").toUpperCase()}`);
}

assert.deepEqual(sourcePersonIdsForPublicIdentityToken("#A8CCB8"), [
  "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8",
]);
assert.deepEqual(sourcePersonIdsForPublicIdentityToken("#A8CCC8"), [
  "4b2c8a5c-74e2-46cc-80e6-a14413a8ccc8",
]);
assert.equal(sourcePersonIdsForPublicIdentityToken("#0BD318"), null);

const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
const dataset = readFileSync("lib/searchV2Dataset.ts", "utf8");
const client = readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const review = readFileSync(
  "app/recruiter/talent-search/v2/SearchPreparationReview.tsx",
  "utf8",
);
const sourceReadiness = readFileSync("lib/searchV2SourceReadiness.ts", "utf8");

assert.match(route, /fetchCandidateSourceByIdentityToken/);
assert.match(
  route,
  /if \(lightweightIdentityLookup\)[\s\S]*authorizeRecruiterJobsRead\(\)[\s\S]*!authorization\.allowed/,
);
assert.ok(
  route.indexOf("if (lightweightIdentityLookup)") <
    route.indexOf("else if (cacheable)"),
  "exact token retrieval must branch before the full dataset loader",
);
assert.match(route, /cacheable && !lightweightIdentityLookup/);
assert.match(
  dataset,
  /Only matching source rows are normalized; the complete candidate population[\s\S]*neither loaded nor scored/,
);
const tokenLoader = dataset.slice(
  dataset.indexOf("async function loadCandidateSourceByIdentityToken"),
  dataset.indexOf("type CandidateDatasetLoadResult"),
);
assert.doesNotMatch(tokenLoader, /rankCandidatesV2|externalTalentProvider/);
assert.match(tokenLoader, /candidateIdsForIdentityToken/);
assert.match(tokenLoader, /\.in\("candidate_id", requestedIds\)/);
assert.doesNotMatch(tokenLoader, /\.ilike\(/);
assert.match(client, /lightweightIdentityTokenLookup/);
assert.match(
  client,
  /requestReadiness = lightweightIdentityTokenLookup[\s\S]*\{ ready: true, message: null \}/,
);
assert.match(review, /sourceReadiness\.ready \|\| lightweightTokenLookup/);
assert.doesNotMatch(client, /Ready when you are/);
for (const source of [client, review, sourceReadiness]) {
  assert.doesNotMatch(
    source,
    /The shared candidate index is warming once|Search will be available when it is ready/,
  );
}
assert.match(
  client,
  /Candidate search could not be prepared\. Please try again\./,
);
assert.match(review, />\s*Retry\s*</);
assert.match(client, /focus-visible:ring-2/);
assert.match(review, /focus-visible:ring-2/);
assert.doesNotMatch(
  client.match(/Understand & review[\s\S]{0,160}/)?.[0] || "",
  /focus:ring/,
);

console.log("Search V2 identity readiness regression tests passed.");
