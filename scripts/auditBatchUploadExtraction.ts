import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditBatchUploadExtractionSimulation, BatchUploadSimulationOptions } from "../lib/batchUploadExtractionSimulator";

function argValue(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

export function parseBatchUploadExtractionArgs(argv = process.argv): BatchUploadSimulationOptions {
  const limit = Number(argValue("limit") || 0);
  return {
    sampleMixed: argv.includes("--sampleMixed"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    useExistingRawText: argv.includes("--useExistingRawText") || true,
    noOpenAI: argv.includes("--noOpenAI") || true,
    onlyBlockedIdentity: argv.includes("--onlyBlockedIdentity"),
    onlyParserRecoverable: argv.includes("--onlyParserRecoverable"),
  };
}

function short(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

export function formatBatchUploadExtractionAudit(report: ReturnType<typeof auditBatchUploadExtractionSimulation>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Batch Upload Extraction Simulation Audit v1",
    "==================================================",
    "",
    "Mode: simulation only; no DB writes; no deletes; no apply",
    "OpenAI calls: disabled",
    `Source: ${report.source}`,
    `Options: ${JSON.stringify(report.options)}`,
    "",
    "Summary:",
    `Total tested: ${s.totalTested}`,
    `Existing DB search-ready: ${s.existingDbSearchReady}`,
    `Simulated extraction search-ready: ${s.simulatedExtractionSearchReady}`,
    `Full name extracted: ${s.fullNameExtracted}`,
    `Email extracted: ${s.emailExtracted}`,
    `Phone extracted: ${s.phoneExtracted}`,
    `Title extracted: ${s.titleExtracted}`,
    `Current employer extracted: ${s.currentEmployerExtracted}`,
    `SAP module extracted: ${s.sapModuleExtracted}`,
    `Primary SAP module extracted: ${s.primarySapModuleExtracted}`,
    `Profiles improved by simulated extraction: ${s.profilesImprovedBySimulatedExtraction}`,
    `Profiles worse than existing DB: ${s.profilesWorseThanExistingDb}`,
    `Dirty employer rejected: ${s.dirtyEmployerRejected}`,
    `Dirty identity rejected: ${s.dirtyIdentityRejected}`,
    `Module conflict resolved: ${s.moduleConflictResolved}`,
    `Module conflict sent to AI: ${s.moduleConflictSentToAi}`,
    `Kept existing because simulated worse: ${s.keptExistingBecauseSimulatedWorse}`,
    `Safe to overwrite: ${s.safeToOverwrite}`,
    `Raw text missing header: ${s.rawTextMissingHeader}`,
    `OCR/garbled: ${s.ocrGarbled}`,
    `Parser needs fix: ${s.parserNeedsFix}`,
    `Reupload recommended: ${s.reuploadRecommended}`,
    `AI recommended: ${s.aiRecommended}`,
    `Manual review required: ${s.manualReviewRequired}`,
  ];
  const sections: Array<[string, any[]]> = [
    ["Top 30 improved examples", report.examples.improvedExamples],
    ["Top 30 failed extraction examples", report.examples.failedExtractionExamples],
    ["Top 30 likely reupload required", report.examples.likelyReuploadRequiredExamples],
    ["Top 30 parser needs fix", report.examples.parserNeedsFixExamples],
  ];
  for (const [title, items] of sections) {
    lines.push("", title);
    if (!items.length) lines.push("- None");
    for (const item of items.slice(0, 30)) {
      lines.push(`- ${item.candidateId}: ${short(item.simulatedName || item.existingName)} | existing=${item.existingScore}/${item.existingSearchReady} | simulated=${item.simulatedScore}/${item.simulatedSearchReady} | title=${short(item.title)} | company=${short(item.currentCompany)} | module=${short(item.primarySapModule)} | reason=${short(item.reason)}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const options = parseBatchUploadExtractionArgs();
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditBatchUploadExtractionSimulation(candidates, options);
  console.log(formatBatchUploadExtractionAudit(report));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditBatchUploadExtraction.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
