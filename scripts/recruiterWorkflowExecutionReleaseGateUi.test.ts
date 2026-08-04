import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/automation/release-gate/page.tsx";

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
  /Execution Release Gate/,
);

assert.match(
  page,
  /execution-release-gate\?limit=500/,
);

assert.match(
  page,
  /READY_FOR_RELEASE_PREVIEW/,
);

assert.match(
  page,
  /BLOCKED/,
);

assert.match(
  page,
  /LOCKED/,
);

assert.match(
  page,
  /Audit checksum/,
);

assert.match(
  page,
  /Simulation checksum/,
);

assert.match(
  page,
  /Checksum match/,
);

assert.match(
  page,
  /Execution lock/,
);

assert.match(
  page,
  /Release allowed: false/,
);

assert.match(
  page,
  /Would release: no/,
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
  /\/recruiter\/workflow\/automation\/release-gate/,
);

assert.match(
  automation,
  /Release gate/,
);

console.log(
  "recruiterWorkflowExecutionReleaseGateUi.test.ts passed",
);