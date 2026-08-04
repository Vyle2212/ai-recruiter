import assert from "node:assert/strict";
import fs from "node:fs";

const timelinePath =
  "app/recruiter/candidate360/[candidateId]/CandidateLifecycleTimeline.tsx";

const panelPath =
  "app/recruiter/candidate360/[candidateId]/CandidateLifecyclePanel.tsx";

assert.ok(fs.existsSync(timelinePath));

const timeline =
  fs.readFileSync(timelinePath, "utf8");

const panel =
  fs.readFileSync(panelPath, "utf8");

assert.match(
  timeline,
  /CandidateLifecycleEvent/,
);

assert.match(
  timeline,
  /Lifecycle timeline/,
);

assert.match(
  timeline,
  /Activity feed/,
);

assert.match(
  timeline,
  /event\.fromStage/,
);

assert.match(
  timeline,
  /event\.toStage/,
);

assert.match(
  timeline,
  /event\.actorName/,
);

assert.match(
  timeline,
  /event\.occurredAt/,
);

assert.match(
  timeline,
  /event\.note/,
);

assert.match(
  timeline,
  /lifecycle-rollback:/,
);

assert.match(
  timeline,
  /No lifecycle events have been recorded yet/,
);

assert.doesNotMatch(
  timeline,
  /fetch\(|POST|execute:\s*true/,
);

assert.match(
  panel,
  /CandidateLifecycleTimeline/,
);

assert.match(
  panel,
  /history=\{lifecycle\.history\}/,
);

console.log(
  "candidateLifecycleTimelineUi.test.ts passed",
);