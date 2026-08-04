import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/approval/batch/page.tsx";

const queuePath =
  "app/recruiter/workflow/automation/approval/page.tsx";

const automationPath =
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

const queue =
  fs.readFileSync(
    queuePath,
    "utf8",
  );

const automation =
  fs.readFileSync(
    automationPath,
    "utf8",
  );

assert.match(
  page,
  /Batch Approval/,
);

assert.match(
  page,
  /Select visible/,
);

assert.match(
  page,
  /Clear selection/,
);

assert.match(
  page,
  /Batch approve/,
);

assert.match(
  page,
  /Batch reject/,
);

assert.match(
  page,
  /Batch defer/,
);

assert.match(
  page,
  /automation-decisions/,
);

assert.match(
  page,
  /automation-approval-history/,
);

assert.match(
  page,
  /method:\s*"POST"/,
);

assert.match(
  page,
  /Process sequentially/,
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
  queue,
  /\/recruiter\/workflow\/automation\/approval\/batch/,
);

assert.match(
  queue,
  /Batch review/,
);

assert.match(
  automation,
  /\/recruiter\/workflow\/automation\/approval\/batch/,
);

console.log(
  "recruiterWorkflowAutomationBatchApprovalUi.test.ts passed",
);