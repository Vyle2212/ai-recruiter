import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildAiExtractionApplyPlan } from "../lib/aiExtractionApplyPlan";
import { parseBackgroundAiArgs } from "./auditBackgroundAiQueue";
import { loadCachedBackgroundAiResults } from "./exportAiExtractionReview";

export const AI_EXTRACTION_APPLY_PLAN_PATH = path.join("reports", "ai-extraction-apply-plan.json");

async function main() {
  const options = parseBackgroundAiArgs();
  const { candidates } = await loadRealTalentPoolCandidates();
  const cached = loadCachedBackgroundAiResults(options.aiResultsPath);
  const plan = buildAiExtractionApplyPlan(candidates, cached.results, { ...options, aiResultsPath: cached.path, aiResultsFileLoaded: cached.loaded } as any);
  const outputPath = path.join(process.cwd(), AI_EXTRACTION_APPLY_PLAN_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ exportedAt: new Date().toISOString(), outputPath: AI_EXTRACTION_APPLY_PLAN_PATH, ...plan }, null, 2));
  const s = plan.summary;
  console.log("Mode: dry-run only; no DB writes; no apply");
  console.log(`Total reviewed: ${s.totalReviewed}`);
  console.log(`Cached AI result file loaded: ${(plan as any).reviewSummary?.cachedAiResultFileLoaded ?? cached.loaded}`);
  console.log(`Cache path: ${(plan as any).reviewSummary?.cachePath ?? cached.path}`);
  console.log(`CandidateId matched: ${(plan as any).reviewSummary?.candidateIdMatched ?? 0}`);
  console.log(`Unmatched cached AI results: ${(plan as any).reviewSummary?.unmatchedCachedAiResults ?? 0}`);
  console.log(`Safe apply candidates: ${s.safeApplyCandidates}`);
  console.log(`Manual review candidates: ${s.manualReviewCandidates}`);
  console.log(`Rejected candidates: ${s.rejectedCandidates}`);
  console.log(`Keep existing candidates: ${s.keepExistingCandidates}`);
  console.log(`Reupload candidates: ${s.reuploadCandidates}`);
  console.log(`Fields that would be updated: ${s.fieldsThatWouldBeUpdated}`);
  console.log(`Fields that would not be updated: ${s.fieldsThatWouldNotBeUpdated}`);
  console.log(`Unsafe downgrade prevented: ${s.unsafeDowngradePrevented}`);
  console.log(`Existing valid data preserved: ${s.existingValidDataPreserved}`);
  console.log(`Apply plan exported: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiExtractionApplyPlan.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}