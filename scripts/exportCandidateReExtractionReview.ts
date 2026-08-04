import fs from "node:fs";
import path from "node:path";
import { auditCandidateReExtraction } from "../lib/candidateReExtractionEngine";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

export const CANDIDATE_REEXTRACTION_REVIEW_PATH = path.join("reports", "candidate-reextraction-review.json");

export function writeCandidateReExtractionReview(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), CANDIDATE_REEXTRACTION_REVIEW_PATH)) {
  const report = auditCandidateReExtraction(candidates);
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    outputPath: CANDIDATE_REEXTRACTION_REVIEW_PATH,
    summary: report.summary,
    topMissingFieldsRecovered: report.topMissingFieldsRecovered,
    items: report.suggestions,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), CANDIDATE_REEXTRACTION_REVIEW_PATH);
  const report = writeCandidateReExtractionReview(candidates, outputPath);
  console.log(`Candidate re-extraction review exported: ${outputPath}`);
  console.log(`Items exported: ${report.items.length}`);
  console.log(`Total candidates: ${report.summary.totalCandidates}`);
  console.log(`Raw CV available: ${report.summary.rawCvAvailable}`);
  console.log(`Successfully re-extracted: ${report.summary.successfullyReExtracted}`);
  console.log(`Likely SAP recovered: ${report.summary.likelySapRecovered}`);
  console.log(`Currently searchable: ${report.summary.currentlySearchable}`);
  console.log(`Candidates that could become searchable after re-extraction: ${report.summary.candidatesThatCouldBecomeSearchableAfterReExtraction}`);
  console.log(`Newly recoverable, not currently searchable: ${report.summary.newlyRecoverableNotCurrentlySearchable}`);
  console.log(`Still blocked after re-extraction: ${report.summary.stillBlockedAfterReExtraction}`);
  console.log(`Potential searchable after re-extraction: ${report.summary.potentialSearchableAfterReExtraction}`);
  console.log(`Mode: ${report.mode}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportCandidateReExtractionReview.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}