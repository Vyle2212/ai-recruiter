import assert from "node:assert/strict";
import fs from "node:fs";
import { buildActionQueue, evaluateWorkflowAction } from "../lib/recruiterWorkflowActions";
import type { RecruiterWorkflowState } from "../lib/recruiterWorkflowTypes";

const state: RecruiterWorkflowState = { workflowId: "w1", candidateId: "c1", candidateName: "Jane Tan", status: "ready_for_shortlist", source: "inferred", reasons: ["ready"], missingData: [], validationBlockers: [], lastUpdated: new Date().toISOString() };
const candidate = { id: "c1", name: "Jane Tan", current_company: "Accenture", current_title: "SAP FICO Lead", primary_module: "FICO", raw_text: "SAP FICO implementation summary evidence" };
assert.equal(buildActionQueue([state]).length, 1, "action queue generation");
assert.equal(evaluateWorkflowAction(candidate, { ...state, status: "needs_validation", validationBlockers: ["invalid-name"] }, "submit_to_client").allowed, false, "blocked submit_to_client when validation missing");
assert.equal(evaluateWorkflowAction({ ...candidate, extraction_decision_action: "mustRepairBeforeSearch" }, { ...state, status: "needs_repair" }, "add_to_shortlist").allowed, false, "blocked shortlist when must repair before search");
assert.equal(evaluateWorkflowAction(candidate, state, "add_to_shortlist").allowed, true, "allowed ready_for_shortlist for validated searchable candidate");
assert.equal(evaluateWorkflowAction({ ...candidate, duplicate_status: "duplicate conflict unresolved" }, state, "submit_to_client").allowed, false, "duplicate conflict blocks submit");

const source = fs.readFileSync(new URL("../lib/recruiterWorkflowActions.ts", import.meta.url), "utf8");
assert.equal(/\.delete\(|\.update\(|\.insert\(|upsert\(/i.test(source), false, "no candidate DB writes and no delete");
assert.equal(/from ["']openai["']|new\s+OpenAI\b/i.test(source), false, "no OpenAI calls");

console.log("Recruiter workflow actions tests passed");
