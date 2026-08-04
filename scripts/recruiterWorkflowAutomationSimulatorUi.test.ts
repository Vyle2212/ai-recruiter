import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/simulator/page.tsx";

const automationPagePath =
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

const automationPage =
  fs.readFileSync(
    automationPagePath,
    "utf8",
  );

assert.match(
  page,
  /Dry-run Simulator/,
);

assert.match(
  page,
  /automation-preview\?limit=500/,
);

assert.match(
  page,
  /execution-simulator\?limit=500/,
);

assert.match(
  page,
  /automation-rules/,
);

assert.match(
  page,
  /Proposal explorer/,
);

assert.match(
  page,
  /Selected proposal/,
);

assert.match(
  page,
  /Dry-run result/,
);

assert.match(
  page,
  /Refresh dry run/,
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
  automationPage,
  /\/recruiter\/workflow\/automation\/simulator/,
);

assert.match(
  automationPage,
  /Open simulator/,
);

console.log(
  "recruiterWorkflowAutomationSimulatorUi.test.ts passed",
);