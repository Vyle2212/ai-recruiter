import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPersistedWorkflowStateFile } from "../lib/recruiterWorkflowPersistence";
import { hydrateCandidate360Workflow, hydrateRecruiterWorkflow } from "../lib/recruiterWorkflowStateHydration";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-hydrate-"));
const statePath = path.join(tmp, "state.json");
const state: any = { candidateId: "c1", displayName: "Jane", currentStatus: "ready_for_shortlist", priority: "high", recommendedNextAction: "add_to_shortlist", allowedActions: ["add_to_shortlist"], blockedActions: ["submit_to_client"], blockerReasons: [], missingFields: [], validationStatus: "validated", profileQualityStatus: "ok", aiReviewStatus: "none", stagingStatus: "none", applyHistoryStatus: "none", readyForShortlist: true, clientSubmissionBlocked: false, lastInferredAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-01T00:00:00.000Z", source: "workflow_inference", auditNotes: ["ready"] };
fs.writeFileSync(statePath, JSON.stringify(buildPersistedWorkflowStateFile([state]), null, 2));
const saved = hydrateRecruiterWorkflow({ statePath });
assert.equal(saved.stateSource, "saved workflow state", "dashboard hydration prefers saved state");
assert.equal(saved.actionQueue[0].candidateId, "c1", "saved state action queue hydrated");
const panel = hydrateCandidate360Workflow("c1", { statePath });
assert.equal(panel?.stateSource, "saved workflow state", "Candidate360 hydration prefers saved state");
const fallback = hydrateRecruiterWorkflow({ statePath: path.join(tmp, "missing.json") });
assert.equal(fallback.stateSource, "live inference", "fallback to live inference if state missing");
console.log("Recruiter workflow state hydration tests passed");
