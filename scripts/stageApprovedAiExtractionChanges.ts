import { buildAiExtractionStagingPreview } from "../lib/aiExtractionStagingPreview";
import { stageApprovedChanges } from "../lib/aiExtractionStagingStore";
import { loadStagingInputs, printStagingPreview } from "./auditAiExtractionStagingPreview";

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const inputs = loadStagingInputs();
  const preview = buildAiExtractionStagingPreview(inputs.workspace, inputs.approvals);
  const writeStaging = hasFlag("writeStaging");
  const result = stageApprovedChanges(preview.items, { dryRun: !writeStaging, writeStaging });
  printStagingPreview(preview, inputs);
  console.log(`Stage mode: ${result.mode}`);
  console.log(`Dry run: ${result.dryRun}`);
  console.log(`Staged count: ${result.stagedCount}`);
  console.log(`Rejected count: ${preview.rejectedStagingItems}`);
  console.log(`Output path: ${result.outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/stageApprovedAiExtractionChanges.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
