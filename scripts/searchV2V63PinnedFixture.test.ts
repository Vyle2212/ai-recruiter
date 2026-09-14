import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

async function main() {
  const bytes = await readFile(
    new URL("../data/search-v2-v63-sap-fico-golden.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "b6b12d0793763b9883f175cb456dfd12d828cfc982ec6896a58f180f61996079",
    "The immutable v63 fixture changed without an explicit re-baseline",
  );
  const fixture = JSON.parse(bytes.toString("utf8")) as {
    fixtureVersion: string;
    datasetRevision: string;
    sourceRows: number;
    visiblePopulation: number;
    results: Array<{ token: string }>;
  };
  assert.equal(fixture.fixtureVersion, "search-v2-v63-sap-fico-golden-v1");
  assert.equal(fixture.datasetRevision, "a43755cc64f280260693");
  assert.equal(fixture.sourceRows, 833);
  assert.equal(fixture.visiblePopulation, 18);
  assert.equal(fixture.results.length, 18);
  assert.equal(new Set(fixture.results.map((result) => result.token)).size, 18);
  console.log("Immutable Search V2 v63 18-result fixture passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
