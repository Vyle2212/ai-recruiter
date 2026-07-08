import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditFieldLevelExtractionQa, FieldLevelExtractionQaOptions } from "../lib/fieldLevelExtractionQa";

function argValue(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const hit = argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

export function parseFieldQaArgs(argv = process.argv): FieldLevelExtractionQaOptions {
  const limit = Number(argValue(argv, "limit") || 0);
  return {
    sampleMixed: argv.includes("--sampleMixed"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    useExistingRawText: argv.includes("--useExistingRawText") || true,
    noOpenAI: argv.includes("--noOpenAI") || true,
    onlyWorseThanExisting: argv.includes("--onlyWorseThanExisting"),
    onlyParserNeedsFix: argv.includes("--onlyParserNeedsFix"),
    onlyImprovedNotSearchReady: argv.includes("--onlyImprovedNotSearchReady"),
  };
}

function short(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

function top(counts: Record<string, number>, limit = 12) {
  return Object.entries(counts || {}).sort((a,b)=>b[1]-a[1]).slice(0, limit);
}

function addExamples(lines: string[], title: string, items: any[]) {
  lines.push("", title);
  if (!items.length) lines.push("- None");
  for (const item of items.slice(0, 30)) {
    lines.push(`- ${item.candidateId}: ${short(item.simulatedName || item.existingName)} | existing=${item.existingScore}/${item.existingSearchReady} | simulated=${item.simulatedScore}/${item.simulatedSearchReady} | title=${short(item.title)} | company=${short(item.currentEmployer)} | module=${short(item.primarySapModule)} | blockers=${short(JSON.stringify(item.blockers))} | action=${short(item.recommendedAction)}`);
  }
}

export function formatFieldLevelExtractionQa(report: ReturnType<typeof auditFieldLevelExtractionQa>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Field-Level Parser QA Fix Plan v1",
    "==================================================",
    "",
    "Mode: read-only audit/export only; no DB writes; no deletes; no apply; no OpenAI calls",
    `Options: ${JSON.stringify(report.options)}`,
    "",
    "Summary:",
    `Total checked: ${s.totalChecked}`,
    `Search-ready existing: ${s.searchReadyExisting}`,
    `Search-ready simulated: ${s.searchReadySimulated}`,
    `Blocked by identity: ${s.blockedByIdentity}`,
    `Blocked by title: ${s.blockedByTitle}`,
    `Blocked by employer: ${s.blockedByEmployer}`,
    `Blocked by SAP module: ${s.blockedBySapModule}`,
    `Blocked by contact: ${s.blockedByContact}`,
    `Blocked by raw text: ${s.blockedByRawText}`,
    `Worse than existing: ${s.worseThanExisting}`,
    `Improved but still not search-ready: ${s.improvedButStillNotSearchReady}`,
    `Safe to improve later: ${s.safeToImproveLater}`,
    `Requires AI: ${s.requiresAi}`,
    `Requires manual review: ${s.requiresManualReview}`,
    `Requires original file reupload: ${s.requiresOriginalFileReupload}`,
    "",
    "Parser Fix Priority",
  ];
  for (const [key, value] of top(report.distributions.parserFixPriority, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Identity Issue Breakdown");
  for (const [key, value] of top(report.distributions.identityIssues, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Title Issue Breakdown");
  for (const [key, value] of top(report.distributions.titleIssues, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Employer Issue Breakdown");
  for (const [key, value] of top(report.distributions.employerIssues, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "SAP Module Issue Breakdown");
  for (const [key, value] of top(report.distributions.sapModuleIssues, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Recommended Action Breakdown");
  for (const [key, value] of top(report.distributions.recommendedActions, 20)) lines.push(`- ${key}: ${value}`);
  addExamples(lines, "Top 30 identity false positives", report.examples.identityFalsePositives);
  addExamples(lines, "Top 30 title issues", report.examples.titleIssues);
  addExamples(lines, "Top 30 employer issues", report.examples.employerIssues);
  addExamples(lines, "Top 30 module mismatch", report.examples.moduleMismatch);
  addExamples(lines, "Top 30 worse-than-existing", report.examples.worseThanExisting);
  addExamples(lines, "Top 30 improved but still blocked", report.examples.improvedButStillBlocked);
  addExamples(lines, "Top 30 true reupload required", report.examples.trueReuploadRequired);
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditFieldLevelExtractionQa(candidates, parseFieldQaArgs());
  console.log(formatFieldLevelExtractionQa(report));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditFieldLevelExtractionQa.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
