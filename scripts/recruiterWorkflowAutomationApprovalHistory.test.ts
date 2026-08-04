import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendWorkflowAutomationApprovalHistory,
  readWorkflowAutomationApprovalHistory,
} from "../lib/recruiterWorkflowAutomationApprovalHistory";

const directory =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "workflow-approval-history-",
    ),
  );

const filePath =
  path.join(
    directory,
    "history.json",
  );

const initial =
  readWorkflowAutomationApprovalHistory(
    filePath,
  );

assert.equal(
  initial.summary.total,
  0,
);

const approved =
  appendWorkflowAutomationApprovalHistory(
    {
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

      previousDecision:
        null,

      decision:
        "approved",

      reason:
        "Approved for follow-up.",

      reviewerId:
        "recruiter-1",

      reviewerName:
        "Vy",

      occurredAt:
        "2026-08-04T05:00:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  approved.file.summary.total,
  1,
);

assert.equal(
  approved.file.summary.approved,
  1,
);

assert.equal(
  approved.event.previousDecision,
  null,
);

const deferred =
  appendWorkflowAutomationApprovalHistory(
    {
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

      previousDecision:
        "approved",

      decision:
        "deferred",

      reason:
        "Waiting for client confirmation.",

      reviewerId:
        "recruiter-1",

      reviewerName:
        "Vy",

      occurredAt:
        "2026-08-04T06:00:00.000Z",
    },
    {
      filePath,
    },
  );

assert.equal(
  deferred.file.summary.total,
  2,
);

assert.equal(
  deferred.file.summary.deferred,
  1,
);

assert.equal(
  deferred.event.previousDecision,
  "approved",
);

assert.equal(
  deferred.event.safety.candidateDbWrites,
  0,
);

assert.equal(
  deferred.event.safety.workflowWrites,
  0,
);

assert.equal(
  deferred.event.safety.emailSends,
  0,
);

const routePath =
  "app/api/recruiter/workflow/automation-approval-history/route.ts";

const pagePath =
  "app/recruiter/workflow/automation/history/page.tsx";

const queuePath =
  "app/recruiter/workflow/automation/approval/page.tsx";

assert.ok(
  fs.existsSync(
    routePath,
  ),
);

assert.ok(
  fs.existsSync(
    pagePath,
  ),
);

const route =
  fs.readFileSync(
    routePath,
    "utf8",
  );

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

const queue =
  fs.readFileSync(
    queuePath,
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
  page,
  /Approval History/,
);

assert.match(
  page,
  /Initial decision/,
);

assert.match(
  page,
  /Approval history only/,
);

assert.match(
  queue,
  /automation-approval-history/,
);

assert.doesNotMatch(
  route,
  /move-stage|rollback-stage/,
);

fs.rmSync(
  directory,
  {
    recursive: true,
    force: true,
  },
);

console.log(
  "recruiterWorkflowAutomationApprovalHistory.test.ts passed",
);