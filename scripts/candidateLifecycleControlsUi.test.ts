import assert from "node:assert/strict";
import fs from "node:fs";

const controlsPath =
  "app/recruiter/candidate360/[candidateId]/CandidateLifecycleControls.tsx";

const panelPath =
  "app/recruiter/candidate360/[candidateId]/CandidateLifecyclePanel.tsx";

assert.ok(
  fs.existsSync(controlsPath),
);

const controls =
  fs.readFileSync(
    controlsPath,
    "utf8",
  );

const panel =
  fs.readFileSync(
    panelPath,
    "utf8",
  );

assert.match(
  controls,
  /"use client"/,
);

assert.match(
  controls,
  /Preview move/,
);

assert.match(
  controls,
  /Confirm move/,
);

assert.match(
  controls,
  /Preview rollback/,
);

assert.match(
  controls,
  /Confirm rollback/,
);

assert.match(
  controls,
  /expectedStage/,
);

assert.match(
  controls,
  /execute: false/,
);

assert.match(
  controls,
  /execute: true/,
);

assert.match(
  controls,
  /\/api\/recruiter\/workflow\/move-stage/,
);

assert.match(
  controls,
  /\/api\/recruiter\/workflow\/rollback-stage/,
);

assert.match(
  controls,
  /window\.location\.reload/,
);

assert.match(
  panel,
  /CandidateLifecycleControls/,
);

assert.match(
  panel,
  /lifecycle=\{lifecycle\}/,
);

console.log(
  "candidateLifecycleControlsUi.test.ts passed",
);