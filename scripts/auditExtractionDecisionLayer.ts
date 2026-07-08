import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildExtractionDecisionLayer, ExtractionDecisionOptions } from "../lib/extractionDecisionLayer";

function argValue(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const hit = argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

export function parseExtractionDecisionArgs(argv = process.argv): ExtractionDecisionOptions {
  const limit = Number(argValue(argv, "limit") || 0);
  return {
    sampleMixed: argv.includes("--sampleMixed"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    useExistingRawText: argv.includes("--useExistingRawText") || true,
    noOpenAI: argv.includes("--noOpenAI") || true,
  };
}

function short(value: any, length = 150) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function addExamples(lines: string[], title: string, items: any[]) {
  lines.push("", title);
  if (!items.length) lines.push("- None");
  for (const item of items.slice(0, 30)) {
    lines.push(`- ${item.candidateId}: ${short(item.simulatedName || item.existingName)} | action=${item.action} | existing=${item.existingScore}/${item.existingSearchReady} | simulated=${item.simulatedScore}/${item.simulatedSearchReady} | title=${short(item.title)} | company=${short(item.currentEmployer)} | module=${short(item.primarySapModule)} | reasons=${short(item.decisionReasons)}`);
  }
}

export function formatExtractionDecisionAudit(report: ReturnType<typeof buildExtractionDecisionLayer>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Extraction Decision Layer v1",
    "==================================================",
    "",
    "Mode: read-only audit/export only; no DB writes; no deletes; no apply; no OpenAI calls",
    `Options: ${JSON.stringify(report.options)}`,
    "",
    "Summary:",
    `Total checked: ${s.totalChecked}`,
    `Existing search-ready: ${s.existingSearchReady}`,
    `Simulated search-ready: ${s.simulatedSearchReady}`,
    `Decision-safe search-ready: ${s.decisionSafeSearchReady}`,
    `Keep existing record: ${s.keepExistingRecord}`,
    `Safe to overwrite later: ${s.safeToOverwriteLater}`,
    `Send to AI extraction queue: ${s.sendToAiExtractionQueue}`,
    `Requires manual review: ${s.requiresManualReview}`,
    `Requires original file reupload: ${s.requiresOriginalFileReupload}`,
    `Parser fix candidate: ${s.parserFixCandidate}`,
    `Unsafe downgrade prevented: ${s.unsafeDowngradePrevented}`,
    `Dirty field prevented: ${s.dirtyFieldPrevented}`,
    `Module conflict prevented: ${s.moduleConflictPrevented}`,
    `Employer noise prevented: ${s.employerNoisePrevented}`,
    `Fake identity prevented: ${s.fakeIdentityPrevented}`,
    "",
    "Decision Action Breakdown:",
  ];
  for (const [key, value] of Object.entries(report.distributions.decisionActions)) lines.push(`- ${key}: ${value}`);
  addExamples(lines, "Top 30 keep existing", report.examples.keepExisting);
  addExamples(lines, "Top 30 safe overwrite later", report.examples.safeOverwriteLater);
  addExamples(lines, "Top 30 send to AI", report.examples.sendToAi);
  addExamples(lines, "Top 30 manual review", report.examples.manualReview);
  addExamples(lines, "Top 30 reupload required", report.examples.reuploadRequired);
  addExamples(lines, "Top 30 parser fix candidates", report.examples.parserFixCandidates);
  addExamples(lines, "Top 30 unsafe downgrade prevented", report.examples.unsafeDowngradePrevented);
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = buildExtractionDecisionLayer(candidates, parseExtractionDecisionArgs());
  console.log(formatExtractionDecisionAudit(report));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditExtractionDecisionLayer.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
