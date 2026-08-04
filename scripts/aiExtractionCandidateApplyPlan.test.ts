import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCandidateApplyBackup } from "../lib/aiExtractionCandidateBackup";
import { buildCandidateApplyPostAudit, executeCandidateApplyPlan, writeCandidateApplyResult } from "../lib/aiExtractionCandidateApplyExecutor";
import { buildCandidateApplyPlan } from "../lib/aiExtractionCandidateApplyPlan";
import { buildCandidateRollbackPlan } from "../lib/aiExtractionCandidateRollback";
import type { AiExtractionStagingRecord } from "../lib/aiExtractionStagingPreview";
import { printCandidateApplyPlan } from "./auditCandidateApplyFromStaging";
import { candidateApplyModeFromFlags } from "./applyCandidateChangesFromStaging";

async function main() {
  const staged: AiExtractionStagingRecord = {
    stagingId: "s1",
    candidateId: "c1",
    candidateName: "Jane Fico",
    fieldName: "currentCompany",
    currentValue: "",
    approvedValue: "Accenture",
    parserValue: "Not disclosed",
    aiEvidence: "Accenture Jan 2024 - Present",
    aiConfidence: 96,
    approvalDecision: "approve_suggestion",
    reviewerNote: "",
    overrideReason: "",
    riskLevel: "safe",
    applyReadiness: "staged_safe",
    validationStatus: "valid",
    validationReasons: [],
    sourceApprovalId: "a1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stagedBy: "local-review",
    appliedToCandidate: false,
  };

  const plan = buildCandidateApplyPlan([staged, { ...staged, stagingId: "s2", fieldName: "unknownField" }], [{ id: "c1", current_company: "", current_title: "SAP FICO Consultant" }]);
  assert.equal(plan.stagedItemsLoaded, 2, "load staging file items into plan");
  assert.equal(plan.fieldsEligibleForApply, 1, "valid staged field creates apply candidate");
  assert.equal(plan.fieldsBlocked, 1, "unknown field mapping blocked");
  assert.equal(plan.eligibleItems[0].update.current_company, "Accenture", "only allowed mapped field is updated");
  assert.equal(plan.backupRequired, true, "backup required before apply");
  assert.equal(plan.rollbackReady, true, "rollback can be generated before apply");

  const dryRun = await executeCandidateApplyPlan(plan);
  assert.equal(dryRun.executionMode, "dry_run", "result JSON contains dry-run executionMode");
  assert.equal(dryRun.dryRun, true, "dry-run does not write DB");
  assert.equal(dryRun.appliedCount, 0, "dry-run applies nothing");
  assert.equal(dryRun.blockedCount, 1, "dry-run reports blocked count");

  await assert.rejects(
    () => executeCandidateApplyPlan(plan, { writeCandidateUpdates: true, confirmApply: true }),
    /backup file is required|rollback file is required|updateCandidate implementation is required/,
    "real apply requires writeCandidateUpdates, confirmApply, backup, rollback, and updater",
  );

  assert.equal(candidateApplyModeFromFlags(true, true), "confirmed_apply", "real apply mode is confirmed apply");
  assert.throws(() => candidateApplyModeFromFlags(true, false), /requires --confirmApply/, "missing confirmApply blocks writeCandidateUpdates");
  assert.throws(() => candidateApplyModeFromFlags(false, true), /requires --writeCandidateUpdates/, "missing writeCandidateUpdates blocks confirmApply");

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (message?: any) => { logs.push(String(message)); };
  try {
    printCandidateApplyPlan(plan, "Mode: CONFIRMED REAL APPLY; candidate DB field updates enabled");
  } finally {
    console.log = originalLog;
  }
  assert.equal(logs[0], "Mode: CONFIRMED REAL APPLY; candidate DB field updates enabled", "real apply mode prints confirmed apply");
  assert.equal(logs.some((line) => /dry-run only/.test(line)), false, "real apply mode does not print dry-run");

  const backup = buildCandidateApplyBackup(plan);
  const rollback = buildCandidateRollbackPlan(backup);
  let updated: Record<string, any> = {};
  const applied = await executeCandidateApplyPlan(plan, {
    writeCandidateUpdates: true,
    confirmApply: true,
    backup,
    rollback,
    backupPath: "reports/candidate-apply-backup.json",
    rollbackPath: "reports/candidate-apply-rollback.json",
    updateCandidate: async (_candidateId, update) => { updated = update; },
  });
  assert.equal(applied.executionMode, "confirmed_apply", "confirmed apply result has executionMode");
  assert.equal(applied.appliedCount, 1, "confirmed apply updates eligible fields");
  assert.deepEqual(updated, { current_company: "Accenture" }, "real apply only updates allowed field");

  const postAudit = buildCandidateApplyPostAudit(applied, [{ id: "c1", current_company: "Accenture" }]);
  assert.equal(postAudit.verifiedCount, 1, "post-apply audit verifies applied value");
  assert.equal(postAudit.mismatchCount, 0, "post-apply audit has no mismatch when value matches");
  assert.equal(postAudit.items[0].status, "verified_applied", "post-apply audit item is verified");

  const alreadyAppliedPlan = buildCandidateApplyPlan([staged], [{ id: "c1", current_company: "Accenture", current_title: "SAP FICO Consultant" }]);
  assert.equal(alreadyAppliedPlan.fieldsEligibleForApply, 0, "already-applied field is not eligible again");
  assert.equal(alreadyAppliedPlan.fieldsAlreadyAppliedPreserved, 1, "already-applied staged field is preserved");
  assert.equal(alreadyAppliedPlan.preservedItems[0].applyStatus, "preserved_already_applied", "already-applied field is classified as preserved_already_applied");
  assert.equal(alreadyAppliedPlan.conflictsDetected, 0, "already-applied field is not a conflict");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-apply-result-"));
  const resultPath = writeCandidateApplyResult(applied, path.join(tmp, "candidate-apply-result.json"));
  const resultJson = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  assert.equal(resultJson.executionMode, "confirmed_apply", "result JSON contains executionMode");

  const source = fs.readFileSync(new URL("../lib/aiExtractionCandidateApplyPlan.ts", import.meta.url), "utf8") +
    fs.readFileSync(new URL("../lib/aiExtractionCandidateApplyExecutor.ts", import.meta.url), "utf8") +
    fs.readFileSync(new URL("./applyCandidateChangesFromStaging.ts", import.meta.url), "utf8");
  assert.equal(/\.delete\(/i.test(source), false, "candidate apply must have no delete calls");
  assert.equal(/from ["']openai["']|new\s+OpenAI\b/.test(source), false, "candidate apply must not call OpenAI");

  console.log("AI extraction candidate apply plan tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});