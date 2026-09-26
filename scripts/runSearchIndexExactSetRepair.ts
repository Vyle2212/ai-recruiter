import "server-only";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import {
  assertPrivateSearchIndexRepairArtifactPath,
  prepareSearchIndexExactSetRepairOperator,
  SEARCH_INDEX_EXACT_SET_REPAIR_SQL,
  validateSearchIndexExactSetRepairWriteControls,
  verifySearchIndexExactSetRepairExecution,
  type SearchIndexRepairCutoverPlan,
} from "../lib/searchIndexExactSetRepairOperator";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function required(value: string | undefined, code: string) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function readPrivateJson(input: {
  requestedPath: string;
  repositoryRoot: string;
  requiredSuffix: string;
}) {
  const realPath = fs.realpathSync(input.requestedPath);
  const artifactPath = assertPrivateSearchIndexRepairArtifactPath({
    repositoryRoot: input.repositoryRoot,
    artifactPath: realPath,
    requiredSuffix: input.requiredSuffix,
  });
  if ((fs.statSync(artifactPath).mode & 0o077) !== 0)
    throw new Error("search_index_repair_private_artifact_permissions_invalid");
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as unknown;
}

async function main() {
  const repositoryRoot = process.cwd();
  if (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  )
    throw new Error("search_index_repair_checkout_not_clean");
  const currentCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const request = readPrivateJson({
    requestedPath: required(
      argument("request"),
      "search_index_repair_request_path_missing",
    ),
    repositoryRoot,
    requiredSuffix: ".search-index-repair-private.json",
  });
  const cutoverPlan = readPrivateJson({
    requestedPath: required(
      argument("cutover-plan"),
      "search_index_repair_cutover_plan_path_missing",
    ),
    repositoryRoot,
    requiredSuffix: ".production-cutover-private.json",
  }) as SearchIndexRepairCutoverPlan;

  const workingSql = fs.readFileSync(SEARCH_INDEX_EXACT_SET_REPAIR_SQL, "utf8");
  const committedSql = execFileSync(
    "git",
    ["show", `${currentCommitSha}:${SEARCH_INDEX_EXACT_SET_REPAIR_SQL}`],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  if (workingSql !== committedSql)
    throw new Error("search_index_repair_sql_not_committed");
  const sqlSha256 = createHash("sha256")
    .update(workingSql, "utf8")
    .digest("hex");
  const prepared = prepareSearchIndexExactSetRepairOperator({
    request,
    cutoverPlan,
    currentCommitSha,
    sqlSha256,
  });
  const writeRequested = process.argv.includes("--write");
  const controls = validateSearchIndexExactSetRepairWriteControls({
    writeRequested,
    writeEnabled: process.env.SEARCH_INDEX_REPAIR_WRITE_ENABLED === "true",
    currentCommitSha,
    request: prepared.request,
    expectedProjectRef: String(
      process.env.SEARCH_INDEX_REPAIR_EXPECTED_PROJECT_REF || "",
    ),
    supabaseUrl: String(process.env.SUPABASE_URL || ""),
    serviceRoleKeyAvailable: Boolean(
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    ),
    confirmation: String(process.env.SEARCH_INDEX_REPAIR_CONFIRM || ""),
  });
  if (controls.mode === "dry_run") {
    console.log(JSON.stringify(prepared.report));
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    required(process.env.SUPABASE_URL, "search_index_repair_url_missing"),
    required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "search_index_repair_service_role_missing",
    ),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await client.rpc(
    "apply_candidate_search_index_exact_set_repair",
    { p_request: prepared.request },
  );
  if (error) throw error;
  const { count, error: readbackError } = await client
    .from("candidate_search_index")
    .select("candidate_id", { count: "exact", head: true });
  if (readbackError) throw readbackError;
  const report = verifySearchIndexExactSetRepairExecution({
    result: data,
    request: prepared.request,
    observedRemainingIndexCount: count ?? -1,
  });
  console.log(JSON.stringify(report));
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "search_index_repair_failed",
  );
  process.exitCode = 1;
});
