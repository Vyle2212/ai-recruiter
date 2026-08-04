import assert from "node:assert/strict";

import {
  buildRecruiterCopilotContext,
} from "../lib/recruiterCopilotContext";
import {
  buildRecruiterCopilotSuggestions,
} from "../lib/recruiterCopilotSuggestions";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const NOW =
  "2026-08-03T12:00:00.000Z";

function lifecycleEvent(
  overrides: Partial<CandidateLifecycleEvent> = {},
): CandidateLifecycleEvent {
  return {
    eventId:
      "lifecycle-event:candidate-1:2026-08-03T08:00:00.000Z",
    candidateId:
      "candidate-1",
    fromStage:
      "screening",
    toStage:
      "submitted",
    action:
      "follow_up_client",
    note:
      "Submitted to client",
    source:
      "recruiter_updated",
    actorId:
      "user-1",
    actorName:
      "Vy",
    occurredAt:
      "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

const lifecycle:
  CandidateLifecycleRecord = {
  lifecycleId:
    "candidate-lifecycle:candidate-1",
  candidateId:
    "candidate-1",
  candidateName:
    "Candidate One",
  ownerId:
    "user-1",
  ownerName:
    "Vy",
  stage:
    "submitted",
  previousStage:
    "screening",
  nextAction:
    "follow_up_client",
  nextActionNote:
    "Follow up client",
  nextActionDueAt:
    "2026-08-01T09:00:00.000Z",
  priority:
    "medium",
  source:
    "recruiter_updated",
  lastActivityAt:
    "2026-07-20T08:00:00.000Z",
  createdAt:
    "2026-07-01T00:00:00.000Z",
  updatedAt:
    "2026-07-20T08:00:00.000Z",
  history: [
    lifecycleEvent(),
  ],
};

const state = {
  candidateId:
    lifecycle.candidateId,
  displayName:
    lifecycle.candidateName,
  lifecycle,
  lastUpdatedAt:
    lifecycle.updatedAt,
} as PersistedWorkflowState;

const context =
  buildRecruiterCopilotContext(
    [state],
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

const feed =
  buildRecruiterCopilotSuggestions(
    context,
  );

assert.ok(
  feed.suggestions.length > 0,
);

assert.equal(
  feed.suggestions[0].type,
  "follow_up_overdue",
);

assert.equal(
  feed.suggestions[0].priority,
  "critical",
);

assert.equal(
  feed.suggestions[0].candidateId,
  "candidate-1",
);

assert.match(
  feed.suggestions[0].href,
  /candidate360/,
);

assert.equal(
  feed.summary.total,
  feed.suggestions.length,
);

assert.ok(
  feed.summary.critical >= 1,
);

assert.equal(
  feed.safety.candidateDbWrites,
  0,
);

assert.equal(
  feed.safety.workflowWrites,
  0,
);

assert.equal(
  feed.safety.emailSends,
  0,
);

assert.equal(
  feed.safety.openAiCalls,
  0,
);

assert.equal(
  feed.safety.automaticActions,
  0,
);

assert.equal(
  feed.safety.readOnly,
  true,
);

assert.match(
  feed.mode,
  /require human action/i,
);

const limited =
  buildRecruiterCopilotSuggestions(
    context,
    {
      limit: 1,
    },
  );

assert.equal(
  limited.suggestions.length,
  1,
);

const emptyContext =
  buildRecruiterCopilotContext(
    [],
    {
      now: NOW,
    },
  );

const healthy =
  buildRecruiterCopilotSuggestions(
    emptyContext,
  );

assert.equal(
  healthy.suggestions.length,
  1,
);

assert.equal(
  healthy.suggestions[0].type,
  "workflow_healthy",
);

const noHealthy =
  buildRecruiterCopilotSuggestions(
    emptyContext,
    {
      includeHealthy: false,
    },
  );

assert.equal(
  noHealthy.suggestions.length,
  0,
);

console.log(
  "recruiterCopilotSuggestions.test.ts passed",
);