import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { auditRawIdentityEvidence, parseRawIdentityEvidenceArgs, type RawIdentityEvidenceReport } from "../lib/rawIdentityEvidenceAudit";

const RAW_IDENTITY_REGRESSION_COVERAGE_COUNT = 20;

function short(value: any, limit = 140) {
  const text = String(Array.isArray(value) ? value.join(" | ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function formatExample(item: any, showSnippets = false) {
  const best = item.bestExtractedIdentityCandidate
    ? `${item.bestExtractedIdentityCandidate.possibleName} (${item.bestExtractedIdentityCandidate.source}, ${item.bestExtractedIdentityCandidate.confidence})`
    : "none";
  const lines = [
    `- ${item.candidateId}: ${item.diagnosticClassification} | rawTextLength=${item.rawTextLength} | existing=${short(item.existingDisplayName)} | parser=${short(item.currentParserName)}`,
    `  possibleNameLines: ${short(item.possiblePersonNameLinesFromTop50)}`,
    `  extractedIdentityCandidate: ${short(best)}`,
    `  contactLines: ${short(item.contactLines)}`,
  ];
  if (showSnippets) lines.push(`  first10Lines: ${short((item.first30RawTextLines || []).slice(0, 10), 260)}`);
  return lines.join("\n");
}

export function formatRawIdentityEvidenceAudit(report: RawIdentityEvidenceReport, showSnippets = false) {
  const s = report.summary;
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Raw CV Identity Evidence Diagnostic v1",
    "==================================================",
    "",
    "Mode: read-only; no OpenAI calls; no Supabase update/insert/delete",
    `Total checked: ${s.totalChecked}`,
    `Clear name evidence present: ${s.clearNameEvidencePresent}`,
    `Parser missed name: ${s.parserMissedName}`,
    `AI/provider missed name candidate: ${s.aiProviderMissedNameCandidate || 0}`,
    `Name evidence absent: ${s.nameEvidenceAbsent}`,
    `Raw text missing header: ${s.rawTextMissingHeader}`,
    `Raw text experience-only: ${s.rawTextExperienceOnly}`,
    `OCR/garbled: ${s.ocrGarbled}`,
    `Possible name needs review: ${s.possibleNameNeedsReview}`,
    `Only placeholder identity present: ${s.onlyPlaceholderIdentityPresent}`,
    `Not enough raw text: ${s.notEnoughRawText}`,
    `Reupload recommended: ${s.reuploadRecommended}`,
    `Reupload recommended after identity evidence correction: ${s.reuploadRecommendedAfterIdentityEvidenceCorrection || s.reuploadRecommended}`,
    `Reupload removed because name/contact evidence exists: ${s.reuploadRemovedBecauseNameEvidenceExists || 0}`,
    `Extracted identity candidates: ${s.extractedIdentityCandidates || 0}`,
    `False positive rejected count: ${s.falsePositiveRejectedCount || 0}`,
    `Still missed likely names: ${s.stillMissedLikelyNames || 0}`,
    `Candidate-id regression coverage count: ${RAW_IDENTITY_REGRESSION_COVERAGE_COUNT} (verified by npm run test)`,
    `Candidate-id regression pass/fail count: see npm run test`,
    "",
    "Top examples where reupload was removed because name/contact evidence exists",
  ];
  const removed = report.items.filter((item) => item.reuploadRecommendationRemovedByIdentityEvidence).slice(0, 30);
  if (!removed.length) lines.push("- None");
  for (const item of removed) lines.push(formatExample(item, showSnippets));

  lines.push("", "Top extracted identity candidates");
  const extracted = report.items.filter((item) => item.bestExtractedIdentityCandidate).slice(0, 30);
  if (!extracted.length) lines.push("- None");
  for (const item of extracted) lines.push(formatExample(item, showSnippets));

  lines.push("", "Top rejected false positives");
  const rejectedFalsePositives = report.items.filter((item) => item.extractedIdentityCandidates?.some((candidate: any) => candidate.rejectReason === "generic_title_or_job_description")).slice(0, 30);
  if (!rejectedFalsePositives.length) lines.push("- None");
  for (const item of rejectedFalsePositives) lines.push(formatExample(item, showSnippets));

  lines.push("", "Top still missed likely names");
  const stillMissed = report.items.filter((item) => !item.bestExtractedIdentityCandidate && item.possiblePersonNameLinesFromTop50?.length).slice(0, 30);
  if (!stillMissed.length) lines.push("- None");
  for (const item of stillMissed) lines.push(formatExample(item, showSnippets));

  lines.push("", "Top 30 Examples");
  if (!report.examples.length) lines.push("- None");
  for (const item of report.examples) lines.push(formatExample(item, showSnippets));
  return lines.join("\n");
}

async function main() {
  const options = parseRawIdentityEvidenceArgs();
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditRawIdentityEvidence(candidates, options);
  console.log(formatRawIdentityEvidenceAudit(report, Boolean(options.showSnippets)));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditRawIdentityEvidence.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}



