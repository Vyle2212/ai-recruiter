import assert from "node:assert/strict";

import {
  buildRecruiterCopilotContext,
} from "../lib/recruiterCopilotContext";
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

function lifecycle(
  overrides: Partial<CandidateLifecycleRecord> = {},
): CandidateLifecycleRecord {
  return {
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
      "2026-08-03T08:00:00.000Z",
    createdAt:
      "2026-08-01T00:00:00.000Z",
    updatedAt:
      "2026-08-03T08:00:00.000Z",
    history: [
      lifecycleEvent(),
    ],
    ...overrides,
  };
}

function state(
  candidateLifecycle: CandidateLifecycleRecord,
): PersistedWorkflowState {
  return {
    candidateId:
      candidateLifecycle.candidateId,
    displayName:
      candidateLifecycle.candidateName,
    lifecycle:
      candidateLifecycle,
    lastUpdatedAt:
      candidateLifecycle.updatedAt,
  } as PersistedWorkflowState;
}

const candidateOne =
  lifecycle();

const candidateTwo =
  lifecycle({
    lifecycleId:
      "candidate-lifecycle:candidate-2",
    candidateId:
      "candidate-2",
    candidateName:
      "Candidate Two",
    stage:
      "interview",
    previousStage:
      "submitted",
    nextAction:
      "collect_interview_feedback",
    nextActionDueAt:
      "2026-08-03T18:00:00.000Z",
    priority:
      "low",
    history: [
      lifecycleEvent({
        eventId:
          "lifecycle-event:candidate-2:2026-08-03T09:00:00.000Z",
        candidateId:
          "candidate-2",
        fromStage:
          "submitted",
        toStage:
          "interview",
        action:
          "collect_interview_feedback",
        occurredAt:
          "2026-08-03T09:00:00.000Z",
      }),
    ],
  });

const context =
  buildRecruiterCopilotContext(
    [
      state(candidateOne),
      state(candidateTwo),
    ],
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
      recentActivityLimit: 1,
      priorityCandidateLimit: 1,
    },
  );

assert.equal(
  context.generatedAt,
  "2026-08-03T12:30:00.000Z",
);

assert.equal(
  context.summary.totalCandidates,
  2,
);

assert.equal(
  context.summary.activeCandidates,
  2,
);

assert.equal(
  context.summary.overdueFollowUps,
  1,
);

assert.equal(
  context.summary.dueToday,
  1,
);

assert.equal(
  context.recentActivity.length,
  1,
);

assert.equal(
  context.priorityCandidates.length,
  1,
);

assert.equal(
  context.priorityCandidates[0]
    .candidateId,
  "candidate-1",
);

assert.equal(
  context.priorityCandidates[0]
    .dueStatus,
  "overdue",
);

assert.equal(
  context.capabilities.candidateDbWrites,
  false,
);

assert.equal(
  context.capabilities.workflowWrites,
  false,
);

assert.equal(
  context.capabilities.emailSends,
  false,
);

assert.equal(
  context.capabilities.openAiCalls,
  false,
);

assert.match(
  context.mode,
  /no OpenAI calls/,
);

const empty =
  buildRecruiterCopilotContext(
    [],
    {
      now: NOW,
    },
  );

assert.equal(
  empty.summary.totalCandidates,
  0,
);

assert.equal(
  empty.priorityCandidates.length,
  0,
);

console.log(
  "recruiterCopilotContext.test.ts passed",
);