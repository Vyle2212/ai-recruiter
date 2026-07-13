import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyQuickFixWorkflowRefresh,
  auditQuickFixWorkflowRefreshApply,
  buildQuickFixWorkflowRefreshApplyPreview,
} from "../lib/quickFixWorkflowRefreshApply";
import { buildPersistedWorkflowStateFile, type PersistedWorkflowState } from "../lib/recruiterWorkflowPersistence";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "quick-fix-workflow-apply-"));
const now = "2026-07-13T00:00:00.000Z";

function writeJson(name: string, data: unknown) {
  const filePath = path.join(fixtureDir, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  return filePath;
}
function missingPath(name: string) { return path.join(fixtureDir, name); }

function state(candidateId: string): PersistedWorkflowState & { currentCompany?: string } {
  return {
    candidateId,
    displayName: `Candidate ${candidateId}`,
    currentStatus: "needs_repair",
    priority: "high",
    recommendedNextAction: "repair_missing_data",
    allowedActions: ["repair_missing_data", "mark_rejected", "archive_candidate"],
    blockedActions: ["add_to_shortlist", "submit_to_client"],
    blockerReasons: ["missing current company"],
    missingFields: ["currentCompany"],
    validationStatus: "blocked",
    profileQualityStatus: "Missing currentCompany",
    aiReviewStatus: "no_ai_review_blocker",
    stagingStatus: "not_staged_by_workflow",
    applyHistoryStatus: "not_applied_by_workflow",
    readyForShortlist: false,
    clientSubmissionBlocked: true,
    lastInferredAt: now,
    lastUpdatedAt: now,
    source: "workflow_inference",
    auditNotes: ["missing current company"],
    currentCompany: "Do not mutate profile value",
  };
}

function fixture(candidateIds: string[], options: { pending?: boolean; mismatch?: boolean; missingStateIds?: string[] } = {}) {
  const stateIds = candidateIds.filter((id) => !(options.missingStateIds || []).includes(id));
  const statePath = writeJson(`state-${Math.random()}.json`, buildPersistedWorkflowStateFile(stateIds.map(state), now));
  const subsetPath = writeJson(`subset-${Math.random()}.json`, { subsetItems: candidateIds.map((candidateId) => ({ candidateId, candidateName: `Candidate ${candidateId}`, fieldName: "currentCompany", approvedValue: "Acme Consulting" })) });
  const resultPath = options.pending ? missingPath(`missing-result-${Math.random()}.json`) : writeJson(`result-${Math.random()}.json`, { appliedCount: options.mismatch ? 0 : candidateIds.length });
  const postAuditPath = options.pending ? missingPath(`missing-post-${Math.random()}.json`) : writeJson(`post-${Math.random()}.json`, { items: candidateIds.map((candidateId) => ({ candidateId, fieldName: "currentCompany", finalDbValue: options.mismatch ? "Different Company" : "Acme Consulting" })) });
  return { statePath, verificationOptions: { subsetPath, resultPath, postAuditPath, backupPath: missingPath(`backup-${Math.random()}.json`), rollbackPath: missingPath(`rollback-${Math.random()}.json`) } };
}

const dry = fixture(["dry1", "dry2"]);
const dryPreviewPath = path.join(fixtureDir, "dry-preview.json");
const dryResult: any = applyQuickFixWorkflowRefresh({ ...dry, expectedVerifiedCount: 2, outputPath: dryPreviewPath });
assert.equal(dryResult.eligibleWorkflowUpdates, 2, "dry-run sees eligible workflow updates");
assert.equal(fs.existsSync(dryPreviewPath), true, "dry-run writes preview report only");
const dryState = JSON.parse(fs.readFileSync(dry.statePath, "utf8"));
assert.equal(dryState.states[0].currentStatus, "needs_repair", "dry-run does not write workflow state");

assert.throws(() => applyQuickFixWorkflowRefresh({ ...dry, expectedVerifiedCount: 2, writeWorkflowState: true }), /requires --confirmWorkflowRefresh/, "write requires confirm");
assert.throws(() => applyQuickFixWorkflowRefresh({ ...dry, expectedVerifiedCount: 2, confirmWorkflowRefresh: true }), /requires --writeWorkflowState/, "confirm requires write");

const pending = fixture(["pending1"], { pending: true });
const pendingPreview = buildQuickFixWorkflowRefreshApplyPreview({ ...pending, expectedVerifiedCount: 1 });
assert.equal(pendingPreview.canApply, false, "pending apply blocks workflow refresh");
assert.equal(pendingPreview.pendingApply, 1, "pending count retained");

const mismatch = fixture(["mismatch1"], { mismatch: true });
const mismatchPreview = buildQuickFixWorkflowRefreshApplyPreview({ ...mismatch, expectedVerifiedCount: 1 });
assert.equal(mismatchPreview.canApply, false, "mismatch blocks workflow refresh");
assert.equal(mismatchPreview.mismatch, 1, "mismatch count retained");

const missingPreviewCandidate = fixture(["present", "missing"], { missingStateIds: ["missing"] });
const missingPreview = buildQuickFixWorkflowRefreshApplyPreview({ ...missingPreviewCandidate, expectedVerifiedCount: 2 });
assert.equal(missingPreview.canApply, false, "candidate not included in preview blocks apply");
assert.equal(missingPreview.gateReasons.some((reason) => reason.includes("preview eligible 1, applied verified 2")), true, "missing preview candidate is reported");

const applyFixture = fixture(["apply1", "apply2"]);
const backupPath = path.join(fixtureDir, "workflow-backup.json");
const rollbackPath = path.join(fixtureDir, "workflow-rollback.json");
const resultPath = path.join(fixtureDir, "workflow-result.json");
const result: any = applyQuickFixWorkflowRefresh({ ...applyFixture, expectedVerifiedCount: 2, writeWorkflowState: true, confirmWorkflowRefresh: true, backupPath, rollbackPath, resultPath });
assert.equal(result.appliedWorkflowUpdates, 2, "confirmed local workflow apply updates eligible states");
assert.equal(fs.existsSync(backupPath), true, "backup generated before workflow state update");
assert.equal(fs.existsSync(rollbackPath), true, "rollback generated before workflow state update");
const appliedState = JSON.parse(fs.readFileSync(applyFixture.statePath, "utf8"));
assert.equal(appliedState.states[0].currentStatus, "ready_for_shortlist", "workflow status updated locally");
assert.equal(appliedState.states[0].recommendedNextAction, "add_to_shortlist", "action queue changes to add_to_shortlist");
assert.equal(appliedState.states[0].currentCompany, "Do not mutate profile value", "candidate profile-like data is preserved");
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const rollback = JSON.parse(fs.readFileSync(rollbackPath, "utf8"));
assert.equal(backup.states.length, 2, "backup covers updated states");
assert.equal(rollback.rollbackItems.length, 2, "rollback coverage is complete");
const audit = auditQuickFixWorkflowRefreshApply({ statePath: applyFixture.statePath, previewOptions: { ...applyFixture, expectedVerifiedCount: 2 }, backupPath, rollbackPath, resultPath });
assert.equal(audit.appliedWorkflowUpdatesVerified, 2, "audit verifies applied workflow updates");
assert.equal(audit.pendingWorkflowUpdates, 0, "audit reports no pending updates");
assert.equal(audit.mismatch, 0, "audit reports no mismatch");
assert.equal(audit.rollbackSafe, true, "audit verifies rollback safety");
assert.equal(audit.mode.includes("no candidate DB writes"), true, "no DB writes");
assert.equal(audit.mode.includes("no OpenAI calls"), true, "no OpenAI calls");
assert.equal(audit.mode.includes("no delete"), true, "no delete");

console.log("Quick fix workflow refresh apply tests passed");

