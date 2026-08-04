import assert from "node:assert/strict";
import fs from "node:fs";

const componentPath =
  "app/recruiter/components/CopilotSuggestionList.tsx";

const dashboardPath =
  "app/recruiter/dashboard/page.tsx";

const copilotPath =
  "app/recruiter/workflow/copilot/page.tsx";

assert.ok(
  fs.existsSync(componentPath),
);

const component =
  fs.readFileSync(
    componentPath,
    "utf8",
  );

const dashboard =
  fs.readFileSync(
    dashboardPath,
    "utf8",
  );

const copilot =
  fs.readFileSync(
    copilotPath,
    "utf8",
  );

assert.match(
  component,
  /\/api\/recruiter\/copilot\/suggestions/,
);

assert.match(
  component,
  /Today’s priorities/,
);

assert.match(
  component,
  /Human controlled/,
);

assert.match(
  component,
  /No automatic action/,
);

assert.match(
  component,
  /data\.safety\.automaticActions/,
);

assert.doesNotMatch(
  component,
  /method:\s*["']POST["']/,
);

assert.doesNotMatch(
  component,
  /move-stage|rollback-stage/,
);

assert.match(
  dashboard,
  /CopilotSuggestionList/,
);

assert.match(
  dashboard,
  /<CopilotSuggestionList compact limit=\{6\}/,
);

assert.match(
  copilot,
  /CopilotSuggestionList/,
);

assert.match(
  copilot,
  /Next best recruiter actions/,
);

console.log(
  "recruiterCopilotSuggestionsUi.test.ts passed",
);