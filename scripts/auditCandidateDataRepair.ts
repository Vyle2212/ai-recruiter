import { auditCandidateDataRepair, type CandidateDataRepairSuggestion } from "../lib/candidateDataRepair";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function evidenceParts(value: string) {
  const source = value.match(/source=([^;]+)/)?.[1] || "unknown";
  const evidence = value.match(/evidence=(.*)$/)?.[1] || value;
  return { source, evidence: evidence.replace(/;.*$/, "").slice(0, 120) };
}

function changedFields(suggestion: CandidateDataRepairSuggestion) {
  return Object.entries(suggestion.fields)
    .filter(([, field]) => field.suggested && field.suggested !== field.current)
    .map(([key, field]) => {
      const { source, evidence } = evidenceParts(field.evidence);
      return `${key}: "${field.current || "empty"}" -> "${field.suggested}" (${field.confidence}, source=${source}, evidence="${evidence}")`;
    })
    .join("; ") || "no confident field suggestion";
}

export function formatCandidateDataRepairAudit(report: ReturnType<typeof auditCandidateDataRepair>) {
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Candidate Data Repair Dry-run Audit v1",
    "==================================================",
    "",
    "Mode: read-only dry run; no Supabase update/insert/delete",
    `Total validation queue candidates: ${report.totalValidationQueueCandidates}`,
    `safe_to_apply_later: ${report.safeToApplyLater}`,
    `safe_to_apply_later with name repair: ${report.safeToApplyLaterWithNameRepair}`,
    `safe_to_apply_later without name repair: ${report.safeToApplyLaterWithoutNameRepair}`,
    `needs_recruiter_review: ${report.needsRecruiterReview}`,
    `needs_recruiter_review because name still invalid: ${report.needsRecruiterReviewNameStillInvalid}`,
    `insufficient_evidence: ${report.insufficientEvidence}`,
    `Suggested searchable after repair: ${report.suggestedSearchableAfterRepair}`,
    "",
    "Issue Breakdown",
  ];
  for (const [issue, count] of Object.entries(report.issueBreakdown).sort((a, b) => b[1] - a[1])) lines.push(`- ${issue}: ${count}`);
  lines.push("", "Top 20 Repair Suggestions");
  for (const suggestion of report.suggestions.slice(0, 20)) {
    lines.push(`- ${suggestion.candidateId} | ${suggestion.action} | overall=${suggestion.overallConfidence} | searchableAfterRepair=${suggestion.suggestedSearchableAfterRepair} | ${changedFields(suggestion)}`);
  }
  if (!report.suggestions.length) lines.push("- None");
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditCandidateDataRepair(candidates);
  console.log(formatCandidateDataRepairAudit(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
