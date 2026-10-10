import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const acceptance = readFileSync(
  "acceptance/e2e/productionTrustAuthenticatedAcceptance.spec.ts",
  "utf8",
);
const probe = readFileSync("scripts/searchV2AcceptanceLatency.mjs", "utf8");
const workflow = readFileSync(
  ".github/workflows/production-trust-ci.yml",
  "utf8",
);

assert.match(acceptance, /SEARCH_V2_ACCEPTANCE_BUDGET_MS = 3_000/);
assert.match(
  acceptance,
  /firstSearchMs,[\s\S]*toBeLessThanOrEqual\(SEARCH_V2_ACCEPTANCE_BUDGET_MS\)/,
);
assert.match(
  acceptance,
  /warmSearchMs,[\s\S]*toBeLessThanOrEqual\(SEARCH_V2_ACCEPTANCE_BUDGET_MS\)/,
);
assert.match(
  acceptance,
  /attachSanitized\(testInfo, "internal-search", \{[\s\S]*latencyBudgetMs:[\s\S]*firstSearchMs,[\s\S]*warmSearchMs,/,
);
assert.match(probe, /SEARCH_V2_ACCEPTANCE_BUDGET_MS = 3_000/);
for (const measurement of ["firstMs", "warmMedianMs", "warmMaxMs"])
  assert.match(
    probe,
    new RegExp(`result\\.${measurement} <= SEARCH_V2_ACCEPTANCE_BUDGET_MS`),
  );
assert.match(
  workflow,
  /node --import tsx scripts\/searchV2PerformanceUx\.test\.ts/,
);

console.log("Search V2 authenticated acceptance latency contract passed.");
