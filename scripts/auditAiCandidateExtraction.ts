import { auditAiCandidateExtraction, fallbackAiExtractionProvider, getDefaultAiExtractionProvider } from "../lib/aiCandidateExtractionEngine";
import { filterAiExtractionCandidates, openAiProviderEnabled, parseAiExtractionArgs, requestedProviderMode } from "../lib/aiCandidateExtractionProvider";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function short(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function top(counts: Record<string, number>, limit = 15) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function formatAiCandidateExtractionAudit(report: Awaited<ReturnType<typeof auditAiCandidateExtraction>>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "AI-Assisted Candidate CV Extraction Audit v3",
    "==================================================",
    "",
    "Mode: read-only; no Supabase update/insert/delete",
    `AI provider mode: ${report.providerMode}`,
    `OpenAI provider enabled: ${report.openAiProviderEnabled}`,
    `Model: ${report.model}`,
    `Sample size: ${report.sampleSize}`,
    `Total candidates: ${s.totalCandidates}`,
    `Raw CV available: ${s.rawCvAvailable}`,
    `AI extraction attempted: ${s.aiExtractionAttempted}`,
    `AI extraction succeeded: ${s.aiExtractionSucceeded}`,
    `Fallback parser used: ${s.fallbackParserUsed}`,
    `OpenAI extraction used: ${s.openAiExtractionUsed}`,
    `OpenAI request attempted count: ${s.openAiRequestAttempted}`,
    `OpenAI request succeeded count: ${s.openAiRequestSucceeded}`,
    `Identity evidence block used count: ${s.identityEvidenceBlockUsedCount || 0}`,
    `OpenAI name recovered from identity evidence: ${s.openAiNameRecoveredFromIdentityEvidence || 0}`,
    `OpenAI still missing name despite evidence: ${s.openAiStillMissingNameDespiteEvidence || 0}`,
    `OpenAI request failed count: ${s.openAiRequestFailed}`,
    `Fallback-on-error count: ${s.fallbackOnError}`,
    `Cache hits: ${s.cacheHits}`,
    `Cache hits openai: ${s.cacheHitsOpenAi}`,
    `Cache hits fallback: ${s.cacheHitsFallback}`,
    `Valid full name extracted: ${s.validFullNameExtracted}`,
    `Valid email extracted: ${s.validEmailExtracted}`,
    `Valid phone extracted: ${s.validPhoneExtracted}`,
    `Valid title extracted: ${s.validTitleExtracted}`,
    `Valid current employer extracted: ${s.validCurrentEmployerExtracted}`,
    `Current employer tenure extracted: ${s.currentEmployerTenureExtracted || 0}`,
    `Valid previous employer extracted: ${s.validPreviousEmployerExtracted}`,
    `Previous employer tenure extracted: ${s.previousEmployerTenureExtracted || 0}`,
    `Total YOE extracted count: ${s.totalYoeExtracted || 0}`,
    `SAP YOE extracted count: ${s.sapYoeExtracted || 0}`,
    `SAP module extracted: ${s.sapModuleExtracted}`,
    `Primary module extracted: ${s.primaryModuleExtracted}`,
    `Salary extracted: ${s.salaryExtracted}`,
    `Notice period extracted: ${s.noticePeriodExtracted}`,
    `Search-ready after AI extraction: ${s.searchReadyAfterAiExtraction}`,
    `Parser recoverable: ${s.parserRecoverable}`,
    `Manual review required: ${s.manualReviewRequired}`,
    `Requires reupload: ${s.requiresReupload}`,
    `Rejected due to identity: ${s.rejectedDueToIdentity}`,
    `Rejected due to title: ${s.rejectedDueToTitle}`,
    `Rejected due to employer: ${s.rejectedDueToEmployer}`,
    `Rejected due to raw text quality: ${s.rejectedDueToRawTextQuality}`,
    "",
    "Current Parser Comparison",
    `Current parser search-ready: ${s.currentParserSearchReady}`,
    `Profiles recovered by AI that were blocked by current parser: ${s.profilesRecoveredByAiThatCurrentParserBlocked}`,
    `Profiles rejected by validator that current parser accepted: ${s.profilesRejectedByValidatorThatCurrentParserAccepted}`,
    `Name recovered: ${s.nameRecovered}`,
    `Title recovered: ${s.titleRecovered}`,
    `Employer recovered: ${s.employerRecovered}`,
    `Contact recovered: ${s.contactRecovered}`,
    `Location recovered: ${s.locationRecovered}`,
    `SAP module recovered: ${s.sapModuleRecovered}`,
    `Salary recovered: ${s.salaryRecovered}`,
    "",
  ];
  if (report.providerMode === "openai" && Number(s.openAiExtractionUsed || 0) === 0) lines.push("", "WARNING: OpenAI provider was enabled but no OpenAI calls were made.");
  lines.push("", "Provider Used Distribution");
  for (const [key, value] of top(report.distributions.providerUsed || {})) lines.push(`- ${key}: ${value}`);
  lines.push("", "Fallback Reason Distribution");
  for (const [key, value] of top(report.distributions.fallbackReason || {})) lines.push(`- ${key}: ${value}`);
  lines.push("", "OpenAI Error Type Distribution");
  for (const [key, value] of top(report.distributions.openAiErrorType || {})) lines.push(`- ${key}: ${value}`);
  lines.push("", "Review Classification Distribution");
  for (const [key, value] of top(report.distributions.reviewClassification)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Primary SAP Module Distribution");
  for (const [key, value] of top(report.distributions.primarySapModule, 20)) lines.push(`- ${key}: ${value}`);
  const sections: Array<[string, any[]]> = [
    ["Top 30 Search-ready Examples", report.examples.searchReady],
    ["Top 30 Rejected Identity Examples With Evidence", report.examples.rejectedIdentity],
    ["Top 30 Rejected Title Examples With Evidence", report.examples.rejectedTitle],
    ["Top 30 Rejected Employer Examples With Evidence", report.examples.rejectedEmployer],
    ["Top 30 Client/Project Separated From Employer", report.examples.clientProjectSeparated],
    ["Top 30 Current Parser Blocked But AI Recovered", report.examples.recoveredFromBlocked],
    ["Top 30 Requires Reupload", report.examples.requiresReupload],
  ];
  for (const [title, items] of sections) {
    lines.push("", title);
    if (!items.length) lines.push("- None");
    for (const item of items.slice(0, 30)) lines.push(`- ${item.candidateId}: ${short(item.name)} | ${short(item.title)} | ${short(item.primarySapModule)} | employer=${short(item.employer)} | reasons=${short(item.reviewReasons)} | evidence=${short(item.evidence?.name || item.evidence?.title || item.evidence?.employer)}`);
  }
  return lines.join("\n");
}

async function main() {
  const options = parseAiExtractionArgs();
  const providerMode = requestedProviderMode(options);
  const provider = getDefaultAiExtractionProvider(options);
  const { candidates } = await loadRealTalentPoolCandidates();
  const selected = filterAiExtractionCandidates(candidates, options, providerMode);
  if (openAiProviderEnabled(options) && !options.limit && !options.sampleSize && !options.candidateIds?.length) {
    console.log("OpenAI provider enabled; running sample only. Use AI_EXTRACTION_SAMPLE_SIZE or --limit to increase.");
  }
  console.log(formatAiCandidateExtractionAudit(await auditAiCandidateExtraction(selected, provider, options)));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditAiCandidateExtraction.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

