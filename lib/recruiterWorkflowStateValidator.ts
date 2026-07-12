import type { PersistedWorkflowState } from "./recruiterWorkflowPersistence";
import { ALL_ACTIONS, ALL_STATUSES } from "./recruiterWorkflowPersistence";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export type WorkflowStateValidationResult = {
  validStates: PersistedWorkflowState[];
  invalidStates: Array<{ candidateId: string; reasons: string[]; state: any }>;
  duplicateCandidateIds: string[];
};

export function validatePersistedWorkflowState(state: any) {
  const reasons: string[] = [];
  if (!clean(state?.candidateId)) reasons.push("candidateId required");
  if (!ALL_STATUSES.includes(state?.currentStatus)) reasons.push("invalid workflow status");
  if (!ALL_ACTIONS.includes(state?.recommendedNextAction)) reasons.push("invalid recommended action");
  for (const action of [...(state?.allowedActions || []), ...(state?.blockedActions || [])]) if (!ALL_ACTIONS.includes(action)) reasons.push(`invalid action ${action}`);
  if (state?.source && state.source !== "workflow_inference") reasons.push("invalid source");
  return reasons;
}

export function validateWorkflowStateFile(input: any): WorkflowStateValidationResult {
  const byId = new Map<string, PersistedWorkflowState>();
  const invalidStates: WorkflowStateValidationResult["invalidStates"] = [];
  const duplicateCandidateIds: string[] = [];
  for (const state of Array.isArray(input?.states) ? input.states : []) {
    const candidateId = clean(state.candidateId);
    const reasons = validatePersistedWorkflowState(state);
    if (reasons.length) {
      invalidStates.push({ candidateId, reasons, state });
      continue;
    }
    const previous = byId.get(candidateId);
    if (previous) {
      duplicateCandidateIds.push(candidateId);
      const previousTime = Date.parse(previous.lastUpdatedAt || "") || 0;
      const currentTime = Date.parse(state.lastUpdatedAt || "") || 0;
      if (currentTime >= previousTime) byId.set(candidateId, state);
    } else {
      byId.set(candidateId, state);
    }
  }
  return { validStates: Array.from(byId.values()), invalidStates, duplicateCandidateIds: Array.from(new Set(duplicateCandidateIds)) };
}
