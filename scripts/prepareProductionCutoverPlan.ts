import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  buildProductionCutoverPlan,
  PRODUCTION_CUTOVER_SQL_SEQUENCE,
  type ProductionRecoveryEvidence,
} from "../lib/productionCutoverPlan";

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

function outsideRepository(inputPath: string, repositoryRoot: string) {
  const root = fs.realpathSync(repositoryRoot);
  const resolved = fs.realpathSync(inputPath);
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error("production_cutover_private_artifact_inside_repository");
  if ((fs.statSync(resolved).mode & 0o077) !== 0)
    throw new Error("production_cutover_private_artifact_permissions_invalid");
  return resolved;
}

function privateOutputPath(outputPath: string, repositoryRoot: string) {
  if (!outputPath.endsWith(".production-cutover-private.json"))
    throw new Error("production_cutover_private_output_suffix_invalid");
  const root = fs.realpathSync(repositoryRoot);
  const parent = fs.realpathSync(path.dirname(path.resolve(outputPath)));
  const resolved = path.join(parent, path.basename(outputPath));
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error("production_cutover_private_artifact_inside_repository");
  if (fs.existsSync(resolved))
    throw new Error("production_cutover_private_output_exists");
  return resolved;
}

function sha256(contents: string) {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function main() {
  const repositoryRoot = process.cwd();
  const currentCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const evidencePath = outsideRepository(
    required(
      argument("recovery-evidence"),
      "production_recovery_evidence_missing",
    ),
    repositoryRoot,
  );
  const outputPath = privateOutputPath(
    required(argument("output"), "production_cutover_output_missing"),
    repositoryRoot,
  );
  const evidence = JSON.parse(
    fs.readFileSync(evidencePath, "utf8"),
  ) as ProductionRecoveryEvidence;
  const artifacts = PRODUCTION_CUTOVER_SQL_SEQUENCE.map((artifactPath) => {
    const contents = fs.readFileSync(
      path.join(repositoryRoot, artifactPath),
      "utf8",
    );
    const committedContents = execFileSync(
      "git",
      ["show", `${currentCommitSha}:${artifactPath}`],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    if (contents !== committedContents)
      throw new Error("production_cutover_sql_not_committed");
    return { path: artifactPath, sha256: sha256(contents) };
  });
  const plan = buildProductionCutoverPlan({
    evidence,
    artifacts,
    currentCommitSha,
  });
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(outputPath, 0o600);
  console.log(
    JSON.stringify({
      artifact: plan.artifact,
      targetCommitSha: plan.targetCommitSha,
      recoveryEvidenceFingerprint: plan.recoveryEvidenceFingerprint,
      sqlSequenceFingerprint: plan.sqlSequenceFingerprint,
      planFingerprint: plan.planFingerprint,
      steps: plan.steps.length,
      recoveryVerified: plan.recoveryVerified,
      databaseRestoreVerified: plan.databaseRestoreVerified,
      originalCvCollectionVerified: plan.originalCvCollectionVerified,
      readyForSupervisedCutover: plan.readyForSupervisedCutover,
      readyForBulkUpload: plan.readyForBulkUpload,
      privacy: plan.privacy,
      databaseWrites: plan.databaseWrites,
    }),
  );
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "production_cutover_plan_failed",
  );
  process.exitCode = 1;
}
