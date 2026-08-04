import assert from "node:assert/strict";
import { validatePersistedWorkflowState, validateWorkflowStateFile } from "../lib/recruiterWorkflowStateValidator";

const valid = { candidateId: "c1", displayName: "Jane", currentStatus: "ready_for_shortlist", recommendedNextAction: "add_to_shortlist", allowedActions: ["add_to_shortlist"], blockedActions: ["submit_to_client"], source: "workflow_inference", lastUpdatedAt: "2026-01-01T00:00:00.000Z" };
assert.deepEqual(validatePersistedWorkflowState(valid), [], "state schema validation");
assert.equal(validatePersistedWorkflowState({ ...valid, currentStatus: "bad" }).some((reason) => reason.includes("status")), true, "invalid status blocked");
assert.equal(validatePersistedWorkflowState({ ...valid, recommendedNextAction: "bad" }).some((reason) => reason.includes("action")), true, "invalid action blocked");
assert.equal(validatePersistedWorkflowState({ ...valid, candidateId: "" }).some((reason) => reason.includes("candidateId")), true, "missing candidateId blocked");
const result = validateWorkflowStateFile({ states: [valid, { ...valid, displayName: "Older", lastUpdatedAt: "2025-01-01T00:00:00.000Z" }, { ...valid, displayName: "Newer", lastUpdatedAt: "2026-02-01T00:00:00.000Z" }] });
assert.equal(result.duplicateCandidateIds.includes("c1"), true, "duplicate candidate state reported");
assert.equal(result.validStates[0].displayName, "Newer", "duplicate candidate state keeps newest lastUpdatedAt");
console.log("Recruiter workflow state validator tests passed");
