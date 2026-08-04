import assert from "node:assert/strict";

import {
  buildRecruiterWorkflowAnalytics,
} from "../lib/recruiterWorkflowAnalytics";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const NOW =
  "2026-08-03T12:00:00.000Z";

function event(
  overrides: Partial<CandidateLifecycleEvent>,
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
  overrides: Partial<CandidateLifecycleRecord>,
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
      "2026-08-02T09:00:00.000Z",
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
    history: [],
    ...overrides,
  };
}

function state(
  candidateId: string,
  candidateLifecycle: CandidateLifecycleRecord,
): PersistedWorkflowState {
  return {
    candidateId,
    displayName:
      candidateLifecycle.candidateName,
    lifecycle:
      candidateLifecycle,
    lastUpdatedAt:
      candidateLifecycle.updatedAt,
  } as PersistedWorkflowState;
}

const firstTransition = event({});

const rollback = event({
  eventId:
    "lifecycle-rollback:candidate-1:2026-08-03T10:00:00.000Z",
  fromStage:
    "submitted",
  toStage:
    "screening",
  action:
    "complete_screening",
  note:
    "Rollback for further review",
  occurredAt:
    "2026-08-03T10:00:00.000Z",
});

const candidateOne =
  lifecycle({
    history: [
      firstTransition,
      rollback,
    ],
  });

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
      "2026-08-04T09:00:00.000Z",
    priority:
      "low",
    lastActivityAt:
      "2026-08-01T12:00:00.000Z",
    updatedAt:
      "2026-08-01T12:00:00.000Z",
    history: [
      event({
        eventId:
          "lifecycle-event:candidate-2:2026-08-01T12:00:00.000Z",
        candidateId:
          "candidate-2",
        fromStage:
          "submitted",
        toStage:
          "interview",
        action:
          "collect_interview_feedback",
        actorId:
          "user-2",
        actorName:
          "Recruiter Two",
        occurredAt:
          "2026-08-01T12:00:00.000Z",
      }),
    ],
  });

const analytics =
  buildRecruiterWorkflowAnalytics(
    [
      state(
        "candidate-1",
        candidateOne,
      ),
      state(
        "candidate-2",
        candidateTwo,
      ),
    ],
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

assert.equal(
  analytics.candidateCount,
  2,
);
assert.equal(
  analytics.eventCount,
  3,
);
assert.equal(
  analytics.averageEventsPerCandidate,
  1.5,
);

const submitted =
  analytics.stageDistribution.find(
    (item) =>
      item.stage === "submitted",
  );

assert.equal(
  submitted?.count,
  1,
);
assert.equal(
  submitted?.percentage,
  50,
);

const interview =
  analytics.stageDistribution.find(
    (item) =>
      item.stage === "interview",
  );

assert.equal(
  interview?.count,
  1,
);

assert.equal(
  analytics.reminderSummary.overdue,
  1,
);
assert.equal(
  analytics.reminderSummary.soon,
  1,
);
assert.equal(
  analytics.reminderSummary.requiresAttention,
  2,
);
assert.equal(
  analytics.reminderSummary.highPriority,
  1,
);

assert.equal(
  analytics.rollbackSummary.total,
  1,
);
assert.equal(
  analytics.rollbackSummary.last30Days,
  1,
);
assert.equal(
  analytics.rollbackSummary.ratePercentage,
  33.33,
);

assert.equal(
  analytics.activitySummary.today,
  2,
);
assert.equal(
  analytics.activitySummary.last7Days,
  3,
);

assert.equal(
  analytics.recruiterSummary[0]
    .activityCount,
  2,
);
assert.equal(
  analytics.recruiterSummary[0]
    .rollbackCount,
  1,
);

assert.equal(
  analytics.transitionSummary.reduce(
    (sum, item) =>
      sum + item.count,
    0,
  ),
  3,
);

assert.equal(
  analytics.safety.candidateDbWrites,
  0,
);
assert.equal(
  analytics.safety.workflowWrites,
  0,
);
assert.equal(
  analytics.safety.readOnly,
  true,
);

const empty =
  buildRecruiterWorkflowAnalytics(
    [],
    { now: NOW },
  );

assert.equal(
  empty.candidateCount,
  0,
);
assert.equal(
  empty.eventCount,
  0,
);
assert.equal(
  empty.averageEventsPerCandidate,
  0,
);

console.log(
  "recruiterWorkflowAnalytics.test.ts passed",
);