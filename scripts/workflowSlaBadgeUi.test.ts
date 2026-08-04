import assert from "node:assert/strict";
import fs from "node:fs";

const componentPath =
  "app/recruiter/components/WorkflowSlaBadge.tsx";

const dashboardPath =
  "app/recruiter/dashboard/page.tsx";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

const notificationsPath =
  "app/recruiter/workflow/notifications/page.tsx";

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

const notifications =
  fs.readFileSync(
    notificationsPath,
    "utf8",
  );

assert.match(
  component,
  /\/api\/recruiter\/workflow\/sla\?limit=1/,
);

assert.match(
  component,
  /data\.summary\.compliancePercentage/,
);

assert.match(
  component,
  /data\.summary\.violated/,
);

assert.match(
  component,
  /data\.summary\.warning/,
);

assert.match(
  component,
  /href="\/recruiter\/workflow\/sla"/,
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
  /WorkflowSlaBadge/,
);

assert.match(
  workflow,
  /<WorkflowSlaBadge compact \/>/,
);

assert.match(
  notifications,
  /<WorkflowSlaBadge compact \/>/,
);

assert.doesNotMatch(
  workflow,
  /<Link href="\/recruiter\/workflow\/sla" className="rounded-md border border-amber/,
);

console.log(
  "workflowSlaBadgeUi.test.ts passed",
);