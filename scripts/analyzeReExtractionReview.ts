import fs from "node:fs";
import path from "node:path";
import { analyzeReExtractionReviewReport, suspiciousFieldExamples } from "../lib/reExtractionReviewAnalysis";

export const REEXTRACTION_REVIEW_PATH = path.join("reports", "candidate-reextraction-review.json");

function loadReport(inputPath = path.join(process.cwd(), REEXTRACTION_REVIEW_PATH)) {
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

function printExamples(title: string, examples: Array<Record<string, any>>) {
  console.log("");
  console.log(title);
  if (!examples.length) {
    console.log("- None");
    return;
  }
  for (const example of examples.slice(0, 10)) {
    console.log(`- ${example.candidateId}: ${example.value} (${example.reason}) classification=${example.classification}`);
  }
}

export function formatReExtractionReviewAnalysis(report: any) {
  const analysis = analyzeReExtractionReviewReport(report);
  const { summary, items } = analysis;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Re-extraction Review Analysis v1",
    "==================================================",
    "",
    "Mode: read-only; no Supabase update/insert/delete",
    `Total items analyzed: ${summary.totalItemsAnalyzed}`,
    `Newly recoverable candidates: ${summary.newlyRecoverableCount}`,
    `Safe recovery candidates: ${summary.safeRecoveryCandidatesCount}`,
    `Needs parser refinement: ${summary.needsParserRefinementCount}`,
    `Needs manual review: ${summary.needsManualReviewCount}`,
    `Likely bad extraction: ${summary.likelyBadExtractionCount}`,
    `Still blocked identity: ${summary.stillBlockedIdentityCount}`,
    `Still blocked title: ${summary.stillBlockedTitleCount}`,
    `Still blocked status: ${summary.stillBlockedStatusCount}`,
    `Previous company recovered: ${summary.candidatesWithPreviousCompanyRecovered}`,
    `Expected salary recovered: ${summary.candidatesWithExpectedSalaryRecovered}`,
    `Strong SAP recovery but weak identity: ${summary.strongSapRecoveryWeakIdentityCount}`,
    `Current searchable with suspicious employer/title: ${summary.currentSearchableWithSuspiciousEmployerOrTitleCount}`,
    `Recommendation: ${summary.recommendation}`,
  ];
  const append = (title: string, examples: Array<Record<string, any>>) => {
    lines.push("", title);
    if (!examples.length) lines.push("- None");
    for (const example of examples.slice(0, 10)) lines.push(`- ${example.candidateId}: ${example.value} (${example.reason}) classification=${example.classification}`);
  };
  append("Top suspicious name examples", suspiciousFieldExamples(items, "displayName"));
  append("Top suspicious company examples", [...suspiciousFieldExamples(items, "currentCompany"), ...suspiciousFieldExamples(items, "previousCompany")]);
  append("Top suspicious title examples", suspiciousFieldExamples(items, "currentTitle"));
  lines.push("", "Top safe recovery examples");
  const safe = items.filter((item) => item.classification === "safe_recovery_candidate").slice(0, 10);
  if (!safe.length) lines.push("- None");
  for (const item of safe) lines.push(`- ${item.candidateId}: confidence=${item.confidence} name=${item.suggested.displayName || "empty"} title=${item.suggested.currentTitle || "empty"} company=${item.suggested.currentCompany || "empty"}`);
  return lines.join("\n");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/analyzeReExtractionReview.ts")) {
  try {
    console.log(formatReExtractionReviewAnalysis(loadReport()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}