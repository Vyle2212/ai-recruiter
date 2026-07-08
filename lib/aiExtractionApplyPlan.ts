import { buildAiExtractionReview } from "./aiExtractionReviewFlow";
import type { ValidatedAiCandidateExtraction } from "./cvExtractionSchema";
import type { BackgroundAiQueueOptions } from "./backgroundAiExtractionQueue";

export type ApplyStatus = "safe_to_apply_later" | "manual_review_required" | "rejected" | "keep_existing" | "reupload_required";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value || "").replace(/\s+/g, " ").trim();
}

export function buildAiExtractionApplyPlan(candidates: Record<string, any>[], aiResults: ValidatedAiCandidateExtraction[] = [], options: BackgroundAiQueueOptions = {}) {
  const review = buildAiExtractionReview(candidates, aiResults, options);
  const items = review.fieldComparisons.map((item: any) => {
    const candidate = candidates.find((row: any) => clean(row.id || row.candidate_id) === item.candidateId) || {};
    const proposedUpdates = item.safeChanges.map((field: any) => ({
      field: field.field,
      from: field.existingValue,
      to: field.aiValue,
      evidence: field.evidence,
      confidence: field.confidence,
      reason: field.reason,
      riskLevel: "safe",
    }));
    let applyStatus: ApplyStatus = "keep_existing";
    if (!item.aiAvailable && item.missingEvidence.length) applyStatus = "keep_existing";
    if (item.rejectedChanges.length) applyStatus = "rejected";
    if (item.riskyChanges.length) applyStatus = "manual_review_required";
    if (item.safeApplyCandidate && proposedUpdates.length) applyStatus = "safe_to_apply_later";
    if (/reupload/i.test(clean(item.fieldComparisons?.map((field: any) => field.reason)))) applyStatus = "reupload_required";
    return {
      candidateId: item.candidateId,
      currentValues: {
        displayName: candidate.display_name || candidate.name || "",
        title: candidate.current_title || candidate.title || "",
        currentCompany: candidate.current_company || candidate.company || "",
        primarySapModule: candidate.primary_sap_module || candidate.primarySapModule || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
      },
      proposedValues: Object.fromEntries(proposedUpdates.map((field: any) => [field.field, field.to])),
      proposedFieldUpdates: proposedUpdates,
      fieldsNotUpdated: item.fieldComparisons.filter((field: any) => field.decision !== "safe_accept").map((field: any) => ({
        field: field.field,
        reason: field.reason,
        decision: field.decision,
      })),
      evidence: proposedUpdates.map((field: any) => ({ field: field.field, evidence: field.evidence })),
      confidence: proposedUpdates.length ? Math.round(proposedUpdates.reduce((sum: number, field: any) => sum + field.confidence, 0) / proposedUpdates.length) : 0,
      reason: item.safeApplyCandidate ? "only_safe_accept_fields_included" : item.manualReviewRequired ? "manual_review_required_before_apply" : item.stillBlocked ? "still_blocked_or_missing_evidence" : "keep_existing",
      riskLevel: item.safeApplyCandidate ? "safe" : item.manualReviewRequired ? "risky" : item.stillBlocked ? "blocked" : "none",
      applyStatus,
    };
  });
  const count = (predicate: (item: any) => boolean) => items.filter(predicate).length;
  const summary = {
    totalReviewed: items.length,
    safeApplyCandidates: count((item) => item.applyStatus === "safe_to_apply_later"),
    manualReviewCandidates: count((item) => item.applyStatus === "manual_review_required"),
    rejectedCandidates: count((item) => item.applyStatus === "rejected"),
    keepExistingCandidates: count((item) => item.applyStatus === "keep_existing"),
    reuploadCandidates: count((item) => item.applyStatus === "reupload_required"),
    fieldsThatWouldBeUpdated: items.reduce((sum, item) => sum + item.proposedFieldUpdates.length, 0),
    fieldsThatWouldNotBeUpdated: items.reduce((sum, item) => sum + item.fieldsNotUpdated.length, 0),
    unsafeDowngradePrevented: review.queueItems.filter((item: any) => /worse|dirty|conflict/i.test(clean(item.reasonForAiQueue))).length,
    existingValidDataPreserved: items.reduce((sum, item) => sum + item.fieldsNotUpdated.filter((field: any) => /keep_existing|existing|not_disclosed|missing|conflict|reject/i.test(clean(field.reason + " " + field.decision))).length, 0),
  };
  return {
    mode: "dry-run only; no DB writes; no apply",
    options: review.options,
    reviewSummary: review.summary,
    summary,
    items,
  };
}
