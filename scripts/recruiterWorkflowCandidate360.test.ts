import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCandidate360WorkflowPanel } from "../lib/recruiterWorkflowCandidate360";
import { buildActionQueue } from "../lib/recruiterWorkflowActions";
import { inferWorkflowStatus } from "../lib/recruiterWorkflowState";
import { writeRecruiterWorkflowStore } from "../lib/recruiterWorkflowStore";

const candidate = { id: "c1", name: "Jane Tan", current_company: "Accenture", current_title: "SAP FICO Lead", primary_module: "FICO", raw_text: "SAP FICO Accenture implementation evidence" };
const state = inferWorkflowStatus(candidate, { applyHistory: { items: [{ candidateId: "c1", status: "applied_verified" }] } });
const actionQueue = buildActionQueue([state]);
const panel = buildCandidate360WorkflowPanel(candidate, { actionQueue });
assert.equal(panel.candidateId, "c1", "Candidate360 action panel summary generation");
assert.equal(panel.recommendedNextActions.length > 0, true, "Candidate360 has recommended action");
assert.equal(panel.safetyNote.includes("does not update candidate records"), true, "Candidate360 safety note present");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-store-"));
assert.equal(fs.existsSync(path.join(tmp, "reports", "recruiter-workflow-state.json")), false, "local workflow state not written by default");
writeRecruiterWorkflowStore([state], tmp);
assert.equal(fs.existsSync(path.join(tmp, "reports", "recruiter-workflow-state.json")), true, "local workflow state write only when explicitly called");

console.log("Recruiter workflow Candidate360 tests passed");
