import { buildRepairQueueAudit } from "../lib/repairQueueAudit";
import { planRepairBatches } from "../lib/repairQueueBatchPlanner";
import { writeWorkflowJson } from "../lib/recruiterWorkflowStore";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const batchSize = Number(argValue("batchSize", "25"));
  const focus = argValue("focus", "all");
  const audit = buildRepairQueueAudit();
  const plan = planRepairBatches(audit.items, { batchSize, focus });
  const outputPath = writeWorkflowJson("reports/repair-queue-batches.json", plan);
  console.log("Mode: repair batch planning only; no candidate DB writes");
  console.log(`Needs repair candidates: ${plan.needsRepairCandidates}`);
  console.log(`Selected batch size: ${plan.batchSize}`);
  console.log(`Batches generated: ${plan.batchesGenerated}`);
  console.log(`P1 quick fix batch count: ${plan.summary.p1QuickFixBatchCount}`);
  console.log(`P2 AI extraction batch count: ${plan.summary.p2AiExtractionBatchCount}`);
  console.log(`P3 manual review batch count: ${plan.summary.p3ManualReviewBatchCount}`);
  console.log(`P4 reupload batch count: ${plan.summary.p4ReuploadBatchCount}`);
  if (plan.warnings.length) console.log(`Warnings: ${plan.warnings.join("; ")}`);
  if (plan.errors.length) console.log(`Errors: ${plan.errors.join("; ")}`);
  console.log(`Output path: ${outputPath}`);
  if (plan.errors.length) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/planRepairBatches.ts")) {
  main().then(() => { if (!process.exitCode) process.exit(0); }).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
