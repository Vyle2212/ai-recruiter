import assert from "node:assert/strict";
import { classifyRepairCandidate } from "../lib/repairQueueClassifier";

function state(overrides: any = {}) {
  return { candidateId: "c1", displayName: "Jane", currentStatus: "needs_repair", priority: "medium", recommendedNextAction: "repair_missing_data", allowedActions: [], blockedActions: [], blockerReasons: [], missingFields: ["company"], validationStatus: "validated", profileQualityStatus: "Missing company", aiReviewStatus: "none", stagingStatus: "none", applyHistoryStatus: "none", readyForShortlist: false, clientSubmissionBlocked: true, lastInferredAt: "t", lastUpdatedAt: "t", source: "workflow_inference", auditNotes: ["Missing company"], ...overrides } as any;
}
const evidence = { raw_text: "SAP implementation at Acme with detailed employment history and project evidence from 2019 to 2024" };
assert.equal(classifyRepairCandidate(state(), evidence)?.repairCategory, "quick_fix_missing_company", "quick fix missing company classification");
assert.equal(classifyRepairCandidate(state({ missingFields: ["title"], auditNotes: ["Missing title"] }), evidence)?.repairCategory, "quick_fix_missing_title", "quick fix missing title classification");
assert.equal(classifyRepairCandidate(state({ missingFields: ["module"], auditNotes: ["Missing module"] }), evidence)?.repairCategory, "quick_fix_missing_module", "module quick fix classification");
assert.equal(classifyRepairCandidate(state({ missingFields: ["company", "title", "module"] }), evidence)?.repairCategory, "ai_extractable", "AI extractable classification");
assert.equal(classifyRepairCandidate(state({ auditNotes: ["conflicting evidence needs manual review"], missingFields: [] }), {})?.repairCategory, "manual_review_required", "manual review classification");
assert.equal(classifyRepairCandidate(state({ blockerReasons: ["duplicate conflict unresolved"] }), evidence)?.priority, "P0", "duplicate conflict classification");
assert.equal(classifyRepairCandidate(state({ blockerReasons: ["requires_original_file_reupload"] }), evidence)?.repairCategory, "requires_original_file_reupload", "original file reupload classification");
assert.equal(classifyRepairCandidate(state({ missingFields: ["company"] }), {})?.repairCategory, "low_evidence_profile", "low evidence classification");
assert.equal(classifyRepairCandidate(state({ missingFields: ["company", "title", "module", "location"] }), {})?.categories.includes("archive_candidate_review"), true, "archive review classification");
assert.equal(classifyRepairCandidate(state({ currentStatus: "ready_for_shortlist", missingFields: [] }), evidence), null, "ready_for_shortlist excluded");
assert.equal(classifyRepairCandidate(state({ currentStatus: "validated", missingFields: [] }), evidence, { items: [{ candidateId: "c1", status: "applied_verified" }] })?.repairCategory, "already_repaired_or_verified", "applied verified fields not treated as missing");
console.log("Repair queue classifier tests passed");
