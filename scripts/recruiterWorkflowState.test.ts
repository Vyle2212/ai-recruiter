import assert from "node:assert/strict";
import { inferWorkflowStatus } from "../lib/recruiterWorkflowState";

const validCandidate = { id: "c1", name: "Jane Tan", current_company: "Accenture", current_title: "SAP FICO Lead", primary_module: "FICO", raw_text: "Jane Tan SAP FICO Lead Accenture implementation 2019 2020 2021" };
assert.equal(inferWorkflowStatus({ id: "c2", name: "Profile Under Review", current_company: "Accenture", current_title: "SAP Lead" }).status, "needs_validation", "status inference from validation queue");
assert.equal(inferWorkflowStatus(validCandidate, { reviewReport: { fieldComparisons: [{ candidateId: "c1", manualReviewRequired: true, aiAvailable: true }] } }).status, "ai_review_needed", "status inference from AI review pending");
assert.equal(inferWorkflowStatus(validCandidate, { applyHistory: { items: [{ candidateId: "c1", status: "applied_verified" }] } }).status, "ready_for_shortlist", "status inference from apply history verified");
assert.equal(inferWorkflowStatus({ ...validCandidate, id: "c3", current_company: "", current_title: "" }).status, "needs_repair", "missing employer/title infers repair");
assert.equal(inferWorkflowStatus({ ...validCandidate, id: "c4", extraction_decision_action: "requires_original_file_reupload" }).status, "needs_repair", "requires reupload infers repair");

console.log("Recruiter workflow state tests passed");
