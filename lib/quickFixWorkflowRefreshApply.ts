import fs from "node:fs";
import path from "node:path";
import { buildQuickFixPostApplyVerification } from "./quickFixPostApplyVerification";
import { buildQuickFixWorkflowRefreshPreview } from "./quickFixWorkflowRefreshPreview";
import { readPersistedWorkflowState, workflowStatePath } from "./recruiterWorkflowStateHydration";
import { buildPersistedWorkflowStateFile, type PersistedWorkflowState, ALL_ACTIONS } from "./recruiterWorkflowPersistence";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export type QuickFixWorkflowRefreshMode = "dry_run" | "confirmed_apply";
export type QuickFixWorkflowRefreshApplyOptions = {
  statePath?: string;
  verificationOptions?: Parameters<typeof buildQuickFixPostApplyVerification>[0];
  expectedVerifiedCount?: number;
  writeWorkflowState?: boolean;
  confirmWorkflowRefresh?: boolean;
  outputPath?: string;
  backupPath?: string;
  rollbackPath?: string;
  resultPath?: string;
};

type WorkflowUpdate = {
  candidateId: string;
  candidateName: string;
  fromStatus: string;
  toStatus: "ready_for_shortlist";
  previousAction: string;
  nextAction: "add_to_shortlist";
  reason: string;
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(filePath);
  fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2) + "\n");
  return path.resolve(filePath);
}

function stripRepairText(values: string[]) {
  return values.filter((value) => !/company|employer|currentCompany|current company|repair_missing_data/i.test(value));
}

function updateWorkflowState(state: PersistedWorkflowState, now: string): PersistedWorkflowState {
  const allowedActions = ["add_to_shortlist", "mark_rejected", "archive_candidate"] as const;
  const missingFields = state.missingFields.filter((field) => !/company|employer|currentCompany|current company/i.test(field));
  const blockerReasons = stripRepairText(state.blockerReasons);
  return {
    ...state,
    previousStatus: state.currentStatus,
    currentStatus: "ready_for_shortlist",
    priority: "low",
    recommendedNextAction: "add_to_shortlist",
    allowedActions: [...allowedActions],
    blockedActions: ALL_ACTIONS.filter((action) => !allowedActions.includes(action as any)),
    blockerReasons,
    missingFields,
    validationStatus: blockerReasons.length ? state.validationStatus : "validated_or_pending_review",
    profileQualityStatus: missingFields.length ? `Missing ${missingFields.join(", ")}` : "Profile quality usable",
    applyHistoryStatus: "quick_fix_verified_applied",
    readyForShortlist: true,
    clientSubmissionBlocked: false,
    lastUpdatedAt: now,
    auditNotes: Array.from(new Set([...(state.auditNotes || []), "Quick-fix company apply verified; workflow moved to ready for shortlist."])),
  };
}

