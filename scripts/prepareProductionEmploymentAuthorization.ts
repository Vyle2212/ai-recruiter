import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  attachVerifiedEmploymentPromotionAuthorization,
  buildPrivateEmploymentPromotionAuthorization,
  type PrivateEmploymentPromotionAuthorizationArtifact,
} from "../lib/productionEmploymentPromotionAuthorization";
import type { PrivateEmploymentPromotionBackupArtifact } from "../lib/productionEmploymentPromotionBackup";
import type { EmploymentPromotionOperatorBundle } from "../lib/productionEmploymentPromotionOperator";

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

function outsideRepository(inputPath: string, repositoryRoot: string) {
  const root = fs.realpathSync(repositoryRoot);
  const resolved = fs.realpathSync(inputPath);
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error(
      "Employment promotion authorization refused: private artifacts must remain outside the repository",
    );
  if ((fs.statSync(resolved).mode & 0o077) !== 0)
    throw new Error(
      "Employment promotion authorization refused: private input must use owner-only permissions",
    );
  return resolved;
}

function privateOutputPath(outputPath: string, repositoryRoot: string) {
  if (!outputPath.endsWith(".employment-promotion-private.json"))
    throw new Error(
      "Employment promotion authorization refused: private output filename suffix required",
    );
  const root = fs.realpathSync(repositoryRoot);
  const parent = fs.realpathSync(path.dirname(path.resolve(outputPath)));
  const resolved = path.join(parent, path.basename(outputPath));
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error(
      "Employment promotion authorization refused: private artifacts must remain outside the repository",
    );
  if (fs.existsSync(resolved))
    throw new Error(
      "Employment promotion authorization refused: private output already exists",
    );
  return resolved;
}

function readPrivateJson<T>(inputPath: string, repositoryRoot: string): T {
  return JSON.parse(
    fs.readFileSync(outsideRepository(inputPath, repositoryRoot), "utf8"),
  ) as T;
}

function writePrivateJson(outputPath: string, value: unknown) {
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(outputPath, 0o600);
}

function main() {
  const repositoryRoot = process.cwd();
  const currentCommitSha = checkedOutCommit(repositoryRoot);
  const bundle = readPrivateJson<EmploymentPromotionOperatorBundle>(
    required(argument("bundle"), "promotion_bundle_path_missing"),
    repositoryRoot,
  );
  const backup = readPrivateJson<PrivateEmploymentPromotionBackupArtifact>(
    required(argument("backup"), "promotion_backup_path_missing"),
    repositoryRoot,
  );
  const authorizationPath = privateOutputPath(
    required(
      argument("authorization"),
      "promotion_authorization_output_path_missing",
    ),
    repositoryRoot,
  );
  const outputPath = privateOutputPath(
    required(argument("output"), "promotion_bundle_output_path_missing"),
    repositoryRoot,
  );
  if (authorizationPath === outputPath)
    throw new Error(
      "Employment promotion authorization refused: authorization and bundle outputs must differ",
    );

  const built = buildPrivateEmploymentPromotionAuthorization({
    bundle,
    backup,
    expectedCommitSha: currentCommitSha,
    authorizedBy: required(
      argument("authorized-by"),
      "promotion_release_owner_missing",
    ),
    authorizedAt: new Date().toISOString(),
    confirmation: required(
      argument("confirm"),
      "promotion_release_confirmation_missing",
    ),
  });
  writePrivateJson(authorizationPath, built.authorization);

  const persistedAuthorization =
    readPrivateJson<PrivateEmploymentPromotionAuthorizationArtifact>(
      authorizationPath,
      repositoryRoot,
    );
  const verified = attachVerifiedEmploymentPromotionAuthorization({
    bundle,
    backup,
    authorization: persistedAuthorization,
    expectedCommitSha: currentCommitSha,
  });
  writePrivateJson(outputPath, verified.bundle);
  console.log(JSON.stringify(verified.report));
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "production_employment_authorization_failed",
  );
  process.exitCode = 1;
}
