import assert from "node:assert/strict";

import {
  evaluateCandidateLifecycleReminder,
} from "../lib/candidateLifecycleReminderEngine";
import type {
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";

const NOW =
  "2026-08-03T09:00:00.000Z";

function lifecycle(
  overrides: Partial<CandidateLifecycleRecord> = {},
): CandidateLifecycleRecord {
  return {
    lifecycleId:
      "candidate-lifecycle:test",
    candidateId:
      "candidate-reminder-001",
    candidateName:
      "Reminder Candidate",
    ownerId:
      null,
    ownerName:
      null,
    stage:
      "screening",
    previousStage:
      "sourced",
    nextAction:
      "complete_screening",
    nextActionNote:
      "Complete screening",
    nextActionDueAt:
      "2026-08-04T09:00:00.000Z",
    priority:
      "low",
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

const overdue =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      nextActionDueAt:
        "2026-07-31T09:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  overdue.dueStatus,
  "overdue",
);
assert.equal(
  overdue.daysUntilDue,
  -3,
);
assert.equal(
  overdue.reminderLabel,
  "Overdue by 3 days",
);
assert.equal(
  overdue.effectivePriority,
  "high",
);
assert.equal(
  overdue.requiresAttention,
  true,
);

const today =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      priority: "medium",
      nextActionDueAt:
        "2026-08-03T18:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  today.dueStatus,
  "today",
);
assert.equal(
  today.daysUntilDue,
  0,
);
assert.equal(
  today.reminderLabel,
  "Due today",
);
assert.equal(
  today.effectivePriority,
  "high",
);

const tomorrow =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      nextActionDueAt:
        "2026-08-04T01:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  tomorrow.dueStatus,
  "soon",
);
assert.equal(
  tomorrow.daysUntilDue,
  1,
);
assert.equal(
  tomorrow.reminderLabel,
  "Due tomorrow",
);
assert.equal(
  tomorrow.effectivePriority,
  "medium",
);

const twoDays =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      priority: "medium",
      nextActionDueAt:
        "2026-08-05T12:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  twoDays.dueStatus,
  "soon",
);
assert.equal(
  twoDays.daysUntilDue,
  2,
);
assert.equal(
  twoDays.reminderLabel,
  "Due in 2 days",
);
assert.equal(
  twoDays.effectivePriority,
  "medium",
);

const scheduled =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      nextActionDueAt:
        "2026-08-08T09:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  scheduled.dueStatus,
  "scheduled",
);
assert.equal(
  scheduled.daysUntilDue,
  5,
);
assert.equal(
  scheduled.reminderLabel,
  "Scheduled in 5 days",
);
assert.equal(
  scheduled.requiresAttention,
  false,
);

const noDue =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      nextActionDueAt: null,
    }),
    { now: NOW },
  );

assert.equal(
  noDue.dueStatus,
  "none",
);
assert.equal(
  noDue.daysUntilDue,
  null,
);
assert.equal(
  noDue.reminderLabel,
  "No due date",
);
assert.equal(
  noDue.requiresAttention,
  false,
);

const hired =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      stage: "hired",
      nextAction:
        "no_action",
      nextActionDueAt:
        "2026-08-01T09:00:00.000Z",
    }),
    { now: NOW },
  );

assert.equal(
  hired.terminal,
  true,
);
assert.equal(
  hired.dueStatus,
  "none",
);
assert.equal(
  hired.reminderLabel,
  "Completed",
);
assert.equal(
  hired.requiresAttention,
  false,
);

const rejected =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      stage: "rejected",
      nextAction:
        "no_action",
    }),
    { now: NOW },
  );

assert.equal(
  rejected.terminal,
  true,
);
assert.equal(
  rejected.reminderLabel,
  "Completed",
);

const invalidDue =
  evaluateCandidateLifecycleReminder(
    lifecycle({
      nextActionDueAt:
        "not-a-date",
    }),
    { now: NOW },
  );

assert.equal(
  invalidDue.dueStatus,
  "none",
);
assert.equal(
  invalidDue.reminderLabel,
  "Invalid due date",
);
assert.equal(
  invalidDue.requiresAttention,
  true,
);

const deterministic =
  evaluateCandidateLifecycleReminder(
    lifecycle(),
    { now: NOW },
  );

assert.equal(
  deterministic.evaluatedAt,
  NOW,
);

console.log(
  "candidateLifecycleReminder.test.ts passed",
);