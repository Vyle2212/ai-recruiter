import assert from "node:assert/strict";
import fs from "node:fs";

const panelPath =
  "app/recruiter/workflow/automation/WorkflowExecutionPlanPanel.tsx";

const pagePath =
  "app/recruiter/workflow/automation/page.tsx";

assert.ok(
  fs.existsSync(panelPath),
);

const panel =
  fs.readFileSync(
    panelPath,
    "utf8",
  );

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

assert.match(
  panel,
  /\/api\/recruiter\/workflow\/execution-plan\?limit=500/,
);

assert.match(
  panel,
  /Execution Plan/,
);

assert.match(
  panel,
  /Readiness: READY/,
);

assert.match(
  panel,
  /Would execute: no/,
);

assert.match(
  panel,
  /Execution enabled:/,
);

assert.match(
  panel,
  /Candidate DB writes/,
);

assert.match(
  panel,
  /Workflow writes/,
);

assert.match(
  panel,
  /Email sends/,
);

assert.match(
  panel,
  /Preview only/,
);

assert.doesNotMatch(
  panel,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  panel,
  /method:\s*["']DELETE["']/,
);

assert.doesNotMatch(
  panel,
  /move-stage|rollback-stage/,
);

assert.match(
  page,
  /WorkflowExecutionPlanPanel/,
);

assert.match(
  page,
  /decision ===\s*"approved"/,
);

assert.match(
  page,
  /proposalId=\{/,
);

console.log(
  "recruiterWorkflowExecutionPlanUi.test.ts passed",
);