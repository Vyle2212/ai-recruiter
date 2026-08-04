import assert from "node:assert/strict";
import fs from "node:fs";

const panelPath =
  "app/recruiter/workflow/automation/WorkflowExecutionPreviewPanel.tsx";

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
  /\/api\/recruiter\/workflow\/execution-preview\?limit=500/,
);

assert.match(
  panel,
  /Execution Preview/,
);

assert.match(
  panel,
  /Not executed/,
);

assert.match(
  panel,
  /Would execute: no/,
);

assert.match(
  panel,
  /Executable now:/,
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

assert.doesNotMatch(
  panel,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  panel,
  /move-stage|rollback-stage/,
);

assert.match(
  page,
  /WorkflowExecutionPreviewPanel/,
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
  "recruiterWorkflowExecutionPreviewUi.test.ts passed",
);