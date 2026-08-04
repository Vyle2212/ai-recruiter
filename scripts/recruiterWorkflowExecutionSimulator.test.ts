import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionSimulationReport,
} from "../lib/recruiterWorkflowExecutionSimulator";
import type {
  WorkflowExecutionAuditPreviewReport,
} from "../lib/recruiterWorkflowExecutionAuditPreview";

const auditReport:
  WorkflowExecutionAuditPreviewReport = {
  generatedAt:
    "2026-08-04T03:00:00.000Z",

  evaluatedAt:
    "2026-08-04T03:00:00.000Z",

  summary: {
    approvedDecisions: 1,
    readyItems: 1,
    executionPlans: 1,
    auditPreviews: 1,
    unmatchedItems: 0,
    auditWrites: 0,
  },

  previews: [
    {
      auditPreviewId:
        "audit-preview-1",

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

      decision: {
        status:
          "approved",

        reviewerId:
          "user-1",

        reviewerName:
          "Vy",

        reason:
          "Approved.",

        approvedAt:
          "2026-08-04T02:00:00.000Z",

        executionStatus:
          "not_executed",
      },

      readiness: {
        status:
          "READY",

        reason:
          "All readiness checks passed.",

        passedChecks: 8,
        failedChecks: 0,
        warningChecks: 0,

        evaluatedAt:
          "2026-08-04T03:00:00.000Z",
      },

      plan: {
        executionPlanId:
          "plan-1",

        totalSteps: 2,
        plannedSteps: 1,
        disabledSteps: 1,

        executionEnabled:
          false,
      },

      canonicalPayload: {
        version: 1,

        proposal: {
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

          currentStage:
            "offer",

          priority:
            "critical",
        },

        decision: {
          status:
            "approved",

          reviewerId:
            "user-1",

          reviewerName:
            "Vy",

          reason:
            "Approved.",

          approvedAt:
            "2026-08-04T02:00:00.000Z",
        },

        readiness: {
          status:
            "READY",

          reason:
            "All readiness checks passed.",

          expectedStage:
            "offer",

          currentStage:
            "offer",

          checkResults: [],
        },

        plan: {
          executionPlanId:
            "plan-1",

          steps: [
            {
              sequence: 1,

              stepId:
                "revalidate_readiness",

              status:
                "planned",

              dependsOn: [],

              executionEnabled:
                false,

              wouldExecute:
                false,
            },

            {
              sequence: 2,

              stepId:
                "email_delivery",

              status:
                "disabled",

              dependsOn: [
                "revalidate_readiness",
              ],

              executionEnabled:
                false,

              wouldExecute:
                false,
            },
          ],
        },
      },

      checksum: {
        algorithm:
          "sha256",

        value:
          "a".repeat(64),
      },

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        auditWrites: 0,
        emailSends: 0,
        automaticExecution: false,
        previewOnly: true,
      },

      href:
        "/recruiter/candidate360/candidate-1",
    },
  ],

  unmatched: [],

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    auditWrites: 0,
    emailSends: 0,
    pushSends: 0,
    openAiCalls: 0,
    automaticActions: 0,
    executionEnabled: false,
    previewOnly: true,
  },

  mode:
    "preview-only audit report",
};

const report =
  buildWorkflowExecutionSimulationReport(
    auditReport,
    {
      generatedAt:
        "2026-08-04T04:00:00.000Z",

      evaluatedAt:
        "2026-08-04T04:00:00.000Z",
    },
  );

assert.equal(
  report.summary.simulationsCreated,
  1,
);

assert.equal(
  report.summary.dryRunsCompleted,
  1,
);

assert.equal(
  report.simulations[0].status,
  "DRY_RUN_COMPLETED",
);

assert.equal(
  report.simulations[0].dryRun,
  true,
);

assert.equal(
  report.simulations[0].executionEnabled,
  false,
);

assert.equal(
  report.simulations[0].checksum.verified,
  true,
);

assert.equal(
  report.simulations[0].summary.simulated,
  1,
);

assert.equal(
  report.simulations[0].summary.skipped,
  1,
);

assert.equal(
  report.simulations[0].summary.blocked,
  0,
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
  report.safety.auditWrites,
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
  report.safety.dryRun,
  true,
);

assert.match(
  report.mode,
  /dry-run/i,
);

const routePath =
  "app/api/recruiter/workflow/execution-simulator/route.ts";

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
  /buildWorkflowExecutionSimulationReport/,
);

assert.match(
  route,
  /buildWorkflowExecutionAuditPreviewReport/,
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
  "recruiterWorkflowExecutionSimulator.test.ts passed",
);