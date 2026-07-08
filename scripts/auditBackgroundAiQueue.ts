import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildBackgroundAiExtractionQueue, BackgroundAiQueueOptions } from "../lib/backgroundAiExtractionQueue";

function argValue(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const hit = argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

export function parseBackgroundAiArgs(argv = process.argv): BackgroundAiQueueOptions {
  const limit = Number(argValue(argv, "limit") || 0);
  const maxAiCalls = Number(argValue(argv, "maxAiCalls") || 0);
  const provider = (argValue(argv, "provider") || "fallback") as BackgroundAiQueueOptions["provider"];
  return {
    sampleMixed: argv.includes("--sampleMixed"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    useExistingRawText: argv.includes("--useExistingRawText") || true,
    noOpenAI: argv.includes("--noOpenAI") || provider !== "openai",
    provider,
    onlyDecisionAction: argValue(argv, "onlyDecisionAction") || "send_to_ai_extraction_queue",
    candidateIds: argValue(argv, "candidateIds").split(",").map(v => v.trim()).filter(Boolean),
    aiResultsPath: argValue(argv, "aiResultsPath") || undefined,
    maxAiCalls: Number.isFinite(maxAiCalls) && maxAiCalls > 0 ? maxAiCalls : undefined,
    dryRun: !argv.includes("--dryRun") || argv.includes("--dryRun"),
    noApply: !argv.includes("--noApply") || argv.includes("--noApply"),
    exportOnly: argv.includes("--exportOnly"),
  };
}

function short(value: any, length = 150) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

export function formatBackgroundAiQueueAudit(report: ReturnType<typeof buildBackgroundAiExtractionQueue>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Background AI Extraction Queue v1",
    "==================================================",
    "",
    "Mode: read-only queue audit; no DB writes; no deletes; no apply; no OpenAI calls",
    `Options: ${JSON.stringify(report.options)}`,
    "",
    `Total candidates checked: ${s.totalCandidatesChecked}`,
    `Queue candidates: ${s.queueCandidates}`,
    `Excluded keep_existing_record: ${s.excludedKeepExistingRecord}`,
    `Excluded safe_to_overwrite_later: ${s.excludedSafeToOverwriteLater}`,
    `Excluded manual_review: ${s.excludedManualReview}`,
    `Excluded reupload_required: ${s.excludedReuploadRequired}`,
    `Raw text available: ${s.rawTextAvailable}`,
    `Raw text missing: ${s.rawTextMissing}`,
    `AI eligible: ${s.aiEligible}`,
    `AI not eligible: ${s.aiNotEligible}`,
    `Estimated AI calls: ${s.estimatedAiCalls}`,
    `Estimated cost USD: ${s.estimatedCostUsd}`,
    "",
    "Top queue examples",
  ];
  if (!report.queueItems.length) lines.push("- None");
  for (const item of report.queueItems.slice(0, 30)) {
    lines.push(`- ${item.candidateId}: ${short(item.existingName)} | existing=${item.existingScore} | simulated=${item.simulatedScore} | missing=${short(JSON.stringify(item.missingFields))} | conflicts=${short(item.conflicts)} | reason=${short(item.reasonForAiQueue)} | rawTextLength=${item.rawTextLength} | nameEvidence=${item.hasNameEvidence} | contactEvidence=${item.hasContactEvidence} | sapEvidence=${item.hasSapEvidence}`);
  }
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  console.log(formatBackgroundAiQueueAudit(buildBackgroundAiExtractionQueue(candidates, parseBackgroundAiArgs())));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditBackgroundAiQueue.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
