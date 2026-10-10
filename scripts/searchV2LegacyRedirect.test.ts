import assert from "node:assert/strict";
import { searchV2LegacyResultsUrl } from "../lib/searchV2LegacyRedirect";

const realJob = "33bc7db0-0e07-42ab-a923-81e1d4cf77f1";
const real = new URL(
  searchV2LegacyResultsUrl({
    q: "SAP FICO Singapore",
    jobId: realJob,
    countries: ["SG", "MY"],
    sapModules: ["FICO"],
    matchQuality: "strong",
    candidateIds: "private-id",
  }),
  "https://example.test",
);
assert.equal(real.pathname, "/recruiter/talent-search/v2");
assert.equal(real.searchParams.get("jobId"), realJob);
assert.equal(real.searchParams.get("q"), "SAP FICO Singapore");
assert.deepEqual(real.searchParams.getAll("countries"), ["SG", "MY"]);
assert.equal(real.searchParams.has("candidateIds"), false);

const preview = new URL(
  searchV2LegacyResultsUrl({
    keyword: "SAP SD",
    jobId: "job-preview-abc",
    matchQuality: "invalid",
  }),
  "https://example.test",
);
assert.equal(preview.searchParams.get("q"), "SAP SD");
assert.equal(preview.searchParams.get("previewJob"), "1");
assert.equal(preview.searchParams.has("jobId"), false);
assert.equal(preview.searchParams.has("matchQuality"), false);

console.log("Search V2 legacy redirect preserves verified job context");
