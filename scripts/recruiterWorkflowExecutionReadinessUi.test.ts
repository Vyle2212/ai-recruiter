import assert from "node:assert/strict";
import fs from "node:fs";

const panelPath =
  "app/recruiter/workflow/automation/WorkflowExecutionReadinessPanel.tsx";

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
  /\/api\/recruiter\/workflow\/execution-readiness\?limit=500/,
);

assert.match(
  panel,
  /Execution Readiness/,
);

assert.match(
  panel,
  /Execution disabled/,
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
  /READY/,
);

assert.match(
  panel,
  /BLOCKED/,
);

assert.match(
  panel,
  /STALE/,
);

assert.match(
  panel,
  /ALREADY_EXECUTED/,
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
  /WorkflowExecutionReadinessPanel/,
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
  "recruiterWorkflowExecutionReadinessUi.test.ts passed",
);