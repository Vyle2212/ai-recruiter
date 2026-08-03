import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath =
  "app/recruiter/workflow/copilot/page.tsx";

const workflowPath =
  "app/recruiter/workflow/page.tsx";

assert.ok(fs.existsSync(pagePath));

const page =
  fs.readFileSync(pagePath, "utf8");

const workflow =
  fs.readFileSync(workflowPath, "utf8");

assert.match(
  page,
  /\/api\/recruiter\/workflow\/insights/,
);

assert.match(
  page,
  /Recruiter Copilot/,
);

assert.match(
  page,
  /What needs attention today/,
);

assert.match(
  page,
  /Where is the biggest bottleneck/,
);

assert.match(
  page,
  /Which recruiter has the most activity/,
);

assert.match(
  page,
  /What should I review first/,
);

assert.match(
  page,
  /data\.recommendations/,
);

assert.match(
  page,
  /data\.safety\.openAiCalls/,
);

assert.doesNotMatch(
  page,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  page,
  /openai|chat\.completions|responses\.create/i,
);

assert.match(
  workflow,
  /href="\/recruiter\/workflow\/copilot"/,
);

console.log(
  "recruiterWorkflowCopilotUi.test.ts passed",
);