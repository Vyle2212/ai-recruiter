import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { buildParserFixPriorityPlan, ParserFixPriorityOptions } from "../lib/parserFixPriorityPlan";

function argValue(argv: string[], name: string) {
  const prefix = `--${name}=`;
  const hit = argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

export function parseParserFixPriorityArgs(argv = process.argv): ParserFixPriorityOptions {
  const limit = Number(argValue(argv, "limit") || 0);
  return {
    sampleMixed: argv.includes("--sampleMixed"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    useExistingRawText: argv.includes("--useExistingRawText") || true,
    noOpenAI: argv.includes("--noOpenAI") || true,
    onlyEmployerIssues: argv.includes("--onlyEmployerIssues"),
    onlyTitleIssues: argv.includes("--onlyTitleIssues"),
    onlyModuleIssues: argv.includes("--onlyModuleIssues"),
    onlyWorseThanExisting: argv.includes("--onlyWorseThanExisting"),
  };
}

function short(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function top(counts: Record<string, number>, limit = 12) {
  return Object.entries(counts || {}).sort((a,b)=>b[1]-a[1]).slice(0, limit);
}

function addExamples(lines: string[], title: string, items: any[]) {
  lines.push("", title);
  if (!items.length) lines.push("- None");
  for (const item of items.slice(0, 30)) {
    lines.push(`- ${item.candidateId}: ${short(item.simulatedName || item.existingName)} | existing=${item.existingScore}/${item.existingSearchReady} | simulated=${item.simulatedScore}/${item.simulatedSearchReady} | title=${short(item.title)} | employer=${short(item.currentEmployer)} | module=${short(item.primarySapModule)} | issues=${short(item.issues)} | action=${short(item.recommendedAction)}`);
  }
}

export function formatParserFixPriorityPlan(report: ReturnType<typeof buildParserFixPriorityPlan>) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Parser Fix Priority Plan v1",
    "==================================================",
    "",
    "Mode: read-only audit/export only; no DB writes; no deletes; no apply; no OpenAI calls",
    `Options: ${JSON.stringify(report.options)}`,
    "",
    `Total checked: ${s.totalChecked}`,
    `Existing search-ready: ${s.existingSearchReady}`,
    `Simulated search-ready: ${s.simulatedSearchReady}`,
    `Employer parser issues: ${s.employerParserIssues}`,
    `Title parser issues: ${s.titleParserIssues}`,
    `Module parser issues: ${s.moduleParserIssues}`,
    `Raw text ingestion issues: ${s.rawTextIngestionIssues}`,
    `Identity parser issues: ${s.identityParserIssues}`,
    `True reupload required: ${s.trueReuploadRequired}`,
    `Safe AI queue candidates: ${s.safeAiQueueCandidates}`,
    `Unsafe parser downgrade candidates: ${s.unsafeParserDowngradeCandidates}`,
    "",
    "Parser Fix Priority",
  ];
  for (const [key, value] of top(report.parserFixPriority, 20)) lines.push(`- ${key}: ${value}`);
  lines.push("", "Recommended Actions");
  for (const [key, value] of top(report.recommendedActions.all, 20)) lines.push(`- ${key}: ${value}`);

  addExamples(lines, "Employer parser: Not disclosed", report.examples.employer.notDisclosed);
  addExamples(lines, "Employer parser: location/date", report.examples.employer.locationOrDate);
  addExamples(lines, "Employer parser: client/project", report.examples.employer.clientProject);
  addExamples(lines, "Employer parser: role title", report.examples.employer.roleTitle);
  addExamples(lines, "Employer parser: low confidence", report.examples.employer.lowConfidence);

  addExamples(lines, "Title parser: empty", report.examples.title.empty);
  addExamples(lines, "Title parser: generic", report.examples.title.generic);
  addExamples(lines, "Title parser: not SAP relevant", report.examples.title.notSapRelevant);
  addExamples(lines, "Title parser: contains company", report.examples.title.containsCompany);
  addExamples(lines, "Title parser: contains client/project", report.examples.title.containsClientProject);

  addExamples(lines, "Module parser: missing primary module", report.examples.module.missingPrimaryModule);
  addExamples(lines, "Module parser: mismatch with title", report.examples.module.mismatchWithTitle);
  addExamples(lines, "Module parser: mismatch with evidence", report.examples.module.mismatchWithEvidence);
  addExamples(lines, "Module parser: UNKNOWN but SAP evidence exists", report.examples.module.unknownButSapEvidenceExists);

  addExamples(lines, "Raw text: missing header", report.examples.rawText.missingHeader);
  addExamples(lines, "Raw text: OCR/garbled", report.examples.rawText.ocrGarbled);
  addExamples(lines, "Raw text: unrelated document", report.examples.rawText.unrelatedDocument);
  addExamples(lines, "Raw text: true original file reupload required", report.examples.rawText.trueOriginalFileReuploadRequired);

  addExamples(lines, "Unsafe parser downgrade candidates", report.examples.unsafeParserDowngradeCandidates);
  addExamples(lines, "Safe AI queue candidates", report.examples.safeAiQueueCandidates);
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = buildParserFixPriorityPlan(candidates, parseParserFixPriorityArgs());
  console.log(formatParserFixPriorityPlan(report));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditParserFixPriority.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
