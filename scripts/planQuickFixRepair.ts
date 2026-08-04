import { buildQuickFixRepairPlan, writeQuickFixRepairPlan } from "../lib/quickFixRepairSelector";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}
function hasFlag(name: string) { return process.argv.includes(`--${name}`); }

async function main() {
  const offsetArg = argValue("offset");
  const plan = buildQuickFixRepairPlan({ batchSize: Number(argValue("batchSize", "25")), focus: argValue("focus", "all"), batchIndex: Number(argValue("batchIndex", "0")), offset: offsetArg === "" ? undefined : Number(offsetArg), skipPreviouslyBlocked: hasFlag("skipPreviouslyBlocked"), minSafeSuggestions: Number(argValue("minSafeSuggestions", "0")) });
  const outputPath = writeQuickFixRepairPlan(plan);
  console.log("Mode: quick fix repair planning only; no candidate DB writes");
  console.log(`Quick fix candidates: ${plan.quickFixCandidates}`);
  console.log(`Selected candidates: ${plan.selectedCandidates}`);
  console.log(`Batch index: ${plan.batchIndex}`);
  console.log(`Offset: ${plan.offset}`);
  console.log(`Excluded already applied: ${plan.excludedAlreadyAppliedCount}`);
  console.log(`Excluded existing approvals: ${plan.excludedExistingApprovalsCount}`);
  console.log(`Excluded previously blocked: ${plan.excludedPreviouslyBlockedCount}`);
  console.log(`Estimated safe suggestions: ${plan.estimatedSafeSuggestions}`);
  console.log(`Target fields: ${plan.targetFields.join(", ") || "none"}`);
  console.log(`Focus: ${plan.focus}`);
  if (plan.warnings.length) console.log(`Warnings: ${plan.warnings.join("; ")}`);
  if (plan.errors.length) console.log(`Errors: ${plan.errors.join("; ")}`);
  console.log(`Output path: ${outputPath}`);
  if (plan.errors.length) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/planQuickFixRepair.ts")) {
  main().then(() => { if (!process.exitCode) process.exit(0); }).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
