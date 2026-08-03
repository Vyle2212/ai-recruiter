import assert from "node:assert/strict";
import fs from "node:fs";

const componentPath =
  "app/recruiter/candidate360/[candidateId]/CandidateLifecyclePanel.tsx";

const pagePath =
  "app/recruiter/candidate360/[candidateId]/page.tsx";

assert.ok(fs.existsSync(componentPath));

const component = fs.readFileSync(
  componentPath,
  "utf8",
);

const page = fs.readFileSync(
  pagePath,
  "utf8",
);

assert.match(
  component,
  /Candidate Lifecycle/,
);

assert.match(
  component,
  /Pipeline progress/,
);

assert.match(
  component,
  /Activity history/,
);

assert.match(
  component,
  /lifecycle\.nextAction/,
);

assert.match(
  component,
  /lifecycle\.nextActionDueAt/,
);

assert.match(
  component,
  /lifecycle\.ownerName/,
);

assert.match(
  component,
  /lifecycle\.history/,
);

assert.match(
  page,
  /CandidateLifecyclePanel/,
);

assert.match(
  page,
  /profile\.lifecycle/,
);

console.log(
  "candidate360LifecycleUi.test.ts passed",
);