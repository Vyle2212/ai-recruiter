import assert from "node:assert/strict";
import { buildQuickFixApplyCandidate360 } from "../lib/quickFixApplyCandidate360";
const panel = buildQuickFixApplyCandidate360("missing-candidate");
assert.equal(panel.safetyNote.includes("not updated"), true, "Candidate360 apply review panel works");
console.log("Quick fix apply Candidate360 tests passed");