export function buildQuickFixWorkflowRefreshApplyPreview(options: QuickFixWorkflowRefreshApplyOptions = {}) {
  const statePath = options.statePath || workflowStatePath();
  const verification = buildQuickFixPostApplyVerification(options.verificationOptions);
  const refresh = buildQuickFixWorkflowRefreshPreview({ statePath, verificationOptions: options.verificationOptions });
  const workflowFile = readPersistedWorkflowState(statePath);
  const states = workflowFile?.states || [];
  const statesById = new Map(states.map((state) => [state.candidateId, state]));
  const verifiedIds = new Set(verification.items.filter((item) => item.verificationStatus === "verified_applied").map((item) => item.candidateId));

  const eligible: WorkflowUpdate[] = [];
  const blocked: Array<{ candidateId: string; candidateName: string; reason: string }> = [];

  for (const item of refresh.items) {
    const state = statesById.get(item.candidateId);
    if (!verifiedIds.has(item.candidateId)) {
      blocked.push({ candidateId: item.candidateId, candidateName: item.candidateName, reason: "candidate is not verified in post-apply verification" });
      continue;
    }
    if (!state) {
      blocked.push({ candidateId: item.candidateId, candidateName: item.candidateName, reason: "candidate is missing from workflow state" });
      continue;
    }
    if (state.currentStatus !== "needs_repair") {
      blocked.push({ candidateId: item.candidateId, candidateName: item.candidateName, reason: `workflow status is ${state.currentStatus}, not needs_repair` });
      continue;
    }
    if (item.workflowAfterPreview !== "ready_for_shortlist") {
      blocked.push({ candidateId: item.candidateId, candidateName: item.candidateName, reason: "workflow refresh preview does not move candidate to ready_for_shortlist" });
      continue;
    }
    eligible.push({
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      fromStatus: state.currentStatus,
      toStatus: "ready_for_shortlist",
      previousAction: state.recommendedNextAction,
      nextAction: "add_to_shortlist",
      reason: "Post-apply verification succeeded and workflow refresh preview moves candidate out of needs_repair.",
    });
  }

  const expectedVerifiedCount = options.expectedVerifiedCount ?? 9;
  const gateReasons: string[] = [];
  if (verification.appliedVerified !== expectedVerifiedCount) gateReasons.push(`Applied verified must be ${expectedVerifiedCount}; found ${verification.appliedVerified}`);
  if (verification.pendingApply !== 0) gateReasons.push(`Pending apply must be 0; found ${verification.pendingApply}`);
  if (verification.mismatch !== 0) gateReasons.push(`Mismatch must be 0; found ${verification.mismatch}`);
  if (!workflowFile) gateReasons.push("workflow state file is missing or invalid");
  if (eligible.length !== verification.appliedVerified) gateReasons.push(`Verified candidates included in preview must equal applied verified count; preview eligible ${eligible.length}, applied verified ${verification.appliedVerified}`);

  return {
    generatedAt: new Date().toISOString(),
    executionMode: "dry_run" as QuickFixWorkflowRefreshMode,
    mode: "workflow refresh apply preview only; no workflow writes; no candidate DB writes; no delete; no OpenAI calls",
    workflowStatePath: statePath,
    candidatesAnalyzed: refresh.candidatesAnalyzed,
    expectedVerifiedCount,
    appliedVerified: verification.appliedVerified,
    pendingApply: verification.pendingApply,
    mismatch: verification.mismatch,
    eligibleWorkflowUpdates: eligible.length,
    blockedWorkflowUpdates: blocked.length,
    wouldMoveOutOfNeedsRepair: eligible.filter((item) => item.fromStatus === "needs_repair").length,
    wouldBecomeReadyForShortlist: eligible.filter((item) => item.toStatus === "ready_for_shortlist").length,
    backupRequired: true,
    rollbackReady: gateReasons.length === 0 && eligible.length > 0,
    canApply: gateReasons.length === 0 && eligible.length > 0 && blocked.length === 0,
    gateReasons,
    eligible,
    blocked,
  };
}

export function writeQuickFixWorkflowRefreshApplyPreview(report: ReturnType<typeof buildQuickFixWorkflowRefreshApplyPreview>, outputPath = path.join("reports", "quick-fix-workflow-refresh-apply-preview.json")) {
  return writeWorkflowJson(outputPath, report);
}

