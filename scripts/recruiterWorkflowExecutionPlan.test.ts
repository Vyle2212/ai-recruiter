import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionPlanReport,
} from "../lib/recruiterWorkflowExecutionPlan";
import type {
  WorkflowExecutionReadinessReport,
} from "../lib/recruiterWorkflowExecutionReadiness";

const readiness:
  WorkflowExecutionReadinessReport = {
  generatedAt:
    "2026-08-03T12:00:00.000Z",

  evaluatedAt:
    "2026-08-03T12:00:00.000Z",

  summary: {
    total: 1,
    ready: 1,
    blocked: 0,
    stale: 0,
    alreadyExecuted: 0,
  },

  items: [
    {
      readinessId:
        "workflow-execution-readiness:proposal-1",

      proposalId:
        "proposal-1",

      candidateId:
        "candidate-1",

      candidateName:
        "Candidate One",

      ruleId:
        "offer_follow_up",

      proposedAction:
        "follow_up_client",

      expectedStage:
        "offer",

      currentStage:
        "offer",

      decision:
        "approved",

      approvedAt:
        "2026-08-03T11:00:00.000Z",

      status:
        "READY",

      reason:
        "All readiness checks passed, but execution remains disabled.",

      checks: [],

      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },

      execution: {
        enabled: false,
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        automaticExecution: false,
      },

      href:
        "/recruiter/candidate360/candidate-1",
    },
  ],

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    pushSends: 0,
    openAiCalls: 0,
    automaticActions: 0,
    executionEnabled: false,
    readinessOnly: true,
  },

  mode:
    "readiness-only report",
};

const report =
  buildWorkflowExecutionPlanReport(
    readiness,
    {
      generatedAt:
        "2026-08-03T13:00:00.000Z",

      evaluatedAt:
        "2026-08-03T13:00:00.000Z",
    },
  );

assert.equal(
  report.summary.plansCreated,
  1,
);

assert.equal(
  report.summary.executionEnabled,
  0,
);

assert.equal(
  report.plans[0].readinessStatus,
  "READY",
);

assert.equal(
  report.plans[0].summary.executionEnabled,
  false,
);

assert.ok(
  report.plans[0].steps.some(
    (step) =>
      step.stepId ===
        "revalidate_readiness" &&
      step.status === "planned",
  ),
);

assert.ok(
  report.plans[0].steps.some(
    (step) =>
      step.stepId ===
        "stage_transition" &&
      step.status === "disabled",
  ),
);

assert.ok(
  report.plans[0].steps.some(
    (step) =>
      step.stepId ===
        "candidate_update" &&
      step.status === "disabled",
  ),
);

assert.ok(
  report.plans[0].steps.some(
    (step) =>
      step.stepId ===
        "email_delivery" &&
      step.status === "disabled",
  ),
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
  report.safety.emailSends,
  0,
);

assert.equal(
  report.safety.executionEnabled,
  false,
);

assert.equal(
  report.safety.previewOnly,
  true,
);

assert.match(
  report.mode,
  /preview-only/i,
);

const blockedReadiness:
  WorkflowExecutionReadinessReport = {
  ...readiness,

  summary: {
    total: 1,
    ready: 0,
    blocked: 1,
    stale: 0,
    alreadyExecuted: 0,
  },

  items: [
    {
      ...readiness.items[0],

      status:
        "BLOCKED",

      reason:
        "Candidate stage does not match.",
    },
  ],
};

const blocked =
  buildWorkflowExecutionPlanReport(
    blockedReadiness,
  );

assert.equal(
  blocked.plans.length,
  0,
);

assert.equal(
  blocked.skipped.length,
  1,
);

const routePath =
  "app/api/recruiter/workflow/execution-plan/route.ts";

assert.ok(
  fs.existsSync(routePath),
);

const route =
  fs.readFileSync(
    routePath,
    "utf8",
  );

assert.match(
  route,
  /buildWorkflowExecutionPlanReport/,
);

assert.match(
  route,
  /buildWorkflowExecutionReadinessReport/,
);

assert.match(
  route,
  /export async function GET/,
);

assert.doesNotMatch(
  route,
  /export async function POST/,
);

console.log(
  "recruiterWorkflowExecutionPlan.test.ts passed",
);