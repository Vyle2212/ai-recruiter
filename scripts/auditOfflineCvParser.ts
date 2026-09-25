import fs from "node:fs";
import path from "node:path";
import { MAX_ORIGINAL_BYTES } from "../lib/originalCvArchiveKey";
import { createOfflineCvAudit } from "../lib/offlineCvParserAudit";

const MAX_FILES = 100_000;
const DIRECTORY_ERROR = "offline_cv_audit_directory_invalid";

async function main() {
  const args = process.argv.slice(2);
  const allowOcr = args.includes("--allow-ocr");
  if (
    args[0] !== "--directory" ||
    !args[1] ||
    args.length !== (allowOcr ? 3 : 2) ||
    (allowOcr && args[2] !== "--allow-ocr")
  )
    throw Error(DIRECTORY_ERROR);
  const repo = fs.realpathSync(process.cwd());
  const root = fs.realpathSync(args[1]);
  const relative = path.relative(repo, root);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw Error(DIRECTORY_ERROR);
  if (!fs.statSync(root).isDirectory()) throw Error(DIRECTORY_ERROR);

  const audit = createOfflineCvAudit();
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
  process.stdout.write(JSON.stringify(audit.report) + "\n");
}

main().catch(() => {
  // Filesystem and parser exceptions can contain names, email or CV text.
  process.stderr.write(DIRECTORY_ERROR + "\n");
  process.exitCode = 1;
});
