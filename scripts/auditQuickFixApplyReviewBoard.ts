import { buildQuickFixApplyReviewBoard, writeQuickFixApplyReviewBoard } from "../lib/quickFixApplyReviewBoard";

async function main() {
  const board = buildQuickFixApplyReviewBoard();
  const outputPath = writeQuickFixApplyReviewBoard(board);
  console.log("Mode: read-only apply review board; no candidate DB writes");
  console.log(`Staged items loaded: ${board.summary.stagedItems}`);
  console.log(`Eligible apply items: ${board.summary.eligibleForApply}`);
  console.log(`Already applied / preserved: ${board.summary.alreadyAppliedPreserved}`);
  console.log(`Suggested approve: ${board.summary.approvedForApply}`);
  console.log(`Suggested hold: ${board.summary.heldForReview}`);
  console.log(`Suggested reject: ${board.summary.rejectedFromApply}`);
  console.log(`Suspicious values: ${board.summary.suspiciousValues}`);
  console.log(`Output path: ${outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/auditQuickFixApplyReviewBoard.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
