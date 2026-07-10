import { buildCandidateApplyPlan, loadStagingItems, writeCandidateApplyPreview, type CandidateApplyPlan } from "../lib/aiExtractionCandidateApplyPlan";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

export async function buildPlanFromArgs() {
  const stagingPath = argValue("stagingPath", "reports/ai-extraction-staging.json");
  const stagedItems = loadStagingItems(stagingPath);
  const { candidates } = await loadRealTalentPoolCandidates();
  return buildCandidateApplyPlan(stagedItems, candidates);
}

export function printCandidateApplyPlan(plan: CandidateApplyPlan) {
  console.log("Mode: dry-run only; no candidate DB writes");
  console.log(`Staged items loaded: ${plan.stagedItemsLoaded}`);
  console.log(`Candidates affected: ${plan.candidatesAffected}`);
  console.log(`Fields eligible for apply: ${plan.fieldsEligibleForApply}`);
  console.log(`Fields blocked: ${plan.fieldsBlocked}`);
  console.log(`Conflicts detected: ${plan.conflictsDetected}`);
  console.log(`Backup required: ${plan.backupRequired}`);
  console.log(`Rollback ready: ${plan.rollbackReady}`);
  console.log(`Would update count: ${plan.wouldUpdateCount}`);
  console.log(`Would preserve count: ${plan.wouldPreserveCount}`);
  console.log("Top 30 apply candidates:");
  plan.eligibleItems.slice(0, 30).forEach((item) => console.log(`- ${item.candidateId} | ${item.fieldName} -> ${item.candidateField} | ${item.approvedValue}`));
  console.log("Top 30 blocked fields:");
  plan.blockedItems.slice(0, 30).forEach((item) => console.log(`- ${item.candidateId} | ${item.fieldName} | ${item.reasons.join("; ")}`));
  console.log("Top 30 conflicts:");
  plan.conflicts.slice(0, 30).forEach((item) => console.log(`- ${item.candidateId} | ${item.fieldName} | ${item.reasons.join("; ")}`));
}

async function main() {
  const plan = await buildPlanFromArgs();
  writeCandidateApplyPreview(plan);
  printCandidateApplyPlan(plan);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditCandidateApplyFromStaging.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
