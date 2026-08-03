import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionPreview,
} from "../lib/recruiterWorkflowExecutionPreview";
import type {
  WorkflowAutomationDecisionFile,
} from "../lib/recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
  RecruiterWorkflowAutomationProposal,
} from "../lib/recruiterWorkflowAutomationRules";

const proposal: RecruiterWorkflowAutomationProposal = {
  proposalId:
    "automation-preview:offer:candidate-1",

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
    previewOnly:
      true,

    requiresRecruiterApproval:
      true,

    automaticExecution:
      false,

    candidateDbWrites:
      0,

    workflowWrites:
      0,

    emailSends:
      0,

    openAiCalls:
      0,
  },
};

const automationPreview:
  RecruiterWorkflowAutomationPreview = {
  generatedAt:
    "2026-08-03T12:00:00.000Z",

  evaluatedAt:
    "2026-08-03T12:00:00.000Z",

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
    "2026-08-03T12:00:00.000Z",

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
        "Approved for preview.",

      reviewerId:
        "user-1",

      reviewerName:
        "Vy",

      decidedAt:
        "2026-08-03T12:00:00.000Z",

      updatedAt:
        "2026-08-03T12:00:00.000Z",

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

const feed =
  buildWorkflowExecutionPreview(
    automationPreview,
    decisions,
    {
      generatedAt:
        "2026-08-03T13:00:00.000Z",
    },
  );

assert.equal(
  feed.summary.approvedDecisions,
  1,
);

assert.equal(
  feed.summary.executionPreviews,
  1,
);

assert.equal(
  feed.summary.executableNow,
  0,
);

assert.equal(
  feed.previews[0].executionStatus,
  "not_executed",
);

assert.equal(
  feed.previews[0].summary.executableNow,
  false,
);

assert.ok(
  feed.previews[0].steps.some(
    (step) =>
      step.stepId === "move_stage" &&
      step.status === "disabled",
  ),
);

assert.ok(
  feed.previews[0].steps.some(
    (step) =>
      step.stepId === "send_email" &&
      step.status === "disabled",
  ),
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
  feed.safety.emailSends,
  0,
);

assert.equal(
  feed.safety.executionEnabled,
  false,
);

assert.equal(
  feed.safety.previewOnly,
  true,
);

assert.match(
  feed.mode,
  /preview-only/i,
);

const routePath =
  "app/api/recruiter/workflow/execution-preview/route.ts";

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
  /buildWorkflowExecutionPreview/,
);

assert.match(
  route,
  /readWorkflowAutomationDecisions/,
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
  "recruiterWorkflowExecutionPreview.test.ts passed",
);