import { auditCandidateReExtraction, type CandidateReExtractionSuggestion } from "../lib/candidateReExtractionEngine";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function topCounts(counts: Record<string, number>, limit = 12) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function shortValue(value: any) {
  const text = String(Array.isArray(value) ? value.join(", ") : value || "empty").replace(/\s+/g, " ").trim();
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function changedSummary(item: CandidateReExtractionSuggestion) {
  const parts = item.recoveredFields.slice(0, 8).map((field) => {
    const current = (item.current as Record<string, any>)[field] || "empty";
    const suggested = (item.suggested as Record<string, any>)[field] || "empty";
    return `${field}: "${shortValue(current)}" -> "${shortValue(suggested)}"`;
  });
  return parts.join("; ") || "no recovered fields";
}

export function formatCandidateReExtractionAudit(report: ReturnType<typeof auditCandidateReExtraction>) {
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "CV Re-ingestion & Re-extraction Audit v1.3",
    "==================================================",
    "",
    "Mode: read-only; no Supabase update/insert/delete",
    `Total candidates audited: ${report.totalCandidatesAudited}`,
    `Candidates with raw CV/resume text available: ${report.candidatesWithRawCvText}`,
    `Candidates successfully re-extracted: ${report.candidatesSuccessfullyReExtracted}`,
    `Likely SAP profiles recovered: ${report.likelySapProfilesRecovered}`,
    `Candidates that could become searchable after re-extraction: ${report.candidatesCouldBecomeSearchableAfterReExtraction}`,
    `Current searchable: ${report.currentSearchableCount}`,
    `Newly recoverable, not currently searchable: ${report.newlyRecoverableNotCurrentlySearchableCount}`,
    `Still blocked after re-extraction: ${report.stillBlockedAfterReExtractionCount}`,
    `Potential searchable after re-extraction: ${report.potentialSearchableCountAfterReExtraction}`,
    `Invalid company suggestions rejected: ${report.invalidCompanySuggestionsRejected}`,
    `Employer lines sanitized: ${report.employerLinesSanitizedCount}`,
    `Employer extracted from long line: ${report.employerExtractedFromLongLineCount}`,
    `Accepted employer count: ${report.acceptedEmployerCount}`,
    `Rejected employer count: ${report.rejectedEmployerCount}`,
    `Current company recovered: ${report.currentCompanyRecoveredCount}`,
    `Previous company recovered: ${report.previousCompanyRecoveredCount}`,
    `Previous company deduplicated: ${report.previousCompanyDeduplicatedCount}`,
    `Generic title avoided: ${report.genericTitleAvoidedCount}`,
    "",
    "Top Missing Fields Recovered",
  ];
  for (const [field, count] of topCounts(report.topMissingFieldsRecovered)) lines.push(`- ${field}: ${count}`);
  if (!Object.keys(report.topMissingFieldsRecovered).length) lines.push("- None");
  lines.push("", "Top Previous Company Examples");
  for (const item of report.topPreviousCompanyExamples.slice(0, 10)) lines.push(`- ${item.candidateId}: ${shortValue(item.previousCompany)} (${item.source}) evidence="${shortValue(item.evidence)}"`);
  if (!report.topPreviousCompanyExamples.length) lines.push("- None");
  lines.push("", "Top Newly Recoverable Examples");
  for (const item of report.topNewlyRecoverableExamples.slice(0, 10)) lines.push(`- ${item.candidateId}: currentSearchable=${item.currentSearchable} searchableAfter=${item.searchableAfter} newlyRecoverable=${item.newlyRecoverable} name="${shortValue(item.displayName)}" title="${shortValue(item.title)}" modules="${shortValue(item.modules)}"`);
  if (!report.topNewlyRecoverableExamples.length) lines.push("- None");
  lines.push("", "Top Still Blocked Examples");
  for (const item of report.topBlockedAfterReExtractionExamples.slice(0, 10)) lines.push(`- ${item.candidateId}: currentSearchable=${item.currentSearchable} searchableAfter=${item.searchableAfter} newlyRecoverable=${item.newlyRecoverable} reasons=${shortValue(item.whyBlockedAfterReExtraction)}`);
  if (!report.topBlockedAfterReExtractionExamples.length) lines.push("- None");
  lines.push("", "Top Sanitized Employer Examples");
  for (const item of report.topSanitizedEmployerExamples.slice(0, 10)) lines.push(`- ${item.candidateId}: "${shortValue(item.original)}" => "${shortValue(item.sanitized)}"`);
  if (!report.topSanitizedEmployerExamples.length) lines.push("- None");
  lines.push("", "Top Accepted Employer Examples");
  for (const item of report.topAcceptedCompanyExamples.slice(0, 10)) lines.push(`- ${item.candidateId}: ${shortValue(item.company)} (${item.source})`);
  if (!report.topAcceptedCompanyExamples.length) lines.push("- None");
  lines.push("", "Top 30 Re-extraction Examples");
  for (const item of report.suggestions.filter((suggestion) => suggestion.recoveredFields.length).slice(0, 30)) {
    lines.push(`- ${item.candidateId} | currentSearchable=${item.currentSearchable} | searchableAfter=${item.couldBecomeSearchableAfterReExtraction} | newlyRecoverable=${item.newlyRecoverable} | blocked=${shortValue(item.whyBlockedAfterReExtraction)} | ${changedSummary(item)}`);
  }
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  console.log(formatCandidateReExtractionAudit(auditCandidateReExtraction(candidates)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
