import assert from "node:assert/strict";
import fs from "node:fs";

const dashboardPath =
  "app/recruiter/workflow/analytics/page.tsx";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

assert.ok(fs.existsSync(dashboardPath));

const dashboard =
  fs.readFileSync(dashboardPath, "utf8");

const workflow =
  fs.readFileSync(workflowPath, "utf8");

assert.match(
  dashboard,
  /\/api\/recruiter\/workflow\/analytics/,
);

assert.match(
  dashboard,
  /RecruiterWorkflowAnalytics/,
);

assert.match(
  dashboard,
  /Stage distribution/,
);

assert.match(
  dashboard,
  /Follow-up health/,
);

assert.match(
  dashboard,
  /Stage aging/,
);

assert.match(
  dashboard,
  /Rollback health/,
);

assert.match(
  dashboard,
  /Recruiter activity/,
);

assert.match(
  dashboard,
  /data\.reminderSummary\.overdue/,
);

assert.match(
  dashboard,
  /data\.transitionSummary/,
);

assert.match(
  dashboard,
  /data\.recruiterSummary/,
);

assert.match(
  dashboard,
  /data\.safety\.candidateDbWrites/,
);

assert.doesNotMatch(
  dashboard,
  /method:\s*["']POST["']/,
);

assert.match(
  workflow,
  /href="\/recruiter\/workflow\/analytics"/,
);

console.log(
  "recruiterWorkflowAnalyticsDashboard.test.ts passed",
);