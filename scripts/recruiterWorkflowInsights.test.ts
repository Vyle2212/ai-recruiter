import assert from "node:assert/strict";

import {
  buildRecruiterWorkflowInsights,
} from "../lib/recruiterWorkflowInsights";
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
      "2026-07-20T08:00:00.000Z",
    createdAt:
      "2026-07-01T00:00:00.000Z",
    updatedAt:
      "2026-07-20T08:00:00.000Z",
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

const rollbackEvent =
  lifecycleEvent({
    eventId:
      "lifecycle-rollback:candidate-1:2026-08-03T10:00:00.000Z",
    fromStage:
      "submitted",
    toStage:
      "screening",
    action:
      "complete_screening",
    note:
      "Rollback for additional review",
    occurredAt:
      "2026-08-03T10:00:00.000Z",
  });

const candidateOne =
  lifecycle({
    history: [
      lifecycleEvent(),
      rollbackEvent,
    ],
  });

const insights =
  buildRecruiterWorkflowInsights(
    [
      state(candidateOne),
    ],
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
      bottleneckAverageDays: 5,
      bottleneckMaximumDays: 10,
    },
  );

assert.equal(
  insights.generatedAt,
  "2026-08-03T12:30:00.000Z",
);

assert.equal(
  insights.summary.totalCandidates,
  1,
);

assert.equal(
  insights.summary.activeCandidates,
  1,
);

assert.equal(
  insights.summary.overdueFollowUps,
  1,
);

assert.equal(
  insights.summary.highPriority,
  1,
);

assert.equal(
  insights.summary.rollbacks,
  1,
);

assert.ok(
  insights.bottlenecks.length >= 1,
);

assert.equal(
  insights.bottlenecks[0].stage,
  "submitted",
);

assert.ok(
  insights.recommendations.some(
    (item) =>
      item.type ===
      "overdue_follow_up",
  ),
);

assert.ok(
  insights.recommendations.some(
    (item) =>
      item.type ===
      "pipeline_bottleneck",
  ),
);

assert.equal(
  insights.recruiterRanking[0]
    .actorLabel,
  "Vy",
);

assert.equal(
  insights.safety.candidateDbWrites,
  0,
);

assert.equal(
  insights.safety.workflowWrites,
  0,
);

assert.equal(
  insights.safety.emailSends,
  0,
);

assert.equal(
  insights.safety.openAiCalls,
  0,
);

assert.equal(
  insights.safety.readOnly,
  true,
);

assert.match(
  insights.mode,
  /no OpenAI calls/,
);

const healthy =
  buildRecruiterWorkflowInsights(
    [],
    {
      now: NOW,
    },
  );

assert.equal(
  healthy.summary.totalCandidates,
  0,
);

assert.equal(
  healthy.recommendations.length,
  1,
);

assert.equal(
  healthy.recommendations[0].type,
  "healthy",
);

console.log(
  "recruiterWorkflowInsights.test.ts passed",
);