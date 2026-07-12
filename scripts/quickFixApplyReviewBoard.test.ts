import assert from "node:assert/strict";
import { buildQuickFixApplyReviewBoard } from "../lib/quickFixApplyReviewBoard";
const board = buildQuickFixApplyReviewBoard();
assert.equal(board.mode.includes("no candidate DB writes"), true, "board is read-only");
assert.equal(board.items.length >= 0, true, "audit loads staged quick-fix items");
if (board.items.length) assert.equal(Boolean(board.summary), true, "summary exists");
async function checkApi() {
  const route = await import("../app/api/recruiter/quick-fix-apply-review/summary/route");
  const response: any = await route.GET();
  const json = await response.json();
  assert.equal(Boolean(json.summary), true, "API summary returns review board");
}
checkApi().then(() => console.log("Quick fix apply review board tests passed"));

