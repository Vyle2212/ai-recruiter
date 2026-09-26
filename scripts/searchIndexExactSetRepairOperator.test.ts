import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { buildSearchIndexExactSetRepair } from "../lib/searchIndexExactSetRepair";
import {
  assertPrivateSearchIndexRepairArtifactPath,
  prepareSearchIndexExactSetRepairOperator,
  SEARCH_INDEX_EXACT_SET_REPAIR_SQL,
  validateSearchIndexExactSetRepairWriteControls,
  verifySearchIndexExactSetRepairExecution,
  type SearchIndexRepairCutoverPlan,
} from "../lib/searchIndexExactSetRepairOperator";

const commitSha = "a".repeat(40);
const timestamp = "2026-09-25T01:00:00.000Z";
const complete = {
  id: "synthetic-complete",
  status: "active",
  updated_at: timestamp,
  name: "Synthetic Candidate",
  primary_module: "FICO",
  email: "synthetic@example.invalid",
};
const blocked = {
  id: "synthetic-review",
  status: "needs_review",
  updated_at: timestamp,
  name: "Synthetic Review",
  primary_module: "SD",
  email: "review@example.invalid",
};
const indexRows = [complete, blocked].map((candidate) => ({
  candidate_id: candidate.id,
  source_updated_at: timestamp,
  updated_at: timestamp,
}));
const { request } = buildSearchIndexExactSetRepair({
  candidates: [complete, blocked],
  indexRows,
  targetCommitSha: commitSha,
});
const sqlSha256 = createHash("sha256").update("sql").digest("hex");
const cutoverPlan: SearchIndexRepairCutoverPlan = {
  artifact: "production_cutover_plan_v1",
  targetCommitSha: commitSha,
  planFingerprint: createHash("sha256").update("plan").digest("hex"),
  generatedAt: "2026-09-25T01:30:00.000Z",
  recoveryVerified: true,
  databaseRestoreVerified: true,
  originalCvCollectionVerified: true,
  readyForSupervisedCutover: true,
  readyForBulkUpload: false,
  steps: [{ path: SEARCH_INDEX_EXACT_SET_REPAIR_SQL, sha256: sqlSha256 }],
};
const prepared = prepareSearchIndexExactSetRepairOperator({
  request,
  cutoverPlan,
  currentCommitSha: commitSha,
  sqlSha256,
  now: new Date("2026-09-25T02:00:00.000Z"),
});
assert.equal(prepared.report.rowsPlannedForDeletion, 1);
assert.equal(prepared.report.recoveryVerified, true);
assert.equal(prepared.report.sqlFingerprintVerified, true);
assert.equal(prepared.report.databaseWrites, 0);
assert.doesNotMatch(
  JSON.stringify(prepared.report),
  /synthetic-complete|synthetic-review/,
);

const projectRef = "abcdefghijklmno";
const confirmation = [
  "authorize-search-index-exact-set-repair",
  commitSha,
  request.planFingerprint,
  projectRef,
  request.expectedDeleteCount,
  request.expectedRemainingIndexCount,
].join(":");
assert.deepEqual(
  validateSearchIndexExactSetRepairWriteControls({
    writeRequested: false,
    writeEnabled: false,
    currentCommitSha: commitSha,
    request,
    expectedProjectRef: "",
    supabaseUrl: "",
    serviceRoleKeyAvailable: false,
    confirmation: "",
  }),
  { mode: "dry_run" },
);
assert.deepEqual(
  validateSearchIndexExactSetRepairWriteControls({
    writeRequested: true,
    writeEnabled: true,
    currentCommitSha: commitSha,
    request,
    expectedProjectRef: projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    serviceRoleKeyAvailable: true,
    confirmation,
  }),
  { mode: "write", projectRef },
);
for (const invalid of [
  { writeEnabled: false },
  { expectedProjectRef: "differentproject" },
  { serviceRoleKeyAvailable: false },
  { confirmation: `${confirmation}-changed` },
]) {
  assert.throws(
    () =>
      validateSearchIndexExactSetRepairWriteControls({
        writeRequested: true,
        writeEnabled: true,
        currentCommitSha: commitSha,
        request,
        expectedProjectRef: projectRef,
        supabaseUrl: `https://${projectRef}.supabase.co`,
        serviceRoleKeyAvailable: true,
        confirmation,
        ...invalid,
      }),
    /search_index_repair_/,
  );
}

