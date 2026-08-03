import assert from "node:assert/strict";
import fs from "node:fs";

const hydration = fs.readFileSync(
  "lib/recruiterWorkflowStateHydration.ts",
  "utf8",
);

const page = fs.readFileSync(
  "app/recruiter/workflow/page.tsx",
  "utf8",
);

assert.match(hydration, /buildCandidateLifecycleRecord/);
assert.match(hydration, /lifecycleFromPersistedState/);
assert.match(hydration, /enrichActionQueueWithLifecycle/);
assert.match(hydration, /lifecycle,/);

assert.match(page, /CandidateLifecycleRecord/);
assert.match(page, /item\.lifecycle\?\.stage/);
assert.match(page, /item\.lifecycle\?\.ownerName/);
assert.match(page, /item\.lifecycle\?\.nextAction/);
assert.match(page, /item\.lifecycle\?\.nextActionDueAt/);
assert.match(page, /Pipeline stage/);

console.log(
  "recruiterWorkflowLifecycle.test.ts passed",
);