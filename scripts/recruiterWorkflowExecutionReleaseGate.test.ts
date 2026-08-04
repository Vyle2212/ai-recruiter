import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkflowExecutionReleaseGateReport,
} from "../lib/recruiterWorkflowExecutionReleaseGate";

const decisions = {
  version: 1,

  generatedAt:
    "2026-08-04T05:00:00.000Z",

  decisions: [
    {
      proposalId:
        "proposal-1",

      candidateId:
        "candidate-1",

      ruleId:
        "offer_follow_up",

      proposedAction:
        "follow_up_client",

      decision:
        "approved",

      reason:
        "Approved.",

      reviewerId:
        "recruiter-1",

      reviewerName:
        "Vy",

      decidedAt:
        "2026-08-04T05:00:00.000Z",

      updatedAt:
        "2026-08-04T05:00:00.000Z",

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
} as any;

const readiness = {
  generatedAt:
    "2026-08-04T05:00:00.000Z",

  evaluatedAt:
    "2026-08-04T05:00:00.000Z",

  summary: {
    total: 1,
    ready: 1,
    blocked: 0,
    stale: 0,
    alreadyExecuted: 0,
  },

  items: [
    {
      proposalId:
        "proposal-1",

      candidateId:
        "candidate-1",

      candidateName:
        "Candidate One",

      status:
        "READY",

      reason:
        "All readiness checks passed.",

      href:
        "/recruiter/candidate360/candidate-1",
    },
  ],

  safety: {
    executionEnabled: false,
  },

  mode:
    "readiness-only",
} as any;

const checksum =
  "a".repeat(64);

const auditPreview = {
  generatedAt:
    "2026-08-04T05:00:00.000Z",

  evaluatedAt:
    "2026-08-04T05:00:00.000Z",

  summary: {
    auditPreviews: 1,
  },

  previews: [
    {
      auditPreviewId:
        "audit-1",

      proposalId:
        "proposal-1",

      candidateId:
        "candidate-1",

      candidateName:
        "Candidate One",

      checksum: {
        algorithm:
          "sha256",

        value:
          checksum,
      },

      href:
        "/recruiter/candidate360/candidate-1",
    },
  ],

  unmatched: [],

  safety: {
    executionEnabled: false,
  },

  mode:
    "preview-only",
} as any;

const simulation = {
  generatedAt:
    "2026-08-04T05:00:00.000Z",

  evaluatedAt:
    "2026-08-04T05:00:00.000Z",

  summary: {
    simulationsCreated: 1,
  },

  simulations: [
    {
      proposalId:
        "proposal-1",

      candidateId:
        "candidate-1",

      candidateName:
        "Candidate One",

      status:
        "DRY_RUN_COMPLETED",

      checksum: {
        algorithm:
          "sha256",

        value:
          checksum,

        verified:
          true,
      },

      href:
        "/recruiter/candidate360/candidate-1",
    },
  ],

  skipped: [],

  safety: {
    executionEnabled: false,
  },

  mode:
    "dry-run",
} as any;

const locked =
  buildWorkflowExecutionReleaseGateReport(
    decisions,
    readiness,
    auditPreview,
    simulation,
    {
      generatedAt:
        "2026-08-04T06:00:00.000Z",

      evaluatedAt:
        "2026-08-04T06:00:00.000Z",

      executionLockEnabled:
        false,
    },
  );

assert.equal(
  locked.summary.gateItems,
  1,
);

assert.equal(
  locked.items[0].status,
  "LOCKED",
);

assert.equal(
  locked.items[0].summary.failed,
  0,
);

assert.equal(
  locked.items[0].summary.locked,
  1,
);

assert.equal(
  locked.items[0].checksum.matches,
  true,
);

assert.equal(
  locked.items[0].lock.releaseAllowed,
  false,
);

assert.equal(
  locked.items[0].lock.wouldRelease,
  false,
);

const readyPreview =
  buildWorkflowExecutionReleaseGateReport(
    decisions,
    readiness,
    auditPreview,
    simulation,
    {
      generatedAt:
        "2026-08-04T06:00:00.000Z",

      evaluatedAt:
        "2026-08-04T06:00:00.000Z",

      executionLockEnabled:
        true,
    },
  );

assert.equal(
  readyPreview.items[0].status,
  "READY_FOR_RELEASE_PREVIEW",
);

assert.equal(
  readyPreview.items[0].lock.releaseAllowed,
  false,
);

assert.equal(
  readyPreview.summary.releasesPerformed,
  0,
);

assert.equal(
  readyPreview.safety.executionEnabled,
  false,
);

assert.equal(
  readyPreview.safety.releasePreviewOnly,
  true,
);

const mismatchedSimulation = {
  ...simulation,

  simulations: [
    {
      ...simulation.simulations[0],

      checksum: {
        algorithm:
          "sha256",

        value:
          "b".repeat(64),

        verified:
          true,
      },
    },
  ],
} as any;

const blocked =
  buildWorkflowExecutionReleaseGateReport(
    decisions,
    readiness,
    auditPreview,
    mismatchedSimulation,
    {
      executionLockEnabled:
        true,
    },
  );

assert.equal(
  blocked.items[0].status,
  "BLOCKED",
);

assert.equal(
  blocked.items[0].checksum.matches,
  false,
);

assert.ok(
  blocked.items[0].summary.failed >
    0,
);

const routePath =
  "app/api/recruiter/workflow/execution-release-gate/route.ts";

assert.ok(
  fs.existsSync(
    routePath,
  ),
);

const route =
  fs.readFileSync(
    routePath,
    "utf8",
  );

assert.match(
  route,
  /buildWorkflowExecutionReleaseGateReport/,
);

assert.match(
  route,
  /executionLockEnabled:\s*false/,
);

assert.match(
  route,
  /export async function GET/,
);

assert.doesNotMatch(
  route,
  /export async function POST/,
);

assert.doesNotMatch(
  route,
  /move-stage|rollback-stage/,
);

console.log(
  "recruiterWorkflowExecutionReleaseGate.test.ts passed",
);