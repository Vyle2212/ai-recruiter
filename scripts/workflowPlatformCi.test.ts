import assert from "node:assert/strict";
import fs from "node:fs";

const workflowPath =
  ".github/workflows/workflow-platform-ci.yml";

assert.ok(
  fs.existsSync(
    workflowPath,
  ),
);

const source =
  fs.readFileSync(
    workflowPath,
    "utf8",
  );

assert.match(
  source,
  /name:\s*Workflow Platform CI/,
);

assert.match(
  source,
  /actions\/checkout@v6/,
);

assert.match(
  source,
  /actions\/setup-node@v7/,
);

assert.match(
  source,
  /node-version:\s*"24"/,
);

assert.match(
  source,
  /npm ci/,
);

assert.match(
  source,
  /npm run validate:workflow:tests/,
);

assert.match(
  source,
  /npm run validate:workflow:fast/,
);

assert.match(
  source,
  /npm run build/,
);

assert.match(
  source,
  /npm run start/,
);

assert.match(
  source,
  /npm run smoke:workflow/,
);

assert.match(
  source,
  /WORKFLOW_SMOKE_BASE_URL/,
);

assert.match(
  source,
  /permissions:\s*\n\s*contents:\s*read/,
);

assert.doesNotMatch(
  source,
  /contents:\s*write/,
);

assert.doesNotMatch(
  source,
  /pull-requests:\s*write/,
);

console.log(
  "workflowPlatformCi.test.ts passed",
);