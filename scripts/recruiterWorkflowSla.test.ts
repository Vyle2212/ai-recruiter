import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildRecruiterCopilotContext,
} from "../lib/recruiterCopilotContext";
import {
  buildRecruiterWorkflowSlaReport,
} from "../lib/recruiterWorkflowSla";
import type {
  CandidateLifecycleEvent,
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const NOW =
  "2026-08-03T12:00:00.000Z";

const lifecycleEvent:
  CandidateLifecycleEvent = {
  eventId:
    "lifecycle-event:candidate-1:2026-07-20T08:00:00.000Z",
  candidateId:
    "candidate-1",
  fromStage:
    "screening",
  toStage:
    "submitted",
  action:
    "follow_up_client",
  note:
    "Submitted",
  source:
    "recruiter_updated",
  actorId:
    "user-1",
  actorName:
    "Vy",
  occurredAt:
    "2026-07-20T08:00:00.000Z",
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
    lifecycleEvent,
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

const states = [state];

const context =
  buildRecruiterCopilotContext(
    states,
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

const report =
  buildRecruiterWorkflowSlaReport(
    states,
    context,
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

assert.equal(
  report.summary.totalCandidates,
  1,
);

assert.equal(
  report.summary.activeCandidates,
  1,
);

assert.equal(
  report.summary.violated,
  1,
);

assert.equal(
  report.candidateRisks[0].status,
  "violated",
);

assert.equal(
  report.candidateRisks[0].stage,
  "submitted",
);

assert.ok(
  report.candidateRisks[0]
    .violationDays > 0,
);

assert.equal(
  report.stageSummary.find(
    (item) =>
      item.stage === "submitted",
  )?.violated,
  1,
);

assert.equal(
  report.safety.candidateDbWrites,
  0,
);

assert.equal(
  report.safety.workflowWrites,
  0,
);

assert.equal(
  report.safety.openAiCalls,
  0,
);

assert.equal(
  report.safety.automaticActions,
  0,
);

assert.match(
  report.mode,
  /read-only/i,
);

const routePath =
  "app/api/recruiter/workflow/sla/route.ts";

const pagePath =
  "app/recruiter/workflow/sla/page.tsx";

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
  /\/api\/recruiter\/workflow\/sla/,
);

assert.match(
  page,
  /Workflow SLA/,
);

assert.match(
  page,
  /Stage SLA ranking/,
);

assert.match(
  page,
  /Candidate SLA risks/,
);

assert.match(
  workflow,
  /import\s+\{\s*WorkflowSlaBadge\s*\}\s+from\s+["']@\/app\/recruiter\/components\/WorkflowSlaBadge["']/,
);

assert.match(
  workflow,
  /<WorkflowSlaBadge\s+compact\s*\/>/,
);

assert.doesNotMatch(
  workflow,
  /href=["']\/recruiter\/workflow\/sla["']/,
);

console.log(
  "recruiterWorkflowSla.test.ts passed",
);