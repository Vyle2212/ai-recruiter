import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/operations/page.tsx";

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

const automation =
  fs.readFileSync(
    automationPath,
    "utf8",
  );

assert.match(
  page,
  /Operations Dashboard/,
);

assert.match(
  page,
  /automation-preview\?limit=500/,
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
  /execution-readiness\?limit=500/,
);

assert.match(
  page,
  /execution-plan\?limit=500/,
);

assert.match(
  page,
  /execution-audit-preview\?limit=500/,
);

assert.match(
  page,
  /execution-simulator\?limit=500/,
);

assert.match(
  page,
  /execution-release-gate\?limit=500/,
);

assert.match(
  page,
  /Automation proposals/,
);

assert.match(
  page,
  /Approval queue/,
);

assert.match(
  page,
  /Approval history/,
);

assert.match(
  page,
  /Execution readiness/,
);

assert.match(
  page,
  /Execution plans/,
);

assert.match(
  page,
  /Audit previews/,
);

assert.match(
  page,
  /Dry-run simulations/,
);

assert.match(
  page,
  /Execution release gate/,
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
  /Audit writes: 0/,
);

assert.match(
  page,
  /Email sends: 0/,
);

assert.match(
  page,
  /Execution enabled: false/,
);

assert.doesNotMatch(
  page,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  page,
  /method:\s*["']DELETE["']/,
);

assert.doesNotMatch(
  page,
  /move-stage|rollback-stage/,
);

assert.match(
  automation,
  /\/recruiter\/workflow\/automation\/operations/,
);

assert.match(
  automation,
  /Operations dashboard/,
);

console.log(
  "recruiterWorkflowAutomationOperationsUi.test.ts passed",
);