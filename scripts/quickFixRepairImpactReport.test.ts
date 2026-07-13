import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildQuickFixRepairImpactReport } from "../lib/quickFixRepairImpactReport";
import { buildPersistedWorkflowStateFile, type PersistedWorkflowState } from "../lib/recruiterWorkflowPersistence";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "quick-fix-impact-"));
const now = "2026-07-13T00:00:00.000Z";

function writeJson(name: string, data: unknown) {
  const filePath = path.join(fixtureDir, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  return filePath;
}

function missingPath(name: string) {
  return path.join(fixtureDir, name);
}

function state(candidateId: string, currentStatus: "needs_repair" | "ready_for_shortlist", blockerReasons: string[] = ["missing current company"]): PersistedWorkflowState {
  return {
    candidateId,
    displayName: `Candidate ${candidateId}`,
    currentStatus,
    priority: currentStatus === "needs_repair" ? "high" : "low",
    recommendedNextAction: currentStatus === "needs_repair" ? "repair_missing_data" : "add_to_shortlist",
    allowedActions: [currentStatus === "needs_repair" ? "repair_missing_data" : "add_to_shortlist", "mark_rejected", "archive_candidate"],
    blockedActions: [],
    blockerReasons,
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
    auditNotes: blockerReasons,
  };
}

function buildReportFor(status: "verified_applied" | "pending_apply" | "mismatch", candidateId: string, workflowStatus: "needs_repair" | "ready_for_shortlist" = "needs_repair") {
  const subsetPath = writeJson(`${candidateId}-subset.json`, {
    subsetItems: [{ candidateId, candidateName: `Candidate ${candidateId}`, fieldName: "currentCompany", approvedValue: "Acme Consulting" }],
  });
  const statePath = writeJson(`${candidateId}-state.json`, buildPersistedWorkflowStateFile([state(candidateId, workflowStatus)], now));
  const resultPath = status === "pending_apply" ? missingPath(`${candidateId}-missing-result.json`) : writeJson(`${candidateId}-result.json`, { appliedCount: status === "verified_applied" ? 1 : 0 });
  const postAuditPath = status === "pending_apply" ? missingPath(`${candidateId}-missing-post-audit.json`) : writeJson(`${candidateId}-post-audit.json`, {
    items: [{ candidateId, fieldName: "currentCompany", finalDbValue: status === "verified_applied" ? "Acme Consulting" : "Different Company" }],
  });

  return buildQuickFixRepairImpactReport({
    statePath,
    verificationOptions: { subsetPath, resultPath, postAuditPath, backupPath: missingPath(`${candidateId}-backup.json`), rollbackPath: missingPath(`${candidateId}-rollback.json`) },
  });
}

const verified = buildReportFor("verified_applied", "verified");
assert.equal(verified.appliedVerified, 1, "verified apply counted");
assert.equal(verified.candidatesImproved, 1, "verified apply improves candidate");
assert.equal(verified.candidatesUnchanged, 0, "verified apply is not unchanged");
assert.equal(verified.movedOutOfNeedsRepair, 1, "verified apply can move candidate out of needs_repair");
assert.equal(verified.becameReadyForShortlist, 1, "verified apply can make candidate ready for shortlist");

const workflowImproved = buildReportFor("verified_applied", "workflow");
assert.equal(workflowImproved.items[0].workflowAfterPreview, "ready_for_shortlist", "workflow refresh improvement is visible");
assert.equal(workflowImproved.candidatesImproved, 1, "workflow refresh improvement counts improved");

const both = buildReportFor("verified_applied", "both");
assert.equal(both.appliedVerified, 1, "post-apply verified is counted when workflow also improves");
assert.equal(both.movedOutOfNeedsRepair, 1, "workflow movement is counted when both signals exist");
assert.equal(both.candidatesImproved, 1, "both signals count as one improved candidate");

const pending = buildReportFor("pending_apply", "pending");
assert.equal(pending.pendingApply, 1, "pending apply counted");
assert.equal(pending.candidatesImproved, 0, "pending apply does not improve candidate");
assert.equal(pending.candidatesUnchanged, 1, "pending apply remains unchanged");

const mismatch = buildReportFor("mismatch", "mismatch");
assert.equal(mismatch.mismatch, 1, "mismatch counted");
assert.equal(mismatch.candidatesImproved, 0, "mismatch does not improve candidate");
assert.equal(mismatch.candidatesUnchanged, 1, "mismatch remains unchanged");

const missingFiles = buildQuickFixRepairImpactReport({
  statePath: missingPath("missing-state.json"),
  verificationOptions: { subsetPath: missingPath("missing-subset.json"), resultPath: missingPath("missing-result.json"), postAuditPath: missingPath("missing-post-audit.json") },
});
assert.equal(missingFiles.subsetItems, 0, "missing files handled safely");
assert.equal(missingFiles.mode.includes("no candidate DB writes"), true, "repair impact is read-only");
assert.equal(missingFiles.mode.includes("no OpenAI calls"), true, "repair impact does not call OpenAI");

console.log("Quick fix repair impact report tests passed");