export function applyQuickFixWorkflowRefresh(options: QuickFixWorkflowRefreshApplyOptions = {}) {
  const writeWorkflowState = Boolean(options.writeWorkflowState);
  const confirmWorkflowRefresh = Boolean(options.confirmWorkflowRefresh);
  if (writeWorkflowState !== confirmWorkflowRefresh) {
    throw new Error(writeWorkflowState ? "--writeWorkflowState requires --confirmWorkflowRefresh" : "--confirmWorkflowRefresh requires --writeWorkflowState");
  }

  const preview = buildQuickFixWorkflowRefreshApplyPreview(options);
  if (!writeWorkflowState) return { ...preview, resultPath: writeQuickFixWorkflowRefreshApplyPreview(preview, options.outputPath) };
  if (!preview.canApply) throw new Error(`Workflow refresh apply blocked: ${preview.gateReasons.concat(preview.blocked.map((item) => item.reason)).join("; ")}`);

  const statePath = options.statePath || workflowStatePath();
  const workflowFile = readPersistedWorkflowState(statePath);
  if (!workflowFile) throw new Error("Workflow refresh apply blocked: workflow state file is missing or invalid");

  const now = new Date().toISOString();
  const eligibleIds = new Set(preview.eligible.map((item) => item.candidateId));
  const originalStates = workflowFile.states.filter((state) => eligibleIds.has(state.candidateId));
  const backupPath = options.backupPath || path.join("reports", "quick-fix-workflow-refresh-backup.json");
  const rollbackPath = options.rollbackPath || path.join("reports", "quick-fix-workflow-refresh-rollback.json");
  const resultPath = options.resultPath || path.join("reports", "quick-fix-workflow-refresh-apply-result.json");

  writeJson(backupPath, {
    generatedAt: now,
    mode: "workflow refresh backup only; no candidate DB writes",
    workflowStatePath: statePath,
    states: originalStates,
  });
  writeJson(rollbackPath, {
    generatedAt: now,
    mode: "workflow refresh rollback plan only; no rollback executed; no candidate DB writes",
    workflowStatePath: statePath,
    rollbackItems: originalStates.map((state) => ({ candidateId: state.candidateId, restoreState: state })),
  });

  const updatedStates = workflowFile.states.map((state) => eligibleIds.has(state.candidateId) ? updateWorkflowState(state, now) : state);
  const updatedFile = buildPersistedWorkflowStateFile(updatedStates, now);
  writeJson(statePath, updatedFile);

  const result = {
    generatedAt: now,
    executionMode: "confirmed_apply" as QuickFixWorkflowRefreshMode,
    mode: "confirmed quick fix workflow refresh; local workflow state updates only; no candidate DB writes; no delete; no OpenAI calls",
    appliedWorkflowUpdates: preview.eligibleWorkflowUpdates,
    movedOutOfNeedsRepair: preview.wouldMoveOutOfNeedsRepair,
    becameReadyForShortlist: preview.wouldBecomeReadyForShortlist,
    backupPath: path.resolve(backupPath),
    rollbackPath: path.resolve(rollbackPath),
    resultPath: path.resolve(resultPath),
    workflowStatePath: path.resolve(statePath),
    updates: preview.eligible,
  };
  writeJson(resultPath, result);
  return result;
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { found: false, data: null as any };
  try { return { found: true, data: JSON.parse(fs.readFileSync(fullPath, "utf8")) }; } catch { return { found: true, data: null as any }; }
}

export function auditQuickFixWorkflowRefreshApply(options: { statePath?: string; previewOptions?: QuickFixWorkflowRefreshApplyOptions; backupPath?: string; rollbackPath?: string; resultPath?: string } = {}) {
  const statePath = options.statePath || workflowStatePath();
  const preview = buildQuickFixWorkflowRefreshApplyPreview({ ...(options.previewOptions || {}), statePath });
  const workflowFile = readPersistedWorkflowState(statePath);
  const statesById = new Map((workflowFile?.states || []).map((state) => [state.candidateId, state]));
  const backupPath = options.backupPath || path.join("reports", "quick-fix-workflow-refresh-backup.json");
  const rollbackPath = options.rollbackPath || path.join("reports", "quick-fix-workflow-refresh-rollback.json");
  const resultPath = options.resultPath || path.join("reports", "quick-fix-workflow-refresh-apply-result.json");
  const backup = readJson(backupPath);
  const rollback = readJson(rollbackPath);
  const result = readJson(resultPath);
  const resultUpdates = Array.isArray(result.data?.updates) ? result.data.updates : preview.eligible;

  let verified = 0;
  let pending = 0;
  let mismatch = 0;
  for (const update of resultUpdates) {
    const state = statesById.get(update.candidateId);
    if (!state) { mismatch += 1; continue; }
    if (state.currentStatus === "ready_for_shortlist" && state.recommendedNextAction === "add_to_shortlist") verified += 1;
    else if (state.currentStatus === "needs_repair") pending += 1;
    else mismatch += 1;
  }

  const rollbackItems = Array.isArray(rollback.data?.rollbackItems) ? rollback.data.rollbackItems : [];
  const rollbackCoverage = resultUpdates.length > 0 && resultUpdates.every((update: any) => rollbackItems.some((item: any) => item.candidateId === update.candidateId));
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only workflow refresh apply audit; no workflow writes; no candidate DB writes; no delete; no OpenAI calls",
    expectedWorkflowUpdates: resultUpdates.length || preview.eligibleWorkflowUpdates,
    appliedWorkflowUpdatesVerified: verified,
    pendingWorkflowUpdates: pending,
    mismatch,
    backupAvailable: backup.found,
    rollbackAvailable: rollback.found,
    rollbackSafe: backup.found && rollback.found && rollbackCoverage,
    files: { statePath, backupPath, rollbackPath, resultPath },
  };
}

export function writeQuickFixWorkflowRefreshApplyAudit(report: ReturnType<typeof auditQuickFixWorkflowRefreshApply>, outputPath = path.join("reports", "quick-fix-workflow-refresh-apply-audit.json")) {
  return writeWorkflowJson(outputPath, report);
}

