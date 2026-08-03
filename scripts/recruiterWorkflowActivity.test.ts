import assert from "node:assert/strict";

import {
  activitiesFromLifecycle,
  buildRecruiterWorkflowActivityFeed,
  normalizeLifecycleEvent,
} from "../lib/recruiterWorkflowActivity";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const transitionEvent:
  CandidateLifecycleEvent = {
    eventId:
      "lifecycle-event:candidate-1:2026-08-03T09:00:00.000Z",
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
      "2026-08-03T09:00:00.000Z",
  };

const rollbackEvent:
  CandidateLifecycleEvent = {
    ...transitionEvent,
    eventId:
      "lifecycle-rollback:candidate-1:2026-08-03T10:00:00.000Z",
    fromStage:
      "submitted",
    toStage:
      "screening",
    action:
      "complete_screening",
    note:
      "Rollback for more screening",
    actorName:
      null,
    occurredAt:
      "2026-08-03T10:00:00.000Z",
  };

const normalized =
  normalizeLifecycleEvent(
    transitionEvent,
    "Candidate One",
  );

assert.equal(
  normalized.activityType,
  "stage_transition",
);
assert.equal(
  normalized.candidateName,
  "Candidate One",
);
assert.equal(
  normalized.actorLabel,
  "Vy",
);
assert.equal(
  normalized.metadata.rollback,
  false,
);

const rollback =
  normalizeLifecycleEvent(
    rollbackEvent,
    "Candidate One",
  );

assert.equal(
  rollback.activityType,
  "rollback",
);
assert.equal(
  rollback.actorLabel,
  "user-1",
);
assert.equal(
  rollback.metadata.rollback,
  true,
);

const lifecycle:
  CandidateLifecycleRecord = {
    lifecycleId:
      "candidate-lifecycle:candidate-1",
    candidateId:
      "candidate-1",
    candidateName:
      "Candidate One",
    ownerId:
      null,
    ownerName:
      null,
    stage:
      "screening",
    previousStage:
      "submitted",
    nextAction:
      "complete_screening",
    nextActionNote:
      "Complete screening",
    nextActionDueAt:
      null,
    priority:
      "medium",
    source:
      "recruiter_updated",
    lastActivityAt:
      rollbackEvent.occurredAt,
    createdAt:
      "2026-08-01T00:00:00.000Z",
    updatedAt:
      rollbackEvent.occurredAt,
    history: [
      transitionEvent,
      rollbackEvent,
    ],
  };

const lifecycleActivities =
  activitiesFromLifecycle(lifecycle);

assert.equal(
  lifecycleActivities.length,
  2,
);

const state = {
  candidateId:
    "candidate-1",
  displayName:
    "Candidate One",
  lifecycle,
} as PersistedWorkflowState;

const feed =
  buildRecruiterWorkflowActivityFeed(
    [state],
    {
      generatedAt:
        "2026-08-03T11:00:00.000Z",
    },
  );

assert.equal(feed.total, 2);
assert.equal(
  feed.activities[0].activityType,
  "rollback",
);
assert.equal(
  feed.activities[1].activityType,
  "stage_transition",
);
assert.equal(
  feed.generatedAt,
  "2026-08-03T11:00:00.000Z",
);
assert.match(
  feed.mode,
  /no candidate DB writes/,
);

const limited =
  buildRecruiterWorkflowActivityFeed(
    [state],
    { limit: 1 },
  );

assert.equal(
  limited.activities.length,
  1,
);

const filtered =
  buildRecruiterWorkflowActivityFeed(
    [state],
    {
      candidateId:
        "missing-candidate",
    },
  );

assert.equal(filtered.total, 0);

console.log(
  "recruiterWorkflowActivity.test.ts passed",
);