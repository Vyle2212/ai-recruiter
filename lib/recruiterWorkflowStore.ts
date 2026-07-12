import fs from "node:fs";
import path from "node:path";
import type { RecruiterWorkflowState } from "./recruiterWorkflowTypes";
import type { PersistedWorkflowStateFile } from "./recruiterWorkflowPersistence";
import { buildPersistedWorkflowStateFile } from "./recruiterWorkflowPersistence";
import { validateWorkflowStateFile } from "./recruiterWorkflowStateValidator";

export type RecruiterWorkflowStoreFile = {
  mode: string;
  updatedAt: string;
  states: RecruiterWorkflowState[];
};

export function recruiterWorkflowStatePath(baseDir = process.cwd()) {
  return path.join(baseDir, "reports", "recruiter-workflow-state.json");
}

export function emptyWorkflowStore(): RecruiterWorkflowStoreFile {
  return { mode: "local workflow state only; no candidate DB writes; no delete; no OpenAI calls", updatedAt: "", states: [] };
}

export function loadRecruiterWorkflowStore(baseDir = process.cwd()): RecruiterWorkflowStoreFile {
  const filePath = recruiterWorkflowStatePath(baseDir);
  if (!fs.existsSync(filePath)) return emptyWorkflowStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { ...emptyWorkflowStore(), ...parsed, states: Array.isArray(parsed?.states) ? parsed.states : [] };
  } catch {
    return emptyWorkflowStore();
  }
}

export function writeRecruiterWorkflowStore(states: RecruiterWorkflowState[], baseDir = process.cwd()) {
  const filePath = recruiterWorkflowStatePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const store = { ...emptyWorkflowStore(), updatedAt: new Date().toISOString(), states };
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  return { store, path: filePath };
}

export function writeWorkflowJson(filePath: string, data: unknown) {
  const fullPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
  return fullPath;
}


export function loadPersistedRecruiterWorkflowStore(baseDir = process.cwd()): PersistedWorkflowStateFile | null {
  const filePath = recruiterWorkflowStatePath(baseDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const validation = validateWorkflowStateFile(parsed);
    return { ...parsed, states: validation.validStates };
  } catch {
    return null;
  }
}

export function writePersistedRecruiterWorkflowStore(file: PersistedWorkflowStateFile, baseDir = process.cwd()) {
  const filePath = recruiterWorkflowStatePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n");
  return { store: file, path: filePath };
}

export function legacyStatesToPersisted(states: RecruiterWorkflowState[]) {
  return buildPersistedWorkflowStateFile(states.map((state) => ({
    candidateId: state.candidateId,
    displayName: state.candidateName,
    currentStatus: state.status,
    priority: "low" as const,
    recommendedNextAction: "validate_profile" as const,
    allowedActions: ["validate_profile", "mark_rejected", "archive_candidate"],
    blockedActions: [],
    blockerReasons: state.validationBlockers,
    missingFields: state.missingData,
    validationStatus: state.validationBlockers.length ? "blocked" : "validated_or_pending_review",
    profileQualityStatus: state.missingData.length ? "Missing " + state.missingData.join(", ") : "Profile quality usable",
    aiReviewStatus: state.status === "ai_review_needed" ? "ai_review_needed" : "no_ai_review_blocker",
    stagingStatus: "not_staged_by_workflow",
    applyHistoryStatus: "not_applied_by_workflow",
    readyForShortlist: state.status === "ready_for_shortlist",
    clientSubmissionBlocked: state.status !== "ready_for_shortlist",
    lastInferredAt: state.lastUpdated,
    lastUpdatedAt: state.lastUpdated,
    source: "workflow_inference" as const,
    auditNotes: state.reasons,
  })));
}
