import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  POST as adminBulkPost,
  GET as adminBulkGet,
} from "../app/api/admin/rebuild-search-index/route";
import {
  POST as adminSinglePost,
  GET as adminSingleGet,
} from "../app/api/admin/rebuild-candidate/route";
import { POST as legacyBulkPost } from "../app/api/candidate-search-index/rebuild/route";
import { POST as legacySyncPost } from "../app/api/candidate-search-index/sync/route";
import { POST as legacyEmbedPost } from "../app/api/embed-candidate/route";
import {
  upsertCandidateSearchIndex,
  syncCandidateSearchIndexSince,
} from "../lib/candidateSearchIndex";
import {
  rebuildOneCandidate,
  rebuildSearchIndex,
} from "../lib/search/rebuildSearchIndex";
import { recruiterApiPolicyForRequest } from "../lib/recruiterApiPolicyRegistry";

async function main() {
  const { POST: repairPost } = await import(
    "../app/api/admin/repair-candidate-data/route"
  );
  for (const suffix of ["", "?dryRun=0"]) {
    const request = new Request(
      `https://ci.invalid/api/admin/repair-candidate-data${suffix}`,
    );
    const response = await repairPost(
      request as Parameters<typeof repairPost>[0],
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      success: false,
      error: "reviewed_repair_transaction_required",
    });
  }

  for (const action of [
    adminBulkPost,
    adminBulkGet,
    adminSinglePost,
    legacyBulkPost,
    legacySyncPost,
    legacyEmbedPost,
  ]) {
    const response = await action();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      success: false,
      error: "search_index_promotion_required",
    });
  }

  const getResponse = await adminSingleGet();
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get("Allow"), "POST");
  await assert.rejects(
    rebuildSearchIndex(),
    /Legacy search-index writes are disabled/,
  );
  await assert.rejects(
    rebuildOneCandidate("example"),
    /Legacy search-index writes are disabled/,
  );
  await assert.rejects(
    upsertCandidateSearchIndex({ id: "example" }),
    /Legacy search-index writes are disabled/,
  );
  await assert.rejects(
    syncCandidateSearchIndexSince(),
    /Legacy search-index writes are disabled/,
  );

  for (const pathname of [
    "/api/admin/rebuild-search-index",
    "/api/admin/rebuild-candidate",
    "/api/candidate-search-index/rebuild",
    "/api/candidate-search-index/sync",
    "/api/embed-candidate",
  ]) {
    assert.equal(
      recruiterApiPolicyForRequest(pathname, "POST")?.requiredPermission,
      "recruiter.data_quality.apply",
    );
  }
  assert.equal(
    recruiterApiPolicyForRequest("/api/admin/audit-search-index", "GET")
      ?.requiredPermission,
    "recruiter.data_quality.review",
  );

  const repairSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/repair-candidate-data/route.ts"),
    "utf8",
  );
  assert.match(repairSource, /reviewed_repair_transaction_required/);
  assert.doesNotMatch(
    repairSource,
    /\.update\(|\/api\/admin\/rebuild-candidate/,
  );

  const cli = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/rebuild-index.ts"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    },
  );
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /Legacy search-index writes are disabled/);

  console.log("Legacy search-index mutation gates passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
