import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/rules/page.tsx";

const automationPagePath =
  "app/recruiter/workflow/automation/page.tsx";

assert.ok(
  fs.existsSync(pagePath),
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
  /Rule Management/,
);

assert.match(
  page,
  /\/api\/recruiter\/workflow\/automation-rules/,
);

assert.match(
  page,
  /method:\s*"POST"/,
);

assert.match(
  page,
  /method:\s*"DELETE"/,
);

assert.match(
  page,
  /Reset defaults/,
);

assert.match(
  page,
  /Save rule/,
);

assert.match(
  page,
  /overdueEscalationDays/,
);

assert.match(
  page,
  /onHoldReviewDays/,
);

assert.match(
  page,
  /rollbackThreshold/,
);

assert.match(
  page,
  /Configuration only/,
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

assert.doesNotMatch(
  page,
  /move-stage|rollback-stage/,
);

assert.match(
  automationPage,
  /\/recruiter\/workflow\/automation\/rules/,
);

assert.match(
  automationPage,
  /Manage rules/,
);

console.log(
  "recruiterWorkflowAutomationRulesUi.test.ts passed",
);