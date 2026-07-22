import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildImportStagingBatch } from "../lib/importStaging";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || fallback;
}
function loadImportedCandidates(inputPath: string): Record<string, any>[] {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  const candidates = Array.isArray(parsed) ? parsed : parsed?.candidates;
  if (!Array.isArray(candidates)) throw new Error("Import input must be an array or an object with a candidates array.");
  return candidates;
}
export async function createImportStagingBatch(options: { inputPath: string; batchName: string; outputPath?: string }) {
  const imported = loadImportedCandidates(options.inputPath);
  const { candidates: existing } = await loadRealTalentPoolCandidates();
  const batch = buildImportStagingBatch(imported, existing, { batchName: options.batchName });
  const outputPath = path.resolve(options.outputPath || "reports/import/import-staging-batch.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`);
  return { batch, outputPath };
}
async function main() {
  const inputPath = argValue("inputPath", "reports/import/raw-import-candidates.json");
  const batchName = argValue("batchName", "import-staging-v1");
  const { batch } = await createImportStagingBatch({ inputPath, batchName });
  console.log("Mode: import staging only; no candidate DB writes");
  console.log(`Imported candidates loaded: ${batch.importedCandidatesLoaded}`);
  console.log(`Existing candidates loaded: ${batch.existingCandidatesLoaded}`);
  console.log(`Exact matches: ${batch.summary.exactMatches}`);
  console.log(`Likely matches: ${batch.summary.likelyMatches}`);
  console.log(`Possible matches: ${batch.summary.possibleMatches}`);
  console.log(`New candidates: ${batch.summary.newCandidates}`);
  console.log(`Duplicate risks: ${batch.summary.duplicateRisks}`);
  console.log(`Conflicts: ${batch.summary.conflicts}`);
  console.log(`Ready for merge preview: ${batch.summary.readyForMergePreview}`);
  console.log(`Needs recruiter review: ${batch.summary.needsRecruiterReview}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/createImportStagingBatch.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
