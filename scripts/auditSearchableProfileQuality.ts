import { auditSearchableProfileQuality, type SearchableProfileQualityResult } from "../lib/searchableProfileQualityGate";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

function topCounts(counts: Record<string, number>, limit = 12) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function line(result: SearchableProfileQualityResult) {
  return `- ${result.candidateId} | ${result.reviewCategory} | ${result.status} | action=${result.recommendedAction} | score=${result.score} | name=${result.searchableFields.name || "empty"} | title=${result.searchableFields.title || "empty"} | company=${result.searchableFields.company || "empty"} | modules=${result.searchableFields.modules.join(",") || "empty"} | risks=${result.riskFlags.join(",") || "none"}`;
}

export function formatSearchableProfileQualityAudit(report: ReturnType<typeof auditSearchableProfileQuality>) {
  const lines = [
    "==================================================",
    "PRIMUS AI Recruiter",
    "Searchable Profile Quality Gate v2",
    "==================================================",
    "",
    `Total candidates audited: ${report.totalCandidates}`,
    `Current recruiter-searchable count: ${report.currentRecruiterSearchable}`,
    `searchable_high_quality count: ${report.searchableHighQuality}`,
    `searchable_needs_enrichment count: ${report.searchableNeedsEnrichment}`,
    `blocked_validation_queue count: ${report.blockedValidationQueue}`,
    `Profiles currently searchable but should be reviewed: ${report.currentlySearchableShouldReview.length}`,
    "",
    "Review Categories",
    `- search_ready: ${report.searchReady}`,
    `- searchable_but_needs_enrichment: ${report.searchableButNeedsEnrichment}`,
    `- must_repair_before_search: ${report.mustRepairBeforeSearch}`,
    `- blocked_validation_queue: ${report.blockedValidationQueueCategory}`,
    "",
    "Current Searchable Review Breakdown",
    `- current searchable but missing company: ${report.groupedBreakdown.currentSearchableMissingCompany}`,
    `- current searchable but missing location: ${report.groupedBreakdown.currentSearchableMissingLocation}`,
    `- current searchable but missing SAP module: ${report.groupedBreakdown.currentSearchableMissingSapModule}`,
    `- current searchable with invalid/long title: ${report.groupedBreakdown.currentSearchableInvalidOrLongTitle}`,
    `- current searchable with low profile quality: ${report.groupedBreakdown.currentSearchableLowProfileQuality}`,
    `- current searchable with incomplete keyword search fields: ${report.groupedBreakdown.currentSearchableIncompleteKeywordFields}`,
    "",
    "Top Missing Searchable Fields",
  ];
  for (const [field, count] of topCounts(report.missingFieldCounts)) lines.push(`- ${field}: ${count}`);
  if (!Object.keys(report.missingFieldCounts).length) lines.push("- None");
  lines.push("", "Top Risk Flags");
  for (const [flag, count] of topCounts(report.riskFlagCounts)) lines.push(`- ${flag}: ${count}`);
  if (!Object.keys(report.riskFlagCounts).length) lines.push("- None");
  lines.push("", "Sample High-Quality Searchable Profiles");
  for (const result of report.results.filter((item) => item.reviewCategory === "search_ready").slice(0, 10)) lines.push(line(result));
  lines.push("", "Sample Searchable Profiles Needing Enrichment");
  for (const result of report.currentlySearchableShouldReview.filter((item) => item.reviewCategory === "searchable_but_needs_enrichment").slice(0, 10)) lines.push(line(result));
  lines.push("", "Sample Must Repair Before Search");
  for (const result of report.currentlySearchableShouldReview.filter((item) => item.reviewCategory === "must_repair_before_search").slice(0, 10)) lines.push(line(result));
  lines.push("", "Sample Blocked Profiles");
  for (const result of report.results.filter((item) => item.reviewCategory === "blocked_validation_queue").slice(0, 10)) lines.push(line(result));
  return lines.join("\n");
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const report = auditSearchableProfileQuality(candidates);
  console.log(formatSearchableProfileQualityAudit(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});