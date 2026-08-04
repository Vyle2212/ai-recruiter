import assert from "node:assert/strict";
import { canTransitionWorkflow } from "../lib/recruiterWorkflowRules";

assert.equal(canTransitionWorkflow("new_profile", "needs_validation").allowed, true, "new profile can move to validation");
assert.equal(canTransitionWorkflow("needs_validation", "validated").allowed, false, "invalid transition blocked");
assert.equal(canTransitionWorkflow("placed", "ready_for_shortlist").allowed, false, "placed cannot move backward without override");
assert.equal(canTransitionWorkflow("placed", "ready_for_shortlist", { override: true }).allowed, true, "placed override allowed");
assert.equal(canTransitionWorkflow("rejected", "validated").allowed, false, "rejected cannot move forward without reopen");
assert.equal(canTransitionWorkflow("archived", "validated").allowed, false, "archived cannot move forward without restore");

console.log("Recruiter workflow rules tests passed");
