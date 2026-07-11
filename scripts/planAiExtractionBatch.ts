import { buildAiExtractionBatchPlan, writeAiExtractionBatchPlan } from "../lib/aiExtractionBatchPlanner";
import { parseTargetFields } from "../lib/aiExtractionBatchGuardrails";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

export async function planBatchFromArgs() {
  const { candidates } = await loadRealTalentPoolCandidates();
  return buildAiExtractionBatchPlan(candidates, {
    batchSize: Number(argValue("batchSize", "10")),
    targetFields: parseTargetFields(argValue("targetFields", "currentCompany,title,primarySapModule")),
    provider: (argValue("provider", "mock") || "mock") as any,
    maxAiCalls: argValue("maxAiCalls") ? Number(argValue("maxAiCalls")) : undefined,
    confirmOpenAi: process.argv.includes("--confirmOpenAi"),
    includeMustRepair: process.argv.includes("--includeMustRepair"),
    validationQueueOnly: process.argv.includes("--validationQueueOnly"),
    highConfidenceOnly: process.argv.includes("--highConfidenceOnly"),
  });
}

export function printBatchPlan(plan: Awaited<ReturnType<typeof planBatchFromArgs>>, outputPath: string) {
  console.log("Mode: batch planning only; no candidate DB writes");
  console.log(`Total candidates: ${plan.summary.totalCandidateRecords}`);
  console.log(`Eligible candidates: ${plan.summary.candidatesEligibleForBatch}`);
  console.log(`Excluded candidates: ${plan.summary.excludedCandidates}`);
  console.log(`Selected candidates: ${plan.selectedCandidates.length}`);
  console.log(`Target fields: ${plan.targetFields.join(", ")}`);
  console.log(`Estimated AI calls: ${plan.summary.estimatedAiCalls}`);
  console.log(`Provider mode: ${plan.providerMode}`);
  console.log(`Safety status: ${plan.summary.safetyStatus}`);
  if (plan.guardrails.warnings.length) console.log(`Warnings: ${plan.guardrails.warnings.join("; ")}`);
  if (plan.guardrails.errors.length) console.log(`Errors: ${plan.guardrails.errors.join("; ")}`);
  console.log(`Output path: ${outputPath}`);
}

async function main() {
  const plan = await planBatchFromArgs();
  const outputPath = writeAiExtractionBatchPlan(plan);
  printBatchPlan(plan, outputPath);
  if (!plan.guardrails.ok) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/planAiExtractionBatch.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}