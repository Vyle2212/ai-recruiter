import assert from "node:assert/strict";
import fs from "node:fs";

const targets = [
  "app/recruiter/workflow/automation/page.tsx",
  "app/recruiter/dashboard/page.tsx",
];

for (const path of targets) {
  assert.ok(
    fs.existsSync(path),
    `Expected UI file to exist: ${path}`,
  );

  const source =
    fs.readFileSync(path, "utf8");

  assert.doesNotMatch(
    source,
    /ÃƒÆ/,
    `${path} must not contain mojibake text`,
  );

  assert.match(
    source,
    /·/,
    `${path} should retain readable middle-dot separators`,
  );
}

console.log(
  "recruiterUiEncoding.test.ts passed",
);