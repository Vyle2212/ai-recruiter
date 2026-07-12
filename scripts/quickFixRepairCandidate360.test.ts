import assert from "node:assert/strict";
import { buildQuickFixCandidate360Panel } from "../lib/quickFixRepairCandidate360";
const panel = buildQuickFixCandidate360Panel("missing-candidate", "missing-quick-fix-suggestions.json");
assert.equal(panel.candidateId, "missing-candidate", "Candidate360 quick fix panel summary works");
assert.equal(panel.safetyNote.includes("not updated"), true, "Candidate360 panel is safe/read-only");
console.log("Quick fix repair Candidate360 tests passed");
