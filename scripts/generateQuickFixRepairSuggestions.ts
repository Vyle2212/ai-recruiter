import fs from "node:fs";
import path from "node:path";
import { generateQuickFixRepairSuggestions, writeQuickFixRepairSuggestions } from "../lib/quickFixRepairSuggestionEngine";
import { writeQuickFixRepairReview } from "../lib/quickFixRepairReview";
import type { QuickFixRepairPlan } from "../lib/quickFixRepairTypes";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function readPlan(filePath: string): QuickFixRepairPlan {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { generatedAt: new Date().toISOString(), mode: "missing quick fix plan; no candidate DB writes", batchSize: 25, batchIndex: 0, offset: 0, focus: "all", quickFixCandidates: 0, selectedCandidates: 0, selectedCandidateIds: [], excludedAlreadyAppliedCount: 0, excludedPreviouslyBlockedCount: 0, excludedExistingApprovalsCount: 0, skipPreviouslyBlocked: false, minSafeSuggestions: 0, estimatedSafeSuggestions: 0, targetFields: [], items: [], warnings: ["Plan file missing"], errors: [] };
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

async function main() {
  const plan = readPlan(argValue("planPath", "reports/quick-fix-repair-plan.json"));
  const file = generateQuickFixRepairSuggestions(plan);
  const outputPath = writeQuickFixRepairSuggestions(file);
  writeQuickFixRepairReview(file);
  console.log("Mode: quick fix suggestion generation only; no candidate DB writes");
  console.log(`Candidates processed: ${file.candidatesProcessed}`);
  console.log(`Suggestions generated: ${file.summary.suggestionsGenerated}`);
  console.log(`Safe suggestions: ${file.summary.safeSuggestions}`);
  console.log(`Manual review suggestions: ${file.summary.needsManualReview}`);
  console.log(`Blocked suggestions: ${file.summary.blockedSuggestions}`);
  console.log(`Missing evidence: ${file.summary.missingEvidence}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/generateQuickFixRepairSuggestions.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
