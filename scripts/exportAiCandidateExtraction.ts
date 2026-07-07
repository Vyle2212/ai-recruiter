import fs from "node:fs";
import path from "node:path";
import { auditAiCandidateExtraction, getDefaultAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";
import { filterAiExtractionCandidates, parseAiExtractionArgs, requestedProviderMode } from "../lib/aiCandidateExtractionProvider";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

export const AI_CANDIDATE_EXTRACTION_PATH = path.join("reports", "ai-candidate-extraction.json");

export async function writeAiCandidateExtractionReport(candidates: Record<string, any>[], outputPath = path.join(process.cwd(), AI_CANDIDATE_EXTRACTION_PATH), options = parseAiExtractionArgs()) {
  const providerMode = requestedProviderMode(options);
  const selected = filterAiExtractionCandidates(candidates, options, providerMode);
  const report = await auditAiCandidateExtraction(selected, getDefaultAiExtractionProvider(options), options);
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    outputPath: AI_CANDIDATE_EXTRACTION_PATH,
    providerMode: report.providerMode,
    model: report.model,
    sampleSize: report.sampleSize,
    summary: report.summary,
    distributions: report.distributions,
    items: report.items,
    searchReadyItems: report.searchReadyItems,
    parserRecoverableItems: report.parserRecoverableItems,
    manualReviewItems: report.manualReviewItems,
    requiresReuploadItems: report.requiresReuploadItems,
    fallbackComparison: { currentParserSearchReady: report.summary.currentParserSearchReady, profilesRecoveredByAiThatCurrentParserBlocked: report.summary.profilesRecoveredByAiThatCurrentParserBlocked, profilesRejectedByValidatorThatCurrentParserAccepted: report.summary.profilesRejectedByValidatorThatCurrentParserAccepted },
    openAiRecoveredItems: report.recoveredFromBlockedItems,
    validatorRejectedItems: report.rejectedItems,
    recoveredFromBlockedItems: report.recoveredFromBlockedItems,
    rejectedItems: report.rejectedItems,
    safeApplyCandidates: report.safeApplyCandidates,
    requiresReviewItems: [...report.parserRecoverableItems, ...report.manualReviewItems],
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  return { ...payload, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), AI_CANDIDATE_EXTRACTION_PATH);
  const report = await writeAiCandidateExtractionReport(candidates, outputPath, parseAiExtractionArgs());
  console.log(`AI candidate extraction report exported: ${outputPath}`);
  console.log(`Items exported: ${report.items.length}`);
  console.log(`Search-ready after AI extraction: ${report.summary.searchReadyAfterAiExtraction}`);
  console.log(`Parser recoverable: ${report.summary.parserRecoverable}`);
  console.log(`Manual review required: ${report.summary.manualReviewRequired}`);
  console.log(`Requires reupload: ${report.summary.requiresReupload}`);
  console.log(`Provider mode: ${report.providerMode}`);
  console.log(`Model: ${report.model}`);
  console.log(`Sample size: ${report.sampleSize}`);
  console.log(`Mode: ${report.mode}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportAiCandidateExtraction.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
