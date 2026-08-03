import assert from "node:assert/strict";
import fs from "node:fs";

const componentPath =
  "app/recruiter/dashboard/WorkflowExecutiveSummary.tsx";

const dashboardPath =
  "app/recruiter/dashboard/page.tsx";

assert.ok(fs.existsSync(componentPath));

const component =
  fs.readFileSync(componentPath, "utf8");

const dashboard =
  fs.readFileSync(dashboardPath, "utf8");

assert.match(
  component,
  /\/api\/recruiter\/workflow\/analytics/,
);

assert.match(
  component,
  /Executive workflow overview/,
);

assert.match(
  component,
  /Overdue follow-ups/,
);

assert.match(
  component,
  /Aging bottlenecks/,
);

assert.match(
  component,
  /Recruiter activity/,
);

assert.match(
  component,
  /data\.safety\.candidateDbWrites/,
);

assert.doesNotMatch(
  component,
  /method:\s*["']POST["']/,
);

assert.match(
  dashboard,
  /WorkflowExecutiveSummary/,
);

assert.match(
  dashboard,
  /<WorkflowExecutiveSummary\/>/,
);

console.log(
  "recruiterDashboardWorkflowExecutive.test.ts passed",
);