import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionReadinessReport,
} from "../lib/recruiterWorkflowExecutionReadiness";
import type {
  WorkflowAutomationDecisionFile,
} from "../lib/recruiterWorkflowAutomationDecisions";
import type {
  RecruiterWorkflowAutomationPreview,
} from "../lib/recruiterWorkflowAutomationRules";
import type {
  CandidateLifecycleRecord,
} from "../lib/candidateLifecycleTypes";
import type {
  PersistedWorkflowState,
} from "../lib/recruiterWorkflowPersistence";

const proposal = {
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
    previewOnly: true,
    requiresRecruiterApproval: true,
    automaticExecution: false,
    candidateDbWrites: 0,
    workflowWrites: 0,
    emailSends: 0,
    openAiCalls: 0,
  },
} as const;

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
    "2026-08-04T09:00:00.000Z",

  priority:
    "high",

  source:
    "recruiter_updated",

  lastActivityAt:
    "2026-08-03T09:00:00.000Z",

  createdAt:
    "2026-07-01T09:00:00.000Z",

  updatedAt:
    "2026-08-03T09:00:00.000Z",

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
        "Approved for readiness review.",

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

const ready =
  buildWorkflowExecutionReadinessReport(
    [state],
    automationPreview,
    decisions,
    {
      generatedAt:
        "2026-08-03T13:00:00.000Z",

      evaluatedAt:
        "2026-08-03T13:00:00.000Z",
    },
  );

assert.equal(
  ready.summary.total,
  1,
);

assert.equal(
  ready.summary.ready,
  1,
);

assert.equal(
  ready.items[0].status,
  "READY",
);

assert.equal(
  ready.items[0].execution.enabled,
  false,
);

assert.equal(
  ready.safety.executionEnabled,
  false,
);

assert.equal(
  ready.safety.candidateDbWrites,
  0,
);

assert.equal(
  ready.safety.workflowWrites,
  0,
);

assert.equal(
  ready.safety.emailSends,
  0,
);

const staleState = {
  ...state,

  lifecycle: {
    ...lifecycle,

    stage:
      "hired" as const,

    updatedAt:
      "2026-08-03T12:30:00.000Z",
  },

  lastUpdatedAt:
    "2026-08-03T12:30:00.000Z",
} as PersistedWorkflowState;

const stale =
  buildWorkflowExecutionReadinessReport(
    [staleState],
    automationPreview,
    decisions,
    {
      evaluatedAt:
        "2026-08-03T13:00:00.000Z",
    },
  );

assert.equal(
  stale.items[0].status,
  "STALE",
);

const executed =
  buildWorkflowExecutionReadinessReport(
    [state],
    automationPreview,
    decisions,
    {
      executedProposalIds: [
        proposal.proposalId,
      ],
    },
  );

assert.equal(
  executed.items[0].status,
  "ALREADY_EXECUTED",
);

assert.match(
  ready.mode,
  /readiness-only/i,
);

const routePath =
  "app/api/recruiter/workflow/execution-readiness/route.ts";

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
  "recruiterWorkflowExecutionReadiness.test.ts passed",
);