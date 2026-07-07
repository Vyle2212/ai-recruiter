import fs from "node:fs";
import path from "node:path";
import { auditFullCandidateExtraction } from "../lib/fullCandidateExtractionEngine";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

export const FULL_CANDIDATE_EXTRACTION_PATH = path.join("reports", "full-candidate-extraction.json");

export function writeFullCandidateExtractionReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), FULL_CANDIDATE_EXTRACTION_PATH)) {
  const report = auditFullCandidateExtraction(candidates);
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    outputPath: FULL_CANDIDATE_EXTRACTION_PATH,
    summary: report.summary,
    distributions: report.distributions,
    items: report.items,
    searchReadyItems: report.searchReadyItems,
    parserRecoverableItems: report.parserRecoverableItems,
    manualReviewItems: report.manualReviewItems,
    likelyReuploadRequiredItems: report.likelyReuploadRequiredItems,
    suspiciousExamples: report.suspiciousExamples,
    safeApplyCandidates: report.safeApplyCandidates,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), FULL_CANDIDATE_EXTRACTION_PATH);
  const report = writeFullCandidateExtractionReport(candidates, outputPath);
  console.log(`Full candidate extraction report exported: ${outputPath}`);
  console.log(`Items exported: ${report.items.length}`);
  console.log(`Total candidates: ${report.summary.totalCandidates}`);
  console.log(`Raw CV available: ${report.summary.rawCvAvailable}`);
  console.log(`Successfully extracted: ${report.summary.successfullyExtracted}`);
  console.log(`Likely SAP profiles: ${report.summary.likelySapProfiles}`);
  console.log(`Search ready after extraction: ${report.summary.searchReadyAfterExtraction}`);
  console.log(`Parser recoverable: ${report.summary.parserRecoverable}`);
  console.log(`Manual review required: ${report.summary.manualReviewRequired}`);
  console.log(`Likely reupload required: ${report.summary.likelyReuploadRequired}`);
  console.log(`Mode: ${report.mode}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportFullCandidateExtraction.ts")) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}