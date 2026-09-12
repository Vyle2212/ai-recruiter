import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  buildSearchV2FastReview,
  clearSearchV2FastReviewCacheForTests,
} from "../lib/searchV2FastReview";

const queries = [
  "SAP FICO",
  "SAP FICO Malaysia",
  "SAP FICO consultant in Malaysia",
  "SAP FICO consultant in Malaysia with implementation experience",
  "Senior SAP SD consultant in Singapore with Mandarin",
  "SAP ABAP developer in Vietnam",
];
const timings: number[] = [];
let externalCalls = 0;
clearSearchV2FastReviewCacheForTests();
for (let index = 0; index < 30; index += 1) {
  const started = performance.now();
  const result = buildSearchV2FastReview({
    query: queries[index % queries.length],
    talentPool: "internal_profiles",
  });
  timings.push(performance.now() - started);
  externalCalls += result.timing.externalRequestCount;
}
const warmed = timings.slice(6).sort((a, b) => a - b);
const percentile = (values: number[], p: number) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
const median = percentile(warmed, 0.5);
const p95 = percentile(warmed, 0.95);
assert.equal(externalCalls, 0);
assert.ok(median < 250, `median ${median.toFixed(3)}ms exceeds 250ms`);
assert.ok(p95 < 500, `p95 ${p95.toFixed(3)}ms exceeds 500ms`);
console.log(JSON.stringify({ iterations: timings.length, warmedIterations: warmed.length, medianMs: Number(median.toFixed(3)), p95Ms: Number(p95.toFixed(3)), repeatedCachedMs: Number(warmed[0].toFixed(3)), externalCallsBeforeReview: externalCalls }));
