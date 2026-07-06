import fs from "node:fs";
import path from "node:path";
import { analyzeReExtractionReviewReport, suspiciousFieldExamples } from "../lib/reExtractionReviewAnalysis";
import { REEXTRACTION_REVIEW_PATH } from "./analyzeReExtractionReview";

export const REEXTRACTION_ANALYSIS_PATH = path.join("reports", "reextraction-analysis.json");

export function writeReExtractionAnalysis(inputPath = path.join(process.cwd(), REEXTRACTION_REVIEW_PATH), outputPath = path.join(process.cwd(), REEXTRACTION_ANALYSIS_PATH)) {
  const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const analysis = analyzeReExtractionReviewReport(report);
  const items = analysis.items;
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    inputPath: REEXTRACTION_REVIEW_PATH,
    outputPath: REEXTRACTION_ANALYSIS_PATH,
    summary: analysis.summary,
    safeRecoveryCandidates: items.filter((item) => item.classification === "safe_recovery_candidate"),
    needsParserRefinement: items.filter((item) => item.classification === "needs_parser_refinement"),
    needsManualReview: items.filter((item) => item.classification === "needs_manual_review"),
    likelyBadExtraction: items.filter((item) => item.classification === "likely_bad_extraction"),
    stillBlockedCandidates: items.filter((item) => item.classification.startsWith("still_blocked")),
    suspiciousFieldExamples: {
      names: suspiciousFieldExamples(items, "displayName", 25),
      companies: [...suspiciousFieldExamples(items, "currentCompany", 25), ...suspiciousFieldExamples(items, "previousCompany", 25)],
      titles: suspiciousFieldExamples(items, "currentTitle", 25),
    },
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportReExtractionAnalysis.ts")) {
  try {
    const result = writeReExtractionAnalysis();
    console.log(`Re-extraction analysis exported: ${path.join(process.cwd(), REEXTRACTION_ANALYSIS_PATH)}`);
    console.log(`Total items analyzed: ${result.summary.totalItemsAnalyzed}`);
    console.log(`Safe recovery candidates: ${result.summary.safeRecoveryCandidatesCount}`);
    console.log(`Needs parser refinement: ${result.summary.needsParserRefinementCount}`);
    console.log(`Likely bad extraction: ${result.summary.likelyBadExtractionCount}`);
    console.log(`Recommendation: ${result.summary.recommendation}`);
    console.log(`Mode: ${result.mode}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}