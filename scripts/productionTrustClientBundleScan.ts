import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const staticRoot = path.join(process.cwd(), ".next", "static");
const forbiddenPatterns = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CANDIDATE_SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
  "EXA_API_KEY",
  "sb_secret_",
] as const;
const scannedExtensions = new Set([".js", ".json", ".map", ".txt"]);
const files: string[] = [];

function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (scannedExtensions.has(path.extname(entry.name)))
      files.push(target);
  }
}

if (!statSync(staticRoot).isDirectory())
  throw new Error("Next.js client bundle was not found.");
visit(staticRoot);

const hitCounts = Object.fromEntries(
  forbiddenPatterns.map((pattern) => [pattern, 0]),
) as Record<(typeof forbiddenPatterns)[number], number>;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns)
    if (source.includes(pattern)) hitCounts[pattern] += 1;
}

const totalHits = Object.values(hitCounts).reduce(
  (sum, count) => sum + count,
  0,
);
const report = {
  schemaVersion: "production-trust-client-bundle-scan-v1",
  testedCommit: process.env.GITHUB_SHA || "local-worktree",
  buildId: readFileSync(
    path.join(process.cwd(), ".next", "BUILD_ID"),
    "utf8",
  ).trim(),
  scannedFiles: files.length,
  forbiddenPatternHits: totalHits,
  patternsWithHits: Object.entries(hitCounts)
    .filter(([, count]) => count > 0)
    .map(([pattern]) => pattern),
  secretValuesPrinted: false,
};
const outputDirectory = path.join(process.cwd(), "artifacts");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  path.join(outputDirectory, "production-trust-client-bundle-scan.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(report, null, 2));
if (totalHits > 0)
  throw new Error(
    "Forbidden server secret material was found in client assets.",
  );
