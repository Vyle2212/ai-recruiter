import { buildQuickFixApplyReviewBoard } from "../lib/quickFixApplyReviewBoard";
import { writeQuickFixApplyDecisions } from "../lib/quickFixApplyDecisionStore";

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}
function hasFlag(name: string) { return process.argv.includes(`--${name}`); }

async function main() {
  const board = buildQuickFixApplyReviewBoard();
  const result = writeQuickFixApplyDecisions({ board, decisionMode: argValue("decisionMode", "suggested") as any, writeDecisionFile: hasFlag("writeDecisionFile") });
  const decisions = result.file.decisions;
  console.log(hasFlag("writeDecisionFile") ? "Mode: decision file write only; no candidate DB writes" : "Mode: decision preview only; decision file not changed; no candidate DB writes");
  console.log(`Decisions written: ${hasFlag("writeDecisionFile") ? result.decisionsWritten : 0}`);
  console.log(`Approved for apply: ${decisions.filter((item) => item.decision === "approve_for_apply").length}`);
  console.log(`Held for review: ${decisions.filter((item) => item.decision === "hold_for_review").length}`);
  console.log(`Rejected from apply: ${decisions.filter((item) => item.decision === "reject_from_apply").length}`);
  console.log(`Keep existing: ${decisions.filter((item) => item.decision === "keep_existing").length}`);
  console.log(`Output path: ${result.outputPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/writeQuickFixApplyDecisions.ts")) {
  main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
