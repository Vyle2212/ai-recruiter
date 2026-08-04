import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/approval/page.tsx";

const automationPagePath =
  "app/recruiter/workflow/automation/page.tsx";

assert.ok(
  fs.existsSync(
    pagePath,
  ),
);

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

const automationPage =
  fs.readFileSync(
    automationPagePath,
    "utf8",
  );

assert.match(
  page,
  /Approval Queue/,
);

assert.match(
  page,
  /automation-preview\?limit=500/,
);

assert.match(
  page,
  /automation-decisions/,
);

assert.match(
  page,
  /execution-readiness\?limit=500/,
);

assert.match(
  page,
  /execution-simulator\?limit=500/,
);

assert.match(
  page,
  /PENDING/,
);

assert.match(
  page,
  /READY/,
);

assert.match(
  page,
  /BLOCKED/,
);

assert.match(
  page,
  /REJECTED/,
);

assert.match(
  page,
  /DEFERRED/,
);

assert.match(
  page,
  /Approve/,
);

assert.match(
  page,
  /Reject/,
);

assert.match(
  page,
  /Defer/,
);

assert.match(
  page,
  /method:\s*"POST"/,
);

assert.match(
  page,
  /Candidate DB writes: 0/,
);

assert.match(
  page,
  /Workflow writes: 0/,
);

assert.match(
  page,
  /Email sends: 0/,
);

assert.match(
  page,
  /Automatic execution: disabled/,
);

assert.doesNotMatch(
  page,
  /executionEnabled:\s*true/,
);

assert.doesNotMatch(
  page,
  /move-stage|rollback-stage/,
);

assert.match(
  automationPage,
  /\/recruiter\/workflow\/automation\/approval/,
);

assert.match(
  automationPage,
  /Approval queue/,
);

console.log(
  "recruiterWorkflowAutomationApprovalQueueUi.test.ts passed",
);