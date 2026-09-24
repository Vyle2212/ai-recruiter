import "server-only";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import {
  verifyPersistedEmploymentPromotionExecutionBundle,
  type PrivateEmploymentPromotionAuthorizationArtifact,
} from "../lib/productionEmploymentPromotionAuthorization";
import type { PrivateEmploymentPromotionBackupArtifact } from "../lib/productionEmploymentPromotionBackup";
import {
  assertPrivateEmploymentPromotionBundlePath,
  prepareEmploymentPromotionOperatorRun,
  validateEmploymentPromotionWriteControls,
  type EmploymentPromotionOperatorBundle,
} from "../lib/productionEmploymentPromotionOperator";

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

function checkedOutCommit(repositoryRoot: string) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readPrivateEvidence<T>(inputPath: string, repositoryRoot: string): T {
  if (!inputPath.endsWith(".employment-promotion-private.json"))
    throw new Error(
      "Employment promotion operator refused: private evidence filename suffix required",
    );
  const resolved = fs.realpathSync(inputPath);
  assertPrivateEmploymentPromotionBundlePath({
    repositoryRoot,
    bundlePath: resolved,
  });
  if ((fs.statSync(resolved).mode & 0o077) !== 0)
    throw new Error(
      "Employment promotion operator refused: private evidence must use owner-only permissions",
    );
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as T;
}

async function main() {
  const repositoryRoot = process.cwd();
  const requestedBundlePath = required(
    argument("bundle"),
    "promotion_bundle_path_missing",
  );
  const bundlePath = assertPrivateEmploymentPromotionBundlePath({
    repositoryRoot,
    bundlePath: fs.realpathSync(requestedBundlePath),
  });
  if (
    !bundlePath.endsWith(".employment-promotion-private.json") ||
    (fs.statSync(bundlePath).mode & 0o077) !== 0
  )
    throw new Error(
      "Employment promotion operator refused: private bundle must use owner-only permissions and private suffix",
    );
  const bundle = JSON.parse(
    fs.readFileSync(bundlePath, "utf8"),
  ) as EmploymentPromotionOperatorBundle;
  const currentCommitSha = checkedOutCommit(repositoryRoot);
  const { preflight, report } = prepareEmploymentPromotionOperatorRun({
    bundle,
    expectedCommitSha: currentCommitSha,
  });
  const writeRequested = process.argv.includes("--write");
  const controls = validateEmploymentPromotionWriteControls({
    writeRequested,
    writeEnabled: process.env.EMPLOYMENT_PROMOTION_WRITE_ENABLED === "true",
    currentCommitSha,
    targetCommitSha: preflight.targetCommitSha,
    preflightFingerprint: preflight.preflightFingerprint,
    expectedProjectRef: String(
      process.env.EMPLOYMENT_PROMOTION_EXPECTED_PROJECT_REF || "",
    ),
    supabaseUrl: String(process.env.SUPABASE_URL || ""),
    serviceRoleKeyAvailable: Boolean(
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    ),
    confirmation: String(process.env.EMPLOYMENT_PROMOTION_CONFIRM || ""),
  });

  if (controls.mode === "dry_run") {
    console.log(JSON.stringify(report));
    return;
  }

  if (!bundle.backup || !bundle.authorization)
    throw new Error(
      "Employment promotion operator refused: verified backup and authorization are required for --write",
    );

  const persistedBackup =
    readPrivateEvidence<PrivateEmploymentPromotionBackupArtifact>(
      required(argument("backup"), "promotion_private_backup_path_missing"),
      repositoryRoot,
    );
  const persistedAuthorization =
    readPrivateEvidence<PrivateEmploymentPromotionAuthorizationArtifact>(
      required(
        argument("authorization"),
        "promotion_private_authorization_path_missing",
      ),
      repositoryRoot,
    );
  verifyPersistedEmploymentPromotionExecutionBundle({
    bundle,
    backup: persistedBackup,
    authorization: persistedAuthorization,
    expectedCommitSha: currentCommitSha,
  });

  const [{ createClient }, { executeEmploymentPromotionBatchViaSupabase }] =
    await Promise.all([
      import("@supabase/supabase-js"),
      import("../lib/productionEmploymentPromotionSupabase"),
    ]);
  const client = createClient(
    required(process.env.SUPABASE_URL, "promotion_supabase_url_missing"),
    required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "promotion_service_role_key_missing",
    ),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const result = await executeEmploymentPromotionBatchViaSupabase({
    client,
    preflight,
    backup: bundle.backup,
    authorization: bundle.authorization,
    expectedCommitSha: currentCommitSha,
  });
  console.log(
    JSON.stringify({
      ...result,
      searchIndexRebuildRequired: result.searchIndexRowsInvalidated > 0,
      productionAcceptanceComplete: false,
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "production_employment_promotion_failed",
  );
  process.exitCode = 1;
});
