import fs from "node:fs";
import path from "node:path";
import { loadAiExtractionBatchPlan } from "../lib/aiExtractionBatchPlanner";
import { validateBatchGuardrails } from "../lib/aiExtractionBatchGuardrails";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

export function buildBatchDryRun(planPath: string, options: { provider?: string; maxAiCalls?: number; confirmOpenAi?: boolean } = {}) {
  const plan = loadAiExtractionBatchPlan(planPath);
  if (!plan) throw new Error(`Batch plan not found: ${planPath}`);
  const guardrails = validateBatchGuardrails({ batchSize: plan.summary.selectedBatchSize, targetFields: plan.targetFields, provider: options.provider || "mock", maxAiCalls: options.maxAiCalls, confirmOpenAi: options.confirmOpenAi });
  if (!guardrails.ok) throw new Error(guardrails.errors.join("; "));
  const items = plan.selectedCandidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    candidateName: candidate.candidateName,
    targetFields: candidate.selectedTargetFields,
    provider: guardrails.provider,
    status: "dry_run_completed",
    reviewItemGenerated: true,
    safetyNote: "Dry-run only. No candidate records were updated and no raw AI output was applied.",
  }));
  return {
    generatedAt: new Date().toISOString(),
    mode: "dry-run batch only; no candidate DB writes; no apply; no delete",
    provider: guardrails.provider,
    maxAiCalls: guardrails.maxAiCalls || 0,
    selectedCandidates: plan.selectedCandidates.length,
    completedCandidates: items.length,
    failedCandidates: 0,
    reviewItemsGenerated: items.length,
    items,
    guardrails,
  };
}

export function writeBatchDryRun(report: ReturnType<typeof buildBatchDryRun>, outputPath = path.join("reports", "ai-extraction-batch-dry-run.json")) {
  const fullPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`);
  return fullPath;
}

async function main() {
  const planPath = argValue("batchPlanPath", path.join("reports", "ai-extraction-batch-plan.json"));
  const provider = argValue("provider", "mock");
  const maxAiCalls = argValue("maxAiCalls") ? Number(argValue("maxAiCalls")) : undefined;
  if (provider === "openai") console.log(`Estimated OpenAI calls: ${maxAiCalls || "blocked until --maxAiCalls is provided"}`);
  const report = buildBatchDryRun(planPath, { provider, maxAiCalls, confirmOpenAi: process.argv.includes("--confirmOpenAi") });
  const outputPath = writeBatchDryRun(report);
  console.log("Mode: dry-run batch only; no candidate DB writes");
  console.log(`Provider: ${report.provider}`);
  console.log(`Max AI calls: ${report.maxAiCalls}`);
  console.log(`Selected candidates: ${report.selectedCandidates}`);
  console.log(`Completed candidates: ${report.completedCandidates}`);
  console.log(`Failed candidates: ${report.failedCandidates}`);
  console.log(`Review items generated: ${report.reviewItemsGenerated}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/runAiExtractionBatchDryRun.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}