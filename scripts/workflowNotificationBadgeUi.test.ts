import assert from "node:assert/strict";
import fs from "node:fs";

const componentPath =
  "app/recruiter/components/WorkflowNotificationBadge.tsx";

const dashboardPath =
  "app/recruiter/dashboard/page.tsx";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

const copilotPath =
  "app/recruiter/workflow/copilot/page.tsx";

assert.ok(
  fs.existsSync(componentPath),
);

const component =
  fs.readFileSync(
    componentPath,
    "utf8",
  );

const dashboard =
  fs.readFileSync(
    dashboardPath,
    "utf8",
  );

const workflow =
  fs.readFileSync(
    workflowPath,
    "utf8",
  );

const copilot =
  fs.readFileSync(
    copilotPath,
    "utf8",
  );

assert.match(
  component,
  /\/api\/recruiter\/workflow\/notifications\?limit=100&includeHealthy=false/,
);

assert.match(
  component,
  /data\?\.summary\.unread/,
);

assert.match(
  component,
  /data\?\.summary\.critical/,
);

assert.match(
  component,
  /href="\/recruiter\/workflow\/notifications"/,
);

assert.doesNotMatch(
  component,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  component,
  /method:\s*["']DELETE["']/,
);

assert.match(
  dashboard,
  /WorkflowNotificationBadge/,
);

assert.match(
  workflow,
  /<WorkflowNotificationBadge compact \/>/,
);

assert.match(
  copilot,
  /<WorkflowNotificationBadge compact \/>/,
);

console.log(
  "workflowNotificationBadgeUi.test.ts passed",
);