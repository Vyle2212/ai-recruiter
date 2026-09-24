import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildEmploymentReviewInputsFromCandidateRows,
  buildPrivateEmploymentReviewPack,
  finalizePrivateEmploymentReviewPack,
  type PrivateEmploymentReviewPack,
} from "../lib/productionEmploymentReviewPack";

type PrivateCandidateSnapshot = {
  artifact: "private_production_candidate_snapshot_v1";
  capturedAt: string;
  rows: Array<Record<string, unknown>>;
};

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
      "Employment review refused: private artifacts must remain outside the repository",
    );
  return resolved;
}

function privateOutputPath(outputPath: string, repositoryRoot: string) {
  if (!outputPath.endsWith(".employment-promotion-private.json"))
    throw new Error(
      "Employment review refused: private output filename suffix required",
    );
  const root = fs.realpathSync(repositoryRoot);
  const parent = fs.realpathSync(path.dirname(path.resolve(outputPath)));
  const resolved = path.join(parent, path.basename(outputPath));
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error(
      "Employment review refused: private artifacts must remain outside the repository",
    );
  if (fs.existsSync(resolved))
    throw new Error("Employment review refused: private output already exists");
  return resolved;
}

function readPrivateJson<T>(inputPath: string, repositoryRoot: string): T {
  const safePath = outsideRepository(inputPath, repositoryRoot);
  return JSON.parse(fs.readFileSync(safePath, "utf8")) as T;
}

function writePrivateJson(
  outputPath: string,
  repositoryRoot: string,
  value: unknown,
) {
  const safePath = privateOutputPath(outputPath, repositoryRoot);
  fs.writeFileSync(safePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(safePath, 0o600);
}

function prepare(repositoryRoot: string, currentCommitSha: string) {
  const sourcePath = required(argument("source"), "review_source_path_missing");
  const outputPath = required(argument("output"), "review_output_path_missing");
  const snapshot = readPrivateJson<PrivateCandidateSnapshot>(
    sourcePath,
    repositoryRoot,
  );
  if (
    snapshot.artifact !== "private_production_candidate_snapshot_v1" ||
    !Array.isArray(snapshot.rows)
  )
    throw new Error("Employment review refused: candidate snapshot mismatch");
  const { pack, report } = buildPrivateEmploymentReviewPack({
    candidates: buildEmploymentReviewInputsFromCandidateRows(snapshot.rows),
    capturedAt: snapshot.capturedAt,
    generatedAt: new Date().toISOString(),
    targetCommitSha: currentCommitSha,
  });
  writePrivateJson(outputPath, repositoryRoot, pack);
  console.log(JSON.stringify(report));
}

function finalize(repositoryRoot: string, currentCommitSha: string) {
  const reviewPath = required(argument("review"), "review_pack_path_missing");
  const outputPath = required(argument("output"), "review_output_path_missing");
  const pack = readPrivateJson<PrivateEmploymentReviewPack>(
    reviewPath,
    repositoryRoot,
  );
  const { bundle, report } = finalizePrivateEmploymentReviewPack({
    pack,
    finalizedAt: new Date().toISOString(),
    expectedCommitSha: currentCommitSha,
  });
  writePrivateJson(outputPath, repositoryRoot, bundle);
  console.log(JSON.stringify(report));
}

function main() {
  const repositoryRoot = process.cwd();
  const currentCommitSha = checkedOutCommit(repositoryRoot);
  const command = process.argv[2];
  if (command === "prepare") return prepare(repositoryRoot, currentCommitSha);
  if (command === "finalize") return finalize(repositoryRoot, currentCommitSha);
  throw new Error("employment_review_command_must_be_prepare_or_finalize");
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "production_employment_review_failed",
  );
  process.exitCode = 1;
}
