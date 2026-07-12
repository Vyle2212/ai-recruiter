import { buildQuickFixRepairPlan, writeQuickFixRepairPlan } from "../lib/quickFixRepairSelector";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const plan = buildQuickFixRepairPlan({ batchSize: Number(argValue("batchSize", "25")), focus: argValue("focus", "all") });
  const outputPath = writeQuickFixRepairPlan(plan);
  console.log("Mode: quick fix repair planning only; no candidate DB writes");
  console.log(`Quick fix candidates: ${plan.quickFixCandidates}`);
  console.log(`Selected candidates: ${plan.selectedCandidates}`);
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
