import { buildQuickFixApplyReviewBoard } from "./quickFixApplyReviewBoard";

function clean(value: any) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function buildQuickFixApplyCandidate360(candidateId: string) {
  const board = buildQuickFixApplyReviewBoard();
  const items = board.items.filter((item) => clean(item.candidateId) === clean(candidateId));
  return {
    candidateId: clean(candidateId),
    items,
    approvedForApply: items.filter((item) => item.decision === "approve_for_apply").length,
    heldForReview: items.filter((item) => item.decision === "hold_for_review").length,
    rejectedFromApply: items.filter((item) => item.decision === "reject_from_apply").length,
    keepExisting: items.filter((item) => item.decision === "keep_existing").length,
    suggestedNextAction: items.length ? "Review quick-fix apply decision before real apply." : "No quick-fix apply review items for this candidate.",
    safetyNote: "APPLY REVIEW ONLY. Candidate records are not updated.",
  };
}
