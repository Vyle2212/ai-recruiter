import assert from "node:assert/strict";
import fs from "node:fs";

const routePath =
  "app/api/recruiter/copilot/chat/route.ts";

const source =
  fs.readFileSync(routePath, "utf8");

assert.match(
  source,
  /appendRecruiterCopilotExchange/,
);

assert.match(
  source,
  /const answer\s*=\s*answerRecruiterCopilotQuestion/,
);

assert.match(
  source,
  /conversationId:\s*string \| null/,
);

assert.match(
  source,
  /saved:\s*boolean/,
);

assert.match(
  source,
  /saveError:\s*string \| null/,
);

assert.match(
  source,
  /try\s*{[\s\S]*appendRecruiterCopilotExchange/,
);

assert.match(
  source,
  /catch\s*\(historyError\)/,
);

assert.match(
  source,
  /saved:\s*false/,
);

assert.match(
  source,
  /return NextResponse\.json\(\{[\s\S]*\.\.\.answer,[\s\S]*conversation/,
);

const answerIndex =
  source.indexOf(
    "answerRecruiterCopilotQuestion",
  );

const historyIndex =
  source.indexOf(
    "appendRecruiterCopilotExchange({",
  );

assert.ok(
  answerIndex >= 0 &&
    historyIndex > answerIndex,
  "Answer must be generated before history persistence.",
);

assert.doesNotMatch(
  source,
  /openai|chat\.completions|responses\.create/i,
);

console.log(
  "recruiterCopilotChatHistoryIntegration.test.ts passed",
);