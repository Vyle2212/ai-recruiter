import fs from "node:fs";
import path from "node:path";
import { buildQuickFixApplyReviewBoard } from "./quickFixApplyReviewBoard";
import { loadQuickFixApplyDecisions } from "./quickFixApplyDecisionStore";
import type { QuickFixApplyDecision, QuickFixApplySubsetPreview } from "./quickFixApplyReviewTypes";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function buildQuickFixApplySubsetPreview(options: { decisionsPath?: string; outputPath?: string } = {}): QuickFixApplySubsetPreview {
  const board = buildQuickFixApplyReviewBoard();
  const decisionFile = options.decisionsPath ? loadQuickFixApplyDecisions(options.decisionsPath) : { mode: "suggested board decisions", updatedAt: "", decisions: [] as any[] };
  const decisionById = new Map(decisionFile.decisions.map((decision: any) => [clean(decision.stagingId || decision.decisionId), decision]));
  const subsetItems: any[] = [];
  const excludedItems: QuickFixApplySubsetPreview["excludedItems"] = [];
  const counts: Record<QuickFixApplyDecision, number> = { approve_for_apply: 0, hold_for_review: 0, reject_from_apply: 0, keep_existing: 0 };
  for (const item of board.items) {
    const decision = clean(decisionById.get(item.stagingId)?.decision || item.reviewRecommendation) as QuickFixApplyDecision;
    counts[decision] += 1;
    if (decision === "approve_for_apply") {
      subsetItems.push({ ...item.stagingItem, quickFixApplyReview: { decision, safetyReasons: item.safetyReasons, evidence: item.evidenceSnippet } });
    } else {
      excludedItems.push({ stagingId: item.stagingId, candidateId: item.candidateId, fieldName: item.fieldName, decision, reasons: item.safetyReasons });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: "apply subset preview only; no candidate DB writes; no staging writes; no real apply; no rollback; no delete; no OpenAI calls",
    reviewBoardItems: board.items.length,
    decisionsLoaded: decisionFile.decisions.length,
    approvedForApply: counts.approve_for_apply,
    heldForReview: counts.hold_for_review,
    rejected: counts.reject_from_apply,
    preservedExisting: counts.keep_existing,
    wouldIncludeInApplySubset: subsetItems.length,
    wouldExcludeFromApplySubset: excludedItems.length,
    subsetItems,
    excludedItems,
    outputPath: options.outputPath || path.join("reports", "quick-fix-apply-subset-preview.json"),
  };
}

export function writeQuickFixApplySubsetPreview(preview: QuickFixApplySubsetPreview) {
  return writeWorkflowJson(preview.outputPath || path.join("reports", "quick-fix-apply-subset-preview.json"), preview);
}

export function writeQuickFixApplySubset(preview: QuickFixApplySubsetPreview, outputPath = path.join("reports", "quick-fix-apply-subset.json")) {
  return writeWorkflowJson(outputPath, { ...preview, mode: "local apply subset only; no candidate DB writes; no real apply", subsetItems: preview.subsetItems });
}