assert.throws(
  () =>
    prepareSearchIndexExactSetRepairOperator({
      request,
      cutoverPlan: {
        ...cutoverPlan,
        generatedAt: "2026-09-23T00:00:00.000Z",
      },
      currentCommitSha: commitSha,
      sqlSha256,
      now: new Date("2026-09-25T02:00:00.000Z"),
    }),
  /cutover_plan_stale/,
);
assert.throws(
  () =>
    prepareSearchIndexExactSetRepairOperator({
      request,
      cutoverPlan,
      currentCommitSha: commitSha,
      sqlSha256: "b".repeat(64),
      now: new Date("2026-09-25T02:00:00.000Z"),
    }),
  /sql_fingerprint_mismatch/,
);
const tampered = structuredClone(request);
tampered.deleteCandidateIds = [complete.id];
assert.throws(
  () =>
    prepareSearchIndexExactSetRepairOperator({
      request: tampered,
      cutoverPlan,
      currentCommitSha: commitSha,
      sqlSha256,
      now: new Date("2026-09-25T02:00:00.000Z"),
    }),
  /fingerprint_mismatch/,
);

const execution = verifySearchIndexExactSetRepairExecution({
  result: {
    artifact: "candidate_search_index_exact_set_repair_execution_v1",
    targetCommitSha: commitSha,
    planFingerprint: request.planFingerprint,
    rowsDeleted: request.expectedDeleteCount,
    rowsRemaining: request.expectedRemainingIndexCount,
    exactReadbackVerified: true,
    transactionCommitted: true,
  },
  request,
  observedRemainingIndexCount: request.expectedRemainingIndexCount,
});
assert.equal(execution.productionAcceptanceComplete, false);
assert.throws(
  () =>
    verifySearchIndexExactSetRepairExecution({
      result: { ...execution, transactionCommitted: true },
      request,
      observedRemainingIndexCount: request.expectedRemainingIndexCount + 1,
    }),
  /execution_readback_mismatch/,
);

assert.throws(
  () =>
    assertPrivateSearchIndexRepairArtifactPath({
      repositoryRoot: "/workspace/repository",
      artifactPath:
        "/workspace/repository/private/request.search-index-repair-private.json",
      requiredSuffix: ".search-index-repair-private.json",
    }),
  /inside_repository/,
);
assert.equal(
  assertPrivateSearchIndexRepairArtifactPath({
    repositoryRoot: "/workspace/repository",
    artifactPath: "/workspace/private/request.search-index-repair-private.json",
    requiredSuffix: ".search-index-repair-private.json",
  }),
  path.resolve("/workspace/private/request.search-index-repair-private.json"),
);

const runner = fs.readFileSync(
  new URL("./runSearchIndexExactSetRepair.ts", import.meta.url),
  "utf8",
);
assert.match(runner, /process\.argv\.includes\("--write"\)/);
assert.match(runner, /SEARCH_INDEX_REPAIR_WRITE_ENABLED/);
assert.match(runner, /SEARCH_INDEX_REPAIR_EXPECTED_PROJECT_REF/);
assert.match(runner, /SEARCH_INDEX_REPAIR_CONFIRM/);
assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(runner, /count: "exact", head: true/);
assert.doesNotMatch(runner, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.doesNotMatch(
  runner,
  /console\.log\([^)]*(?:request|deleteCandidateIds)/,
);

console.log("Search-index exact-set repair operator regression passed.");
