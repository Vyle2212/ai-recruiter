import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildRecruiterWorkflowTimeline,
} from "../lib/recruiterWorkflowTimeline";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const event:
  CandidateLifecycleEvent = {
  eventId:
    "event:candidate-1:submitted",
  candidateId:
    "candidate-1",
  fromStage:
    "screening",
  toStage:
    "submitted",
  action:
    "follow_up_client",
  note:
    "Candidate submitted to client",
  source:
    "recruiter_updated",
  actorId:
    "user-1",
  actorName:
    "Vy",
  occurredAt:
    "2026-08-03T09:00:00.000Z",
};

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
    "2026-08-04T09:00:00.000Z",
  priority:
    "medium",
  source:
    "recruiter_updated",
  lastActivityAt:
    "2026-08-03T09:00:00.000Z",
  createdAt:
    "2026-08-01T09:00:00.000Z",
  updatedAt:
    "2026-08-03T09:00:00.000Z",
  history: [
    event,
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

const feed =
  buildRecruiterWorkflowTimeline(
    [state],
    {
      generatedAt:
        "2026-08-03T12:00:00.000Z",
    },
  );

assert.equal(
  feed.summary.totalEvents,
  2,
);

assert.equal(
  feed.summary.candidateCreated,
  1,
);

assert.equal(
  feed.summary.stageTransitions,
  1,
);

assert.equal(
  feed.summary.candidatesRepresented,
  1,
);

assert.equal(
  feed.events[0].candidateId,
  "candidate-1",
);

assert.equal(
  feed.events[0].eventType,
  "stage_transition",
);

assert.match(
  feed.events[0].title,
  /screening.*submitted/i,
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
  feed.safety.openAiCalls,
  0,
);

assert.equal(
  feed.safety.automaticActions,
  0,
);

assert.match(
  feed.mode,
  /read-only/i,
);

const filtered =
  buildRecruiterWorkflowTimeline(
    [state],
    {
      eventType:
        "candidate_created",
    },
  );

assert.equal(
  filtered.events.length,
  1,
);

assert.equal(
  filtered.events[0].eventType,
  "candidate_created",
);

const routePath =
  "app/api/recruiter/workflow/timeline/route.ts";

const pagePath =
  "app/recruiter/workflow/timeline/page.tsx";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

assert.ok(
  fs.existsSync(routePath),
);

assert.ok(
  fs.existsSync(pagePath),
);

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

const workflow =
  fs.readFileSync(
    workflowPath,
    "utf8",
  );

assert.match(
  page,
  /\/api\/recruiter\/workflow\/timeline/,
);

assert.match(
  page,
  /Workflow Timeline/,
);

assert.match(
  page,
  /Read-only event/,
);

assert.doesNotMatch(
  page,
  /method:\s*["']POST["']/,
);

assert.match(
  workflow,
  /href="\/recruiter\/workflow\/timeline"/,
);

console.log(
  "recruiterWorkflowTimeline.test.ts passed",
);