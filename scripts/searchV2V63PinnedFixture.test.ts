import assert from "node:assert/strict";

import { SEARCH_V2_V63_GOLDEN_SANITIZED } from "./fixtures/searchV2V63GoldenSanitized";

async function main() {
  const fixture = SEARCH_V2_V63_GOLDEN_SANITIZED;
  assert.equal(
    fixture.fixtureVersion,
    "search-v2-v63-sap-fico-golden-sanitized-v1",
  );
  assert.equal(fixture.datasetRevision, "a43755cc64f280260693");
  assert.equal(fixture.sourceRows, 833);
  assert.equal(fixture.canonicalPeople, 822);
  assert.equal(fixture.visiblePopulation, 18);
  assert.deepEqual(fixture.buckets, { strong: 7, good: 3, potential: 8 });
  assert.equal(fixture.compoundImplementation.visiblePopulation, 6);
  assert.equal(fixture.containsCandidatePii, false);
  console.log("Immutable Search V2 v63 18-result fixture passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
