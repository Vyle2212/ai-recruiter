import { loadImportMergePlan, writeImportJson } from "../lib/importMergeFiles";

async function main() {
  const plan = await loadImportMergePlan();
  writeImportJson("import-merge-plan-preview.json", plan);
  console.log("Mode: import merge plan preview only; no candidate DB writes");
  console.log(`Decisions loaded: ${plan.decisionsLoaded}`);
  console.log(`Approved merges: ${plan.approvedMerges}`);
  console.log(`Held/rejected/keep existing excluded: ${plan.excludedDecisions}`);
  console.log(`Candidate records affected: ${plan.candidateRecordsAffected}`);
  console.log(`Field updates planned: ${plan.fieldUpdatesPlanned}`);
  console.log(`Conflicts: ${plan.conflicts}`);
  console.log(`Backup required: ${plan.backupRequired}`);
  console.log(`Rollback ready: ${plan.rollbackReady}`);
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/previewImportMergePlan.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
