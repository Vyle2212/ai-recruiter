import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRecruiterWorkflowAudit, buildRecruiterWorkflowAuditPreferPersisted } from "../lib/recruiterWorkflowAudit";
import { buildPersistedWorkflowStateFile, type PersistedWorkflowState } from "../lib/recruiterWorkflowPersistence";

const candidates = [
  { id: "c1", name: "Jane Tan", current_company: "Accenture", current_title: "SAP FICO Lead", primary_module: "FICO", raw_text: "SAP FICO Accenture implementation 2019 2020 2021" },
  { id: "c2", name: "Profile Under Review", current_company: "", current_title: "" },
  { id: "c3", name: "Repair User", current_company: "", current_title: "SAP MM Consultant", extraction_decision_action: "mustRepairBeforeSearch" },
];
const legacyReport = buildRecruiterWorkflowAudit(candidates, { reviewPath: "missing-review.json", applyHistoryPath: "missing-history.json" });
assert.equal(legacyReport.totalCandidates, 3, "legacy audit includes all candidates");
assert.equal(legacyReport.summary.actionRequiredToday, legacyReport.actionQueue.length, "legacy audit summary counts statuses correctly");
assert.equal(legacyReport.actionQueue.some((item) => item.priority === "high"), true, "legacy high priority actions generated");
assert.equal(legacyReport.mode.includes("no candidate DB writes"), true, "legacy audit is read-only");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-audit-"));
const statePath = path.join(dir, "recruiter-workflow-state.json");
const now = "2026-07-13T00:00:00.000Z";

function state(candidateId: string, currentStatus: PersistedWorkflowState["currentStatus"]): PersistedWorkflowState {
  return {
    candidateId,
    displayName: `Candidate ${candidateId}`,
    currentStatus,
    priority: currentStatus === "needs_repair" ? "high" : "low",
    recommendedNextAction: currentStatus === "needs_repair" ? "repair_missing_data" : "add_to_shortlist",
    allowedActions: [currentStatus === "needs_repair" ? "repair_missing_data" : "add_to_shortlist", "mark_rejected", "archive_candidate"],
    blockedActions: [],
    blockerReasons: currentStatus === "needs_repair" ? ["missing current company"] : [],
    missingFields: currentStatus === "needs_repair" ? ["currentCompany"] : [],
    validationStatus: currentStatus === "needs_repair" ? "blocked" : "validated_or_pending_review",
    profileQualityStatus: currentStatus === "needs_repair" ? "Missing currentCompany" : "Profile quality usable",
    aiReviewStatus: "no_ai_review_blocker",
    stagingStatus: "not_staged_by_workflow",
    applyHistoryStatus: "not_applied_by_workflow",
    readyForShortlist: currentStatus === "ready_for_shortlist",
    clientSubmissionBlocked: currentStatus !== "ready_for_shortlist",
    lastInferredAt: now,
    lastUpdatedAt: now,
    source: "workflow_inference",
    auditNotes: [`Saved state ${currentStatus}`],
  };
}

const persistedFile = buildPersistedWorkflowStateFile([
  state("needs-1", "needs_repair"),
  state("needs-2", "needs_repair"),
  state("ready-1", "ready_for_shortlist"),
], now);
fs.writeFileSync(statePath, JSON.stringify(persistedFile, null, 2) + "\n");
const before = fs.readFileSync(statePath, "utf8");
const persistedReport = buildRecruiterWorkflowAuditPreferPersisted({ workflowStatePath: statePath, qualityPath: path.join(dir, "missing-quality.json"), fullExtractionPath: path.join(dir, "missing-full.json") });
const after = fs.readFileSync(statePath, "utf8");
assert.equal(persistedReport.auditSource, "persisted workflow state", "uses persisted workflow state when available");
assert.equal(persistedReport.generatedAt, now, "uses generatedAt from state file");
assert.equal(persistedReport.totalCandidates, 3, "persisted total candidates used");
assert.equal(persistedReport.summary.needsRepair, 2, "snake_case needs_repair maps to camelCase needsRepair");
assert.equal(persistedReport.summary.readyForShortlist, 1, "snake_case ready_for_shortlist maps to camelCase readyForShortlist");
assert.equal(persistedReport.actionQueue.length, 3, "action queue built from persisted states");
assert.equal(before, after, "audit does not write workflow state");
assert.equal(persistedReport.mode.includes("no workflow writes"), true, "persisted audit does not write workflow state");
assert.equal(persistedReport.mode.includes("no candidate DB writes"), true, "persisted audit does not write candidate data");

const missingReport = buildRecruiterWorkflowAuditPreferPersisted({ workflowStatePath: path.join(dir, "missing-state.json"), qualityPath: path.join(dir, "missing-quality.json"), fullExtractionPath: path.join(dir, "missing-full.json") });
assert.equal(missingReport.auditSource, "rebuilt from candidate data", "falls back when persisted state missing");
assert.equal(missingReport.files.workflowState.found, false, "missing state reported");

const invalidPath = path.join(dir, "invalid-state.json");
fs.writeFileSync(invalidPath, "{ invalid json");
const invalidReport = buildRecruiterWorkflowAuditPreferPersisted({ workflowStatePath: invalidPath, qualityPath: path.join(dir, "missing-quality.json"), fullExtractionPath: path.join(dir, "missing-full.json") });
assert.equal(invalidReport.auditSource, "rebuilt from candidate data", "falls back when persisted state invalid");
assert.equal(fs.readFileSync(invalidPath, "utf8"), "{ invalid json", "invalid state file is not mutated");

console.log("Recruiter workflow audit tests passed");
