import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readSearchIndexPages } from "../lib/searchV2IndexPagination";

async function main() {
  const source = Array.from({ length: 2_503 }, (_, index) => ({
    candidate_id: String(index + 1).padStart(6, "0"),
  }));
  let calls = 0;
  const loaded = await readSearchIndexPages(async (cursor, pageSize) => {
    calls++;
    return {
      data: source
        .filter((row) => !cursor || row.candidate_id > cursor)
        .slice(0, pageSize),
      error: null,
    };
  });
  assert.deepEqual(
    loaded,
    source,
    "candidate searches must not stop at 1,000 or 2,000 rows",
  );
  assert.equal(calls, 6);
  await assert.rejects(
    readSearchIndexPages(
      async (cursor) => ({
        data: [{ candidate_id: cursor || "000001" }],
        error: null,
      }),
      1,
    ),
    /order is invalid/,
    "a repeated boundary must fail instead of silently dropping candidates",
  );
  await assert.rejects(
    readSearchIndexPages(async () => ({
      data: null,
      error: { message: "unavailable" },
    })),
    /query failed/,
  );
  const legacySearchRoute = readFileSync(
    "app/api/search-candidates/route.ts",
    "utf8",
  );
  const broadPage = legacySearchRoute
    .split("async function fetchBroadCandidatePage")[1]
    ?.split("async function fetchCandidateDetailsByIds")[0];
  assert.ok(broadPage, "legacy broad search path must remain covered");
  assert.doesNotMatch(broadPage, /limit\(2000\)/);
  assert.match(broadPage, /\.gt\("id", lastId\)/);
  assert.doesNotMatch(
    legacySearchRoute,
    /knownExactNameFallbackIds/,
    "search code must not embed candidate-specific identity overrides",
  );
  console.log("searchV2IndexPagination.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
