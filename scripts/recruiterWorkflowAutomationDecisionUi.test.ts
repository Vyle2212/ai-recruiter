import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/page.tsx";

const controlsPath =
  "app/recruiter/workflow/automation/WorkflowAutomationDecisionControls.tsx";

assert.ok(
  fs.existsSync(
    controlsPath,
  ),
);

const page =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

const controls =
  fs.readFileSync(
    controlsPath,
    "utf8",
  );

assert.match(
  page,
  /WorkflowAutomationDecisionControls/,
);

assert.match(
  page,
  /\/api\/recruiter\/workflow\/automation-decisions/,
);

assert.match(
  page,
  /decisionSummary\.approved/,
);

assert.match(
  page,
  /decisionSummary\.rejected/,
);

assert.match(
  page,
  /decisionSummary\.deferred/,
);

assert.match(
  controls,
  /Approve/,
);

assert.match(
  controls,
  /Reject/,
);

assert.match(
  controls,
  /Defer/,
);

assert.match(
  controls,
  /Approved — not executed/,
);

assert.match(
  controls,
  /method:\s*"POST"/,
);

assert.match(
  controls,
  /method:\s*"DELETE"/,
);

assert.match(
  controls,
  /Decision storage only · no workflow execution/,
);

assert.doesNotMatch(
  controls,
  /move-stage|rollback-stage/,
);

console.log(
  "recruiterWorkflowAutomationDecisionUi.test.ts passed",
);