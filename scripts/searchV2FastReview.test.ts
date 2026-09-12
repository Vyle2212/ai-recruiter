import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSearchV2FastReview,
  clearSearchV2FastReviewCacheForTests,
} from "../lib/searchV2FastReview";

const query = "SAP FICO consultant in Malaysia with implementation experience";
clearSearchV2FastReviewCacheForTests();
const review = buildSearchV2FastReview({
  query,
  talentPool: "internal_profiles",
});
assert.equal(review.timing.externalRequestCount, 0);
assert.deepEqual(
  review.preview.requirements.map((item) => item.kind),
  ["target", "professional_role", "location", "lifecycle"],
);
assert.equal(review.preview.requirements.find((item) => item.kind === "target")?.label, "SAP FICO");
assert.equal(review.preview.requirements.find((item) => item.kind === "professional_role")?.label, "Consultant");
assert.match(review.preview.requirements.find((item) => item.kind === "location")?.label || "", /Malaysia/);
assert.match(review.preview.requirements.find((item) => item.kind === "lifecycle")?.label || "", /SAP FICO Implementation/i);
assert.deepEqual(review.preview.criteria.map((item) => item.label), ["Demonstrated SAP FICO implementation depth"]);
assert.ok(review.preview.requirements.find((item) => item.kind === "professional_role" && item.alternatives.includes("lead")));
assert.doesNotMatch(JSON.stringify(review.preview), /stakeholder|leadership|delivery ownership/i);

const repeated = buildSearchV2FastReview({ query, talentPool: "internal_profiles" });
assert.equal(repeated.identity, review.identity);
assert.equal(repeated.timing.cacheHit, true);
assert.equal(repeated.timing.externalRequestCount, 0);

for (const simple of [
  "SAP FICO",
  "SAP FICO Malaysia",
  "SAP FICO consultant in Malaysia",
  "Senior SAP SD consultant in Singapore with Mandarin",
  "SAP ABAP developer in Vietnam",
]) {
  const result = buildSearchV2FastReview({ query: simple, talentPool: "internal_profiles" });
  assert.equal(result.timing.externalRequestCount, 0);
}

const client = readFileSync("app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx", "utf8");
assert.match(client, /buildSearchV2FastReview/);
assert.match(client, /questions:\s*\[\]/);
assert.doesNotMatch(client, /disabled=\{loading\}[\s\S]{0,300}Understand & review/);
assert.doesNotMatch(client.slice(client.indexOf("function handleSubmit"), client.indexOf("async function runSearch")), /\bfetch\s*\(/);
console.log("searchV2FastReview.test.ts passed");
