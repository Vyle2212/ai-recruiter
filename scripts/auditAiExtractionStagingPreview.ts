import fs from "node:fs";
import path from "node:path";
import type { AiExtractionApproval } from "../lib/aiExtractionApprovalStore";
import { buildAiExtractionStagingPreview } from "../lib/aiExtractionStagingPreview";
import { buildReviewWorkspace } from "../lib/aiExtractionReviewUi";

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

export function loadJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadStagingInputs() {
  const approvalsPath = argValue("approvalsPath", path.join("reports", "ai-extraction-approvals.json"));
  const applyPlanPath = argValue("applyPlanPath", path.join("reports", "ai-extraction-apply-plan.json"));
  const reviewPath = argValue("reviewPath", path.join("reports", "ai-extraction-review.json"));
  const approvalsFile = loadJson(path.resolve(approvalsPath));
  const applyPlan = loadJson(path.resolve(applyPlanPath));
  const review = loadJson(path.resolve(reviewPath));
  const approvals = Array.isArray(approvalsFile?.approvals) ? approvalsFile.approvals as AiExtractionApproval[] : [];
  const workspace = buildReviewWorkspace(review, applyPlan, null, { reviewReportFound: Boolean(review), applyPlanFound: Boolean(applyPlan), aiResultsFound: false });
  return { approvalsPath, applyPlanPath, reviewPath, approvals, applyPlan, workspace };
}

export function printStagingPreview(preview: ReturnType<typeof buildAiExtractionStagingPreview>, inputs: ReturnType<typeof loadStagingInputs>) {
  console.log("Mode: dry-run staging preview; no candidate DB writes");
  console.log(`Approvals loaded: ${inputs.approvals.length}`);
  console.log(`Apply plan loaded: ${Boolean(inputs.applyPlan)}`);
  console.log(`Valid staging items: ${preview.validStagingItems}`);
  console.log(`Rejected items: ${preview.rejectedStagingItems}`);
  console.log(`Blocked items: ${preview.rejectedStagingItems}`);
  console.log(`Manual override items: ${preview.manualReviewCount}`);
  console.log(`Candidate count: ${preview.candidateCount}`);
  console.log(`Field count: ${preview.fieldCount}`);
  console.log("Top 30 staged candidates:");
  preview.items.slice(0, 30).forEach((item) => console.log(`- ${item.candidateName || item.candidateId} | ${item.fieldName} | ${item.applyReadiness}`));
  console.log("Top 30 rejected staging items:");
  preview.rejectedItems.slice(0, 30).forEach((item) => console.log(`- ${item.candidateId} | ${item.fieldName} | ${item.validationReasons.join("; ")}`));
}

async function main() {
  const inputs = loadStagingInputs();
  const preview = buildAiExtractionStagingPreview(inputs.workspace, inputs.approvals);
  printStagingPreview(preview, inputs);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiExtractionStagingPreview.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
