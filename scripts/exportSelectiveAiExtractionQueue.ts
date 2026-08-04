import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { SELECTIVE_AI_EXTRACTION_QUEUE_PATH, writeSelectiveAiExtractionQueueReport } from "./auditSelectiveAiExtraction";

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), SELECTIVE_AI_EXTRACTION_QUEUE_PATH);
  const report = writeSelectiveAiExtractionQueueReport(candidates, outputPath);
  console.log("Selective AI extraction queue export written");
  console.log(`Output: ${SELECTIVE_AI_EXTRACTION_QUEUE_PATH}`);
  console.log(`Mode: ${report.mode}; no OpenAI calls; no Supabase update/insert/delete`);
  console.log(`Total candidates: ${report.summary.totalCandidates}`);
  console.log(`Parser search-ready after identity quality gate: ${report.summary.parserSearchReadyAfterIdentityQualityGate}`);
  console.log(`AI recommended candidates: ${report.summary.aiRecommendedCandidates}`);
  console.log(`Downgraded from parser-search-ready due to identity quality: ${report.summary.downgradedFromParserSearchReadyDueToIdentityQuality}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
