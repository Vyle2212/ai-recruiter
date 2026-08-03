import fs from "node:fs";
import path from "node:path";
import { buildRecruiterWorkflowAuditFromReports } from "./recruiterWorkflowAudit";
import { buildCandidateLifecycleRecord } from "./candidateLifecycle";
import { buildActionQueue } from "./recruiterWorkflowActions";
import { buildPersistedWorkflowStateFile, buildPersistedWorkflowStates, type PersistedWorkflowState, type PersistedWorkflowStateFile } from "./recruiterWorkflowPersistence";
import { validateWorkflowStateFile } from "./recruiterWorkflowStateValidator";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

export type WorkflowHydration = {
  stateSource: "saved workflow state" | "live inference";
  generatedAt: string;
  lastUpdatedAt: string;
  summary: any;
  states: PersistedWorkflowState[];
  actionQueue: any[];
  files: Record<string, { path: string; found: boolean }>;
};

export function workflowStatePath(baseDir = process.cwd()) {
  return path.join(baseDir, "reports", "recruiter-workflow-state.json");
}

export function readPersistedWorkflowState(filePath = workflowStatePath()): PersistedWorkflowStateFile | null {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const validation = validateWorkflowStateFile(parsed);
    return { ...parsed, states: validation.validStates };
  } catch {
    return null;
  }
}


function lifecycleFromPersistedState(
  state: PersistedWorkflowState,
) {
  return buildCandidateLifecycleRecord(
    {
      id: state.candidateId,
      name: state.displayName,
      status: state.currentStatus,
      updated_at: state.lastUpdatedAt,
    },
    {
      currentStatus: state.currentStatus,
      priority: state.priority,
      nextActionNote:
        state.auditNotes[0] ||
        "Review workflow state",
      lastUpdated: state.lastUpdatedAt,
      missingFields: state.missingFields,
    },
  );
}

function enrichActionQueueWithLifecycle(
  actionQueue: any[],
  states: PersistedWorkflowState[],
) {
  const stateByCandidateId = new Map(
    states.map((state) => [
      state.candidateId,
      state,
    ]),
  );

  return actionQueue.map((item) => {
    const state = stateByCandidateId.get(
      item.candidateId,
    );

    return {
      ...item,
      lifecycle: state
        ? lifecycleFromPersistedState(state)
        : null,
    };
  });
}
function actionQueueFromPersisted(states: PersistedWorkflowState[]) {
  return states.filter((state) => !["placed", "rejected", "archived"].includes(state.currentStatus)).map((state) => ({
    actionId: `${state.candidateId}:${state.recommendedNextAction}`,
    candidateId: state.candidateId,
    candidateName: state.displayName,
    currentStatus: state.currentStatus,
    recommendedNextAction: state.recommendedNextAction,
    reason: state.auditNotes[0] || "Review workflow state",
    priority: state.priority,
    missingData: state.missingFields,
    lastUpdated: state.lastUpdatedAt,
    safetyNote: "Saved workflow state only. Candidate records are not updated.",
  }));
}

export function hydrateRecruiterWorkflow(options: { statePath?: string } = {}): WorkflowHydration {
  const statePath = options.statePath || workflowStatePath();
  const saved = readPersistedWorkflowState(statePath);
  if (saved) {
    return {
      stateSource: "saved workflow state",
      generatedAt: saved.generatedAt,
      lastUpdatedAt: saved.generatedAt,
      summary: saved.summary,
      states: saved.states,
      actionQueue: enrichActionQueueWithLifecycle(
        actionQueueFromPersisted(saved.states),
        saved.states,
      ),
      files: { workflowState: { path: statePath, found: true } },
    };
  }
  const audit = buildRecruiterWorkflowAuditFromReports();
  const states = buildPersistedWorkflowStates(audit);
  const file = buildPersistedWorkflowStateFile(states, audit.generatedAt);
  return {
    stateSource: "live inference",
    generatedAt: file.generatedAt,
    lastUpdatedAt: file.generatedAt,
    summary: file.summary,
    states,
    actionQueue: enrichActionQueueWithLifecycle(
      buildActionQueue(audit.states),
      states,
    ),
    files: { workflowState: { path: statePath, found: false } },
  };
}

export function hydrateCandidate360Workflow(candidateId: string, options: { statePath?: string } = {}) {
  const hydration = hydrateRecruiterWorkflow(options);
  const state = hydration.states.find((item) => item.candidateId === candidateId);
  if (!state) return null;
  const recommended = hydration.actionQueue.filter((item) => item.candidateId === candidateId);
  const lifecycle = lifecycleFromPersistedState(state);
  return {
    candidateId,
    candidateName: state.displayName,
    currentWorkflowStatus: state.currentStatus,
    lifecycle,
    recommendedNextAction: state.recommendedNextAction,
    allowedActions: state.allowedActions.map((action) => ({ action, reasons: ["Saved workflow state action"] })),
    blockedActions: state.blockedActions.map((action) => ({ action, reasons: state.blockerReasons.length ? state.blockerReasons : ["Action is not currently recommended"] })),
    blockerReasons: state.blockerReasons,
    missingFields: state.missingFields,
    profileQualityStatus: state.profileQualityStatus,
    validationStatus: state.validationStatus,
    aiExtractionReviewStatus: state.aiReviewStatus,
    stagingApplyHistoryStatus: state.stagingStatus,
    applyHistoryStatus: state.applyHistoryStatus,
    recommendedNextActions: recommended,
    timeline: [{ at: state.lastUpdatedAt, event: "workflow_state_loaded", note: state.auditNotes.join("; ") || "Workflow state loaded" }],
    lastUpdatedAt: state.lastUpdatedAt,
    stateSource: hydration.stateSource,
    safetyNote: "Workflow panel reads local workflow state and does not update candidate records.",
  };
}

export function writePersistedWorkflowStatePreview(file: PersistedWorkflowStateFile, outputPath = path.join("reports", "recruiter-workflow-state-preview.json")) {
  return writeWorkflowJson(outputPath, file);
}
