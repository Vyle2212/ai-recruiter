import { buildExtractionDecisionLayer } from "./extractionDecisionLayer";
import { buildSelectiveAiExtractionQueue } from "./selectiveAiExtractionQueue";

export type ThreeTierRecoveryOptions = {
  /** A planning cap only. This module never invokes an AI provider. */
  aiReviewBudget?: number;
};

export type ThreeTierRecoveryPlan = {
  mode: "read-only";
  safety: {
    openAiCalls: 0;
    databaseWrites: 0;
    automaticBackfill: false;
  };
  tiers: {
    parserFix: { count: number; reasons: Record<string, number>; candidateIds: string[] };
    safeBackfillReview: { count: number; candidateIds: string[] };
    manualReview: { count: number; candidateIds: string[] };
    reupload: { count: number; candidateIds: string[] };
    aiReview: { budget: number; queued: number; deferred: number; candidateIds: string[] };
  };
};

function countBy(items: string[]) {
  const result: Record<string, number> = {};
  for (const item of items) if (item) result[item] = (result[item] || 0) + 1;
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
}

/**
 * A credit-aware operational plan. Tier 1 changes reusable parser rules,
 * tier 2 only proposes evidence-safe backfills, and tier 3 isolates human/
 * AI review. No action is applied here.
 */
export function buildThreeTierRecoveryPlan(
  candidates: Record<string, any>[],
  options: ThreeTierRecoveryOptions = {},
): ThreeTierRecoveryPlan {
  // Keep a small default reserve. The recruiter can opt in to a larger cap.
  const budget = Math.max(0, Math.floor(options.aiReviewBudget ?? 12));
  const decisions = buildExtractionDecisionLayer(candidates, {
    useExistingRawText: true,
    noOpenAI: true,
  });
  const selective = buildSelectiveAiExtractionQueue(candidates);
  const parserFix = decisions.items.filter(
    (item) => item.decisionAction === "parser_fix_candidate",
  );
  const safe = decisions.items.filter(
    (item) => item.decisionAction === "safe_to_overwrite_later",
  );
  const reupload = decisions.items.filter(
    (item) => item.decisionAction === "requires_original_file_reupload",
  );
  const manual = decisions.items.filter(
    (item) => item.decisionAction === "requires_manual_review",
  );
  const eligibleAi = selective.aiQueueItems.filter(
    (item) => !reupload.some((blocked) => blocked.candidateId === item.candidateId),
  );
  const queuedAi = eligibleAi.slice(0, budget);

  return {
    mode: "read-only",
    safety: { openAiCalls: 0, databaseWrites: 0, automaticBackfill: false },
    tiers: {
      parserFix: {
        count: parserFix.length,
        reasons: countBy(parserFix.flatMap((item) => item.recommendedParserFixes || [])),
        candidateIds: parserFix.map((item) => item.candidateId),
      },
      safeBackfillReview: {
        count: safe.length,
        candidateIds: safe.map((item) => item.candidateId),
      },
      manualReview: {
        count: manual.length,
        candidateIds: manual.map((item) => item.candidateId),
      },
      reupload: {
        count: reupload.length,
        candidateIds: reupload.map((item) => item.candidateId),
      },
      aiReview: {
        budget,
        queued: queuedAi.length,
        deferred: Math.max(0, eligibleAi.length - queuedAi.length),
        candidateIds: queuedAi.map((item) => item.candidateId),
      },
    },
  };
}
