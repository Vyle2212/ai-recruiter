import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildRecruiterCopilotContext,
} from "../lib/recruiterCopilotContext";
import {
  buildRecruiterWorkflowAutomationPreview,
} from "../lib/recruiterWorkflowAutomationRules";
import {
  buildRecruiterWorkflowSlaReport,
} from "../lib/recruiterWorkflowSla";
import type {
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const NOW =
  "2026-08-03T12:00:00.000Z";

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
    "offer",
  previousStage:
    "interview",
  nextAction:
    "follow_up_client",
  nextActionNote:
    "Follow up offer",
  nextActionDueAt:
    "2026-07-30T09:00:00.000Z",
  priority:
    "high",
  source:
    "recruiter_updated",
  lastActivityAt:
    "2026-07-25T09:00:00.000Z",
  createdAt:
    "2026-07-01T09:00:00.000Z",
  updatedAt:
    "2026-07-25T09:00:00.000Z",
  history: [],
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

const sla =
  buildRecruiterWorkflowSlaReport(
    states,
    context,
    {
      now: NOW,
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

const preview =
  buildRecruiterWorkflowAutomationPreview(
    states,
    context,
    sla,
    {
      generatedAt:
        "2026-08-03T12:30:00.000Z",
    },
  );

assert.ok(
  preview.proposals.length > 0,
);

assert.ok(
  preview.proposals.some(
    (item) =>
      item.ruleId ===
      "offer_follow_up",
  ),
);

assert.equal(
  preview.safety.automaticActions,
  0,
);

assert.equal(
  preview.safety.candidateDbWrites,
  0,
);

assert.equal(
  preview.safety.workflowWrites,
  0,
);

assert.equal(
  preview.safety.emailSends,
  0,
);

assert.equal(
  preview.safety.openAiCalls,
  0,
);

assert.equal(
  preview.safety.previewOnly,
  true,
);

assert.equal(
  preview.safety.requiresHumanApproval,
  true,
);

assert.match(
  preview.mode,
  /preview-only/i,
);

const routePath =
  "app/api/recruiter/workflow/automation-preview/route.ts";

const pagePath =
  "app/recruiter/workflow/automation/page.tsx";

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
  /automation-preview/,
);

assert.match(
  page,
  /Workflow Automation Preview/,
);

assert.match(
  page,
  /Recruiter approval required/,
);

assert.match(
  page,
  /Preview only/,
);

assert.doesNotMatch(
  page,
  /method:\s*["']POST["']/,
);

assert.match(
  workflow,
  /href="\/recruiter\/workflow\/automation"/,
);

console.log(
  "recruiterWorkflowAutomationRules.test.ts passed",
);