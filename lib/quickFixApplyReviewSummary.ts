import type { QuickFixApplyReviewItem, QuickFixApplyReviewSummary } from "./quickFixApplyReviewTypes";

export function summarizeQuickFixApplyReview(items: QuickFixApplyReviewItem[]): QuickFixApplyReviewSummary {
  const decision = (name: string) => items.filter((item) => item.decision === name).length;
  return {
    stagedItems: items.length,
    eligibleForApply: items.filter((item) => item.eligible).length,
    alreadyAppliedPreserved: items.filter((item) => item.preserved).length,
    needsRecruiterReview: items.filter((item) => item.reviewRecommendation === "hold_for_review").length,
    approvedForApply: decision("approve_for_apply"),
    heldForReview: decision("hold_for_review"),
    rejectedFromApply: decision("reject_from_apply"),
    keepExisting: decision("keep_existing"),
    suspiciousValues: items.filter((item) => item.suspicious).length,
    cleanCompanyFixes: items.filter((item) => item.cleanCompanyFix).length,
    applySubsetSize: decision("approve_for_apply"),
  };
}
