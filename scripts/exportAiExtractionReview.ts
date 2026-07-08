import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildAiExtractionReview } from "../lib/aiExtractionReviewFlow";
import { parseBackgroundAiArgs } from "./auditBackgroundAiQueue";
import { BG_AI_EXTRACTION_RESULTS_PATH } from "./runBackgroundAiExtraction";

export const AI_EXTRACTION_REVIEW_PATH = path.join("reports", "ai-extraction-review.json");

export function loadCachedBackgroundAiResults(aiResultsPath = BG_AI_EXTRACTION_RESULTS_PATH) {
  const file = path.isAbsolute(aiResultsPath) ? aiResultsPath : path.join(process.cwd(), aiResultsPath);
  if (!fs.existsSync(file)) return { results: [], loaded: false, path: file, readError: "" };
  try {
    return { results: JSON.parse(fs.readFileSync(file, "utf8"))?.results || [], loaded: true, path: file, readError: "" };
  } catch {
    return { results: [], loaded: false, path: file, readError: "read_failed" };
  }
}

export async function writeAiExtractionReviewReport(outputPath = path.join(process.cwd(), AI_EXTRACTION_REVIEW_PATH), options = parseBackgroundAiArgs()) {
  const { candidates } = await loadRealTalentPoolCandidates();
  const cached = loadCachedBackgroundAiResults(options.aiResultsPath);
  const report = buildAiExtractionReview(candidates, cached.results, { ...options, aiResultsPath: cached.path, aiResultsFileLoaded: cached.loaded } as any);
  const payload = { exportedAt: new Date().toISOString(), outputPath: AI_EXTRACTION_REVIEW_PATH, ...report };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const report = await writeAiExtractionReviewReport(path.join(process.cwd(), AI_EXTRACTION_REVIEW_PATH), parseBackgroundAiArgs());
  console.log(`AI extraction review exported: ${report.outputPath}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Total queued: ${report.summary.totalQueued}`);
  console.log(`AI extraction available: ${report.summary.aiExtractionAvailable}`);
  console.log(`AI extraction missing: ${report.summary.aiExtractionMissing}`);
  console.log(`CandidateId matched: ${report.summary.candidateIdMatched}`);
  console.log(`Unmatched cached AI results: ${report.summary.unmatchedCachedAiResults}`);
  console.log(`Cached AI result file loaded: ${report.summary.cachedAiResultFileLoaded}`);
  console.log(`Cache path: ${report.summary.cachePath}`);
  console.log(`Candidates with safe improvements: ${report.summary.candidatesWithSafeImprovements}`);
  console.log(`Candidates requiring manual review: ${report.summary.candidatesRequiringManualReview}`);
  console.log(`Candidates still blocked: ${report.summary.candidatesStillBlocked}`);
  console.log(`Fields safe to accept: ${report.summary.fieldsSafeToAccept}`);
  console.log(`Fields risky: ${report.summary.fieldsRisky}`);
  console.log(`Fields rejected: ${report.summary.fieldsRejected}`);
  console.log(`Search-ready before: ${report.summary.searchReadyBefore}`);
  console.log(`Search-ready after safe changes: ${report.summary.searchReadyAfterSafeChanges}`);
  console.log(`Search-ready after manual approvals: ${report.summary.searchReadyAfterManualApprovals}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportAiExtractionReview.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}