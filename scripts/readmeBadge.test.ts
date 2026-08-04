import assert from "node:assert/strict";
import fs from "node:fs";

const source =
  fs.readFileSync(
    "README.md",
    "utf8",
  );

assert.match(
  source,
  /workflow-platform-ci\.yml\/badge\.svg/,
);

assert.match(
  source,
  /Workflow Platform CI/,
);

console.log(
  "readmeBadge.test.ts passed",
);
