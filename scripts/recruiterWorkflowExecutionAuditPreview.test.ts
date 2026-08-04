import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionAuditPreviewReport,
} from "../lib/recruiterWorkflowExecutionAuditPreview";
import type {
  WorkflowAutomationDecisionFile,
} from "../lib/recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "../lib/recruiterWorkflowAutomationRules";
import type {
  WorkflowExecutionPlanReport,
} from "../lib/recruiterWorkflowExecutionPlan";
import type {
  WorkflowExecutionReadinessReport,
} from "../lib/recruiterWorkflowExecutionReadiness";

const proposal:
  RecruiterWorkflowAutomationProposal = {
  proposalId:
    "proposal-1",

  ruleId:
    "offer_follow_up",

  candidateId:
    "candidate-1",

  candidateName:
    "Candidate One",

  currentStage:
    "offer",

  proposedAction:
    "follow_up_client",

  priority:
    "critical",

  title:
    "Follow up offer",

  description:
    "Offer follow-up required.",

  reason:
    "Offer action overdue.",

  dueAt:
    "2026-08-01T09:00:00.000Z",

  evidence: [],

  href:
    "/recruiter/candidate360/candidate-1",

  execution: {
    previewOnly: true,
    requiresRecruiterApproval: true,
    automaticExecution: false,
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    openAiCalls: 0,
  },
};

const automationPreview:
  RecruiterWorkflowAutomationPreview = {
  generatedAt:
    "2026-08-04T02:00:00.000Z",

  evaluatedAt:
    "2026-08-04T02:00:00.000Z",

  summary: {
    total: 1,
    critical: 1,
    high: 0,
    medium: 0,
    low: 0,
    candidatesAffected: 1,
    rulesTriggered: 1,
  },

  proposals: [
    proposal,
  ],

  rules: [],

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    pushSends: 0,
    openAiCalls: 0,
    automaticActions: 0,
    previewOnly: true,
    requiresHumanApproval: true,
  },

  mode:
    "preview-only automation proposals",
};

const decisions:
  WorkflowAutomationDecisionFile = {
  version: 1,

  generatedAt:
    "2026-08-04T02:00:00.000Z",

  decisions: [
    {
      proposalId:
        proposal.proposalId,

      candidateId:
        proposal.candidateId,

      ruleId:
        proposal.ruleId,

      proposedAction:
        proposal.proposedAction,

      decision:
        "approved",

      reason:
        "Approved for audit preview.",

      reviewerId:
        "user-1",

      reviewerName:
        "Vy",

      decidedAt:
        "2026-08-04T02:00:00.000Z",

      updatedAt:
        "2026-08-04T02:00:00.000Z",

      executionStatus:
        "not_executed",

      safety: {
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
        openAiCalls: 0,
        automaticExecution: false,
      },
    },
  ],

  summary: {
    total: 1,
    approved: 1,
    rejected: 0,
    deferred: 0,
    executed: 0,
  },

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    openAiCalls: 0,
    automaticExecution: false,
    reviewOnly: true,
  },

  mode:
    "review-only decisions",
};

