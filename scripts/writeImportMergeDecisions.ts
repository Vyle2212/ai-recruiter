import { buildDefaultImportMergeDecisionFile } from "../lib/importMergeApproval";
import { loadImportMergeProposals, writeImportJson } from "../lib/importMergeFiles";

async function main() {
  const proposals = await loadImportMergeProposals();
  const file = buildDefaultImportMergeDecisionFile(proposals);
  const writeDecisionFile = process.argv.includes("--writeDecisionFile");
  console.log(writeDecisionFile ? "Mode: local import merge decision file write; no candidate DB writes" : "Mode: import merge decision preview only; no candidate DB writes");
  console.log(`Decisions prepared: ${file.decisions.length}`);
  if (writeDecisionFile) console.log(`Output path: ${writeImportJson("import-merge-decisions.json", file)}`);
  else console.log("Decision file not written. Use --writeDecisionFile to persist local decisions.");
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/writeImportMergeDecisions.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
