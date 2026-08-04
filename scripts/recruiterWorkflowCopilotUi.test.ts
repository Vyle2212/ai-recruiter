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
  /from\s+["']openai["']/i,
);

assert.doesNotMatch(
  page,
  /require\(\s*["']openai["']\s*\)/i,
);

assert.doesNotMatch(
  page,
  /new\s+OpenAI\s*\(/,
);

assert.doesNotMatch(
  page,
  /\.chat\.completions\.(create|stream)\s*\(/,
);

assert.doesNotMatch(
  page,
  /\.responses\.create\s*\(/,
);

assert.match(
  workflow,
  /href="\/recruiter\/workflow\/copilot"/,
);

console.log(
  "recruiterWorkflowCopilotUi.test.ts passed",
);