import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  deleteWorkflowAutomationDecision,
  readWorkflowAutomationDecisions,
  saveWorkflowAutomationDecision,
} from "../lib/recruiterWorkflowAutomationDecisions";

const directory =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "workflow-automation-decisions-",
    ),
  );

const filePath =
  path.join(
    directory,
    "decisions.json",
  );

const empty =
  readWorkflowAutomationDecisions(
    filePath,
  );

assert.equal(
  empty.summary.total,
  0,
);

const approved =
  saveWorkflowAutomationDecision(
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
        "Recruiter confirmed follow-up is required.",

      reviewerId:
        "user-1",

      reviewerName:
        "Vy",

      decidedAt:
        "2026-08-03T12:00:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  approved.decision.decision,
  "approved",
);

assert.equal(
  approved.decision.executionStatus,
  "not_executed",
);

assert.equal(
  approved.file.summary.approved,
  1,
);

assert.equal(
  approved.file.summary.executed,
  0,
);

const deferred =
  saveWorkflowAutomationDecision(
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
        "deferred",

      reason:
        "Wait for client update.",

      reviewerName:
        "Vy",

      decidedAt:
        "2026-08-03T13:00:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  deferred.file.decisions.length,
  1,
);

assert.equal(
  deferred.file.summary.approved,
  0,
);

assert.equal(
  deferred.file.summary.deferred,
  1,
);

assert.equal(
  deferred.file.safety.workflowWrites,
  0,
);

assert.equal(
  deferred.file.safety.emailSends,
  0,
);

assert.equal(
  deferred.file.safety.automaticExecution,
  false,
);

const deleted =
  deleteWorkflowAutomationDecision(
    "proposal-1",
    {
      filePath,
    },
  );

assert.equal(
  deleted.deleted,
  true,
);

assert.equal(
  deleted.file.summary.total,
  0,
);

const routePath =
  "app/api/recruiter/workflow/automation-decisions/route.ts";

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
  /export async function GET/,
);

assert.match(
  route,
  /export async function POST/,
);

assert.match(
  route,
  /export async function DELETE/,
);

assert.match(
  route,
  /approved/,
);

assert.match(
  route,
  /rejected/,
);

assert.match(
  route,
  /deferred/,
);

fs.rmSync(
  directory,
  {
    recursive: true,
    force: true,
  },
);

console.log(
  "recruiterWorkflowAutomationDecisions.test.ts passed",
);