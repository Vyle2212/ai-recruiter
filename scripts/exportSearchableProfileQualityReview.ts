import fs from "node:fs";
import path from "node:path";
import { auditSearchableProfileQuality, type SearchableProfileQualityResult } from "../lib/searchableProfileQualityGate";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";

type AnyRecord = Record<string, any>;

export const SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH = path.join("reports", "searchable-profile-quality-review.json");

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function candidateId(candidate: AnyRecord) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

function contactSummary(candidate: AnyRecord) {
  const hasEmail = Boolean(clean(candidate.email || candidate.email_masked || candidate.contact_email));
  const hasPhone = Boolean(clean(candidate.phone || candidate.phone_masked || candidate.contact_phone));
  if (hasEmail && hasPhone) return "email and phone available";
  if (hasEmail) return "email available";
  if (hasPhone) return "phone available";
  return "no contact available";
}

export function profileHref(candidateIdValue: string) {
  return `/candidates/${encodeURIComponent(candidateIdValue)}?returnTo=${encodeURIComponent("/searchable-quality-review")}`;
}

export function toSearchableProfileQualityReviewItem(candidate: AnyRecord, result: SearchableProfileQualityResult) {
  return {
    candidateId: result.candidateId,
    name: result.searchableFields.name,
    title: result.searchableFields.title,
    company: result.searchableFields.company,
    modules: result.searchableFields.modules,
    location: result.searchableFields.location,
    contactSummary: contactSummary(candidate),
    score: result.score,
    status: result.status,
    reviewCategory: result.reviewCategory,
    reasons: result.reasons,
    missingFields: result.missingFields,
    riskFlags: result.riskFlags,
    recommendedAction: result.recommendedAction,
    profileHref: profileHref(result.candidateId),
  };
}

export function buildSearchableProfileQualityReview(candidates: AnyRecord[]) {
  const report = auditSearchableProfileQuality(candidates);
  const byId = new Map(candidates.map((candidate) => [candidateId(candidate), candidate]));
  const items = report.currentlySearchableShouldReview.map((result) => {
    const candidate = byId.get(result.candidateId) || {};
    return toSearchableProfileQualityReviewItem(candidate, result);
  });
  return {
    exportedAt: new Date().toISOString(),
    mode: "read-only",
    outputPath: SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH,
    summary: {
      totalCandidates: report.totalCandidates,
      currentRecruiterSearchable: report.currentRecruiterSearchable,
      searchReady: report.searchReady,
      searchableButNeedsEnrichment: report.searchableButNeedsEnrichment,
      mustRepairBeforeSearch: report.mustRepairBeforeSearch,
      blockedValidationQueue: report.blockedValidationQueueCategory,
      currentlySearchableShouldReview: report.currentlySearchableShouldReview.length,
      groupedBreakdown: report.groupedBreakdown,
    },
    items,
    totalItems: items.length,
  };
}

export function writeSearchableProfileQualityReview(candidates: AnyRecord[], outputPath = path.join(process.cwd(), SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH)) {
  const review = buildSearchableProfileQualityReview(candidates);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(review, null, 2));
  return { ...review, outputPath };
}

async function main() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const outputPath = path.join(process.cwd(), SEARCHABLE_PROFILE_QUALITY_REVIEW_PATH);
  const review = writeSearchableProfileQualityReview(candidates, outputPath);
  console.log(`Searchable profile quality review exported: ${outputPath}`);
  console.log(`Items exported: ${review.totalItems}`);
  console.log(`Current recruiter-searchable: ${review.summary.currentRecruiterSearchable}`);
  console.log(`Must repair before search: ${review.summary.mustRepairBeforeSearch}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/exportSearchableProfileQualityReview.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}