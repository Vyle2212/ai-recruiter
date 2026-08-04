import type { PersistedWorkflowState } from "./recruiterWorkflowPersistence";

export type WorkflowStateDiff = {
  generatedAt: string;
  mode: string;
  previousStates: number;
  currentInferredStates: number;
  newStates: PersistedWorkflowState[];
  changedStates: Array<{ candidateId: string; before: PersistedWorkflowState; after: PersistedWorkflowState; changedFields: string[] }>;
  unchangedStates: PersistedWorkflowState[];
  removedOrMissingStates: PersistedWorkflowState[];
};

function stable(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function diffWorkflowStates(previous: PersistedWorkflowState[], current: PersistedWorkflowState[]): WorkflowStateDiff {
  const previousById = new Map(previous.map((state) => [state.candidateId, state]));
  const currentById = new Map(current.map((state) => [state.candidateId, state]));
  const newStates: PersistedWorkflowState[] = [];
  const changedStates: WorkflowStateDiff["changedStates"] = [];
  const unchangedStates: PersistedWorkflowState[] = [];
  const compareFields: Array<keyof PersistedWorkflowState> = ["currentStatus", "priority", "recommendedNextAction", "missingFields", "validationStatus", "profileQualityStatus", "aiReviewStatus", "readyForShortlist", "clientSubmissionBlocked", "blockerReasons"];
  for (const state of current) {
    const previousState = previousById.get(state.candidateId);
    if (!previousState) {
      newStates.push(state);
      continue;
    }
    const changedFields = compareFields.filter((field) => stable(previousState[field]) !== stable(state[field])).map(String);
    if (changedFields.length) changedStates.push({ candidateId: state.candidateId, before: previousState, after: state, changedFields });
    else unchangedStates.push(state);
  }
  const removedOrMissingStates = previous.filter((state) => !currentById.has(state.candidateId));
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only workflow state diff; no candidate DB writes; no delete; no OpenAI calls",
    previousStates: previous.length,
    currentInferredStates: current.length,
    newStates,
    changedStates,
    unchangedStates,
    removedOrMissingStates,
  };
}
