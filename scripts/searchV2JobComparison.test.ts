import assert from "node:assert/strict";
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
console.log("Search V2 job comparison tests passed.");
