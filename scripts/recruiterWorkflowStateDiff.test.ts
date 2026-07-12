import assert from "node:assert/strict";
import { diffWorkflowStates } from "../lib/recruiterWorkflowStateDiff";

const base: any = { candidateId: "c1", displayName: "Jane", currentStatus: "validated", priority: "low", recommendedNextAction: "compare_candidate", allowedActions: [], blockedActions: [], blockerReasons: [], missingFields: [], validationStatus: "validated", profileQualityStatus: "ok", aiReviewStatus: "none", stagingStatus: "none", applyHistoryStatus: "none", readyForShortlist: false, clientSubmissionBlocked: true, lastInferredAt: "t", lastUpdatedAt: "t", source: "workflow_inference", auditNotes: [] };
const changed = { ...base, currentStatus: "ready_for_shortlist", readyForShortlist: true };
const added = { ...base, candidateId: "c2" };
const diff = diffWorkflowStates([base, { ...base, candidateId: "old" }], [changed, added]);
assert.equal(diff.newStates.length, 1, "diff detects new states");
assert.equal(diff.changedStates.length, 1, "diff detects changed states");
assert.equal(diff.removedOrMissingStates.length, 1, "diff detects removed/missing states");
assert.equal(diff.unchangedStates.length, 0, "diff detects unchanged states");
console.log("Recruiter workflow state diff tests passed");
