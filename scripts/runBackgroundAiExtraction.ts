import fs from "node:fs";
import path from "node:path";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildBackgroundAiExtractionQueue } from "../lib/backgroundAiExtractionQueue";
import { candidateRawCvText } from "../lib/candidateReExtractionEngine";
import { extractAiCandidateProfile, fallbackAiExtractionProvider, getDefaultAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";
import { parseBackgroundAiArgs } from "./auditBackgroundAiQueue";

export const BG_AI_EXTRACTION_RESULTS_PATH = path.join("reports", "background-ai-extraction-results.json");

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const options = parseBackgroundAiArgs();
  const { candidates } = await loadRealTalentPoolCandidates();
  const queue = buildBackgroundAiExtractionQueue(candidates, options);
  const provider = options.provider === "openai" && options.noOpenAI === false ? getDefaultAiExtractionProvider({ providerMode: "openai", limit: options.maxAiCalls }) : fallbackAiExtractionProvider;
  const shouldCallOpenAi = options.provider === "openai" && options.noOpenAI === false;
  const selected = queue.queueItems.filter((item: any) => item.aiEligible).slice(0, options.maxAiCalls || queue.queueItems.length);
  const results = [];
  const candidateErrors: any[] = [];
  let nullFieldNormalizedCount = 0;
  for (const item of selected) {
    const candidate = candidates.find((row: any) => clean(row.id || row.candidate_id) === item.candidateId);
    if (!candidate) continue;
    const enrichedCandidate = {
      ...candidate,
      ai_prompt_context: [
        item.identityEvidenceBlock,
        `Parser extracted fields: ${JSON.stringify(item.parserExtractedFields).slice(0, 2500)}`,
        `Decision layer reasons: ${JSON.stringify(item.decisionLayerReasons)}`,
        `Raw CV text: ${candidateRawCvText(candidate).slice(0, 12000)}`,
      ].join("\n\n"),
    };
    try {
      const result = await extractAiCandidateProfile(enrichedCandidate, provider, { providerMode: provider.mode });
      nullFieldNormalizedCount += (result.reviewReasons || []).filter((reason: string) => /normalized_null_or_invalid_field/.test(reason)).length;
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "unknown_error");
      candidateErrors.push({ candidateId: item.candidateId, errorType: /json/i.test(message) ? "invalid_json" : "candidate_extraction_failed", errorMessage: message.slice(0, 300) });
    }
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: "dry-run background AI extraction; no DB writes; no apply",
    provider: provider.mode,
    openAiCallsEnabled: shouldCallOpenAi,
    queueSummary: queue.summary,
    results,
    failedCandidates: candidateErrors.length,
    candidateErrors,
    nullFieldNormalizedCount,
  };
  fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), BG_AI_EXTRACTION_RESULTS_PATH), JSON.stringify(payload, null, 2));
  console.log(`Mode: ${payload.mode}`);
  console.log(`Provider: ${provider.mode}`);
  console.log(`OpenAI calls enabled: ${shouldCallOpenAi}`);
  console.log(`Queue candidates: ${queue.summary.queueCandidates}`);
  console.log(`AI extraction results: ${results.length}`);
  console.log(`AI extraction failed candidates: ${candidateErrors.length}`);
  console.log(`Candidate errors: ${JSON.stringify(candidateErrors)}`);
  console.log(`Null field normalized count: ${nullFieldNormalizedCount}`);
  console.log(`Results exported: ${path.join(process.cwd(), BG_AI_EXTRACTION_RESULTS_PATH)}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/runBackgroundAiExtraction.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