const readiness:
  WorkflowExecutionReadinessReport = {
  generatedAt:
    "2026-08-04T02:00:00.000Z",

  evaluatedAt:
    "2026-08-04T02:00:00.000Z",

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
        "readiness-1",

      proposalId:
        proposal.proposalId,

      candidateId:
        proposal.candidateId,

      candidateName:
        proposal.candidateName,

      ruleId:
        proposal.ruleId,

      proposedAction:
        proposal.proposedAction,

      expectedStage:
        "offer",

      currentStage:
        "offer",

      decision:
        "approved",

      approvedAt:
        "2026-08-04T02:00:00.000Z",

      status:
        "READY",

      reason:
        "All readiness checks passed.",

      checks: [
        {
          checkId:
            "proposal_exists",

          status:
            "passed",

          title:
            "Proposal exists",

          description:
            "Proposal exists.",

          evidence:
            true,
        },
      ],

      summary: {
        totalChecks: 1,
        passed: 1,
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
        proposal.href,
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

const plans:
  WorkflowExecutionPlanReport = {
  generatedAt:
    "2026-08-04T02:00:00.000Z",

  evaluatedAt:
    "2026-08-04T02:00:00.000Z",

  summary: {
    readinessItems: 1,
    readyItems: 1,
    plansCreated: 1,
    skippedItems: 0,
    executionEnabled: 0,
  },

  plans: [
    {
      executionPlanId:
        "plan-1",

      proposalId:
        proposal.proposalId,

      candidateId:
        proposal.candidateId,

      candidateName:
        proposal.candidateName,

      ruleId:
        proposal.ruleId,

      proposedAction:
        proposal.proposedAction,

      expectedStage:
        "offer",

      currentStage:
        "offer",

      readinessStatus:
        "READY",

      approvedAt:
        "2026-08-04T02:00:00.000Z",

      title:
        "Execution plan",

      description:
        "Preview only.",

      steps: [
        {
          stepId:
            "revalidate_readiness",

          sequence: 1,

          title:
            "Revalidate readiness",

          description:
            "Revalidate.",

          status:
            "planned",

          dependsOn: [],

          executionEnabled:
            false,

          wouldExecute:
            false,

          candidateDbWrites: 0,
          workflowWrites: 0,
          emailSends: 0,

          reason:
            "Preview only.",
        },
      ],

      summary: {
        totalSteps: 1,
        planned: 1,
        disabled: 0,
        blocked: 0,
        executionEnabled: false,
        candidateDbWrites: 0,
        workflowWrites: 0,
        emailSends: 0,
      },

      href:
        proposal.href,
    },
  ],

  skipped: [],

  safety: {
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    pushSends: 0,
    openAiCalls: 0,
    automaticActions: 0,
    executionEnabled: false,
    previewOnly: true,
    requiresHumanApproval: true,
  },

  mode:
    "preview-only plans",
};

const first =
  buildWorkflowExecutionAuditPreviewReport(
    automationPreview,
    decisions,
    readiness,
    plans,
    {
      generatedAt:
        "2026-08-04T03:00:00.000Z",

      evaluatedAt:
        "2026-08-04T03:00:00.000Z",
    },
  );

const second =
  buildWorkflowExecutionAuditPreviewReport(
    automationPreview,
    decisions,
    readiness,
    plans,
    {
      generatedAt:
        "2026-08-04T04:00:00.000Z",

      evaluatedAt:
        "2026-08-04T03:00:00.000Z",
    },
  );

assert.equal(
  first.summary.auditPreviews,
  1,
);

assert.equal(
  first.summary.auditWrites,
  0,
);

assert.equal(
  first.previews[0].readiness.status,
  "READY",
);

assert.equal(
  first.previews[0].decision.executionStatus,
  "not_executed",
);

assert.equal(
  first.previews[0].plan.executionEnabled,
  false,
);

assert.equal(
  first.previews[0].checksum.algorithm,
  "sha256",
);

assert.match(
  first.previews[0].checksum.value,
  /^[a-f0-9]{64}$/,
);

assert.equal(
  first.previews[0].checksum.value,
  second.previews[0].checksum.value,
);

assert.equal(
  first.safety.auditWrites,
  0,
);

assert.equal(
  first.safety.candidateDbWrites,
  0,
);

assert.equal(
  first.safety.workflowWrites,
  0,
);

assert.equal(
  first.safety.emailSends,
  0,
);

assert.equal(
  first.safety.executionEnabled,
  false,
);

assert.match(
  first.mode,
  /preview-only/i,
);

const routePath =
  "app/api/recruiter/workflow/execution-audit-preview/route.ts";

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
  "recruiterWorkflowExecutionAuditPreview.test.ts passed",
);