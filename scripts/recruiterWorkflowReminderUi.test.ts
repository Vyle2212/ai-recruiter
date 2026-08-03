import assert from "node:assert/strict";
import fs from "node:fs";

const path =
  "app/recruiter/workflow/WorkflowKanbanBoard.tsx";

const source =
  fs.readFileSync(path, "utf8");

assert.match(
  source,
  /evaluateCandidateLifecycleReminder/,
);

assert.match(
  source,
  /reminder\?\.effectivePriority/,
);

assert.match(
  source,
  /reminder\.reminderLabel/,
);

assert.match(
  source,
  /reminder\.dueStatus/,
);

assert.match(
  source,
  /reminder\?\.requiresAttention/,
);

assert.doesNotMatch(
  source,
  /candidateDbWrites\s*:\s*[1-9]/,
);

console.log(
  "recruiterWorkflowReminderUi.test.ts passed",
);