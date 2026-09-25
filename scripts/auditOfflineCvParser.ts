import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MAX_ORIGINAL_BYTES } from "../lib/originalCvArchiveKey";
import {
  compareOfflineCvAudits,
  createOfflineCvAudit,
  type OfflineCvAudit,
} from "../lib/offlineCvParserAudit";

const MAX_FILES = 100_000;
const DIRECTORY_ERROR = "offline_cv_audit_directory_invalid";

function option(args: string[], name: string) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function outsideRepository(input: string, repository: string) {
  const resolved = fs.realpathSync(input);
  const relative = path.relative(repository, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw Error(DIRECTORY_ERROR);
  return resolved;
}

function validBaseline(value: unknown): value is OfflineCvAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Partial<OfflineCvAudit>;
  return (
    report.artifact === "offline_cv_parser_audit_v2" &&
    typeof report.targetCommitSha === "string" &&
    /^[a-f0-9]{40}$/.test(report.targetCommitSha) &&
    typeof report.collectionFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(report.collectionFingerprint) &&
    report.privacy?.filenamesSerialized === 0 &&
    report.privacy?.candidateIdentifiersSerialized === 0 &&
    report.privacy?.sourceExcerptsSerialized === 0 &&
    report.privacy?.contactFieldsSerialized === 0 &&
    report.privacy?.fileDigestsSerialized === 0 &&
    report.databaseWrites === 0 &&
    report.readyForBulkUpload === false
  );
}

async function main() {
  const args = process.argv.slice(2);
  const allowOcr = args.includes("--allow-ocr");
  const directory = option(args, "--directory");
  const minimumUnique = Number(option(args, "--minimum-unique") || "970");
  const baselinePath = option(args, "--baseline");
  const known = new Set([
    "--directory",
    "--minimum-unique",
    "--baseline",
    "--allow-ocr",
  ]);
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (!known.has(value)) throw Error(DIRECTORY_ERROR);
    if (value !== "--allow-ocr") index++;
  }
  if (!directory || !Number.isSafeInteger(minimumUnique) || minimumUnique < 1)
    throw Error(DIRECTORY_ERROR);
  const repo = fs.realpathSync(process.cwd());
  const root = outsideRepository(directory, repo);
  if (!fs.statSync(root).isDirectory()) throw Error(DIRECTORY_ERROR);

  const targetCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const audit = createOfflineCvAudit({ targetCommitSha });
  async function walk(directory: string) {
    for (const name of fs.readdirSync(directory).sort()) {
      if (name === ".DS_Store" || name === "Thumbs.db") continue;
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error(DIRECTORY_ERROR);
      if (stat.isDirectory()) {
        await walk(file);
        continue;
      }
      if (
        !stat.isFile() ||
        !/\.(?:pdf|docx|txt)$/i.test(name) ||
        stat.size < 1 ||
        stat.size > MAX_ORIGINAL_BYTES ||
        audit.report.files >= MAX_FILES
      )
        throw Error(DIRECTORY_ERROR);
      const buffer = fs.readFileSync(file);
      if (buffer.length !== stat.size) throw Error(DIRECTORY_ERROR);
      await audit.process(buffer, name, allowOcr);
    }
  }
  await walk(root);
  if (audit.report.uniqueFiles < minimumUnique) throw Error(DIRECTORY_ERROR);
  if (!baselinePath) {
    process.stdout.write(JSON.stringify(audit.report) + "\n");
    return;
  }
  const baselineFile = outsideRepository(baselinePath, repo);
  if (!fs.statSync(baselineFile).isFile()) throw Error(DIRECTORY_ERROR);
  const baseline: unknown = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  if (!validBaseline(baseline)) throw Error(DIRECTORY_ERROR);
  process.stdout.write(
    JSON.stringify({
      report: audit.report,
      comparison: compareOfflineCvAudits(baseline, audit.report),
    }) + "\n",
  );
}

main().catch(() => {
  // Filesystem and parser exceptions can contain names, email or CV text.
  process.stderr.write(DIRECTORY_ERROR + "\n");
  process.exitCode = 1;
});
