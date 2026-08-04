import assert from "node:assert/strict";
import fs from "node:fs";

const recruiterEntryPath =
  "app/recruiter/page.tsx";

const releaseGateRedirectPath =
  "app/recruiter/workflow/execution-release-gate/page.tsx";

assert.ok(
  fs.existsSync(recruiterEntryPath),
  "Recruiter entry route must exist.",
);

assert.ok(
  fs.existsSync(releaseGateRedirectPath),
  "Release Gate compatibility route must exist.",
);

const recruiterEntry =
  fs.readFileSync(recruiterEntryPath, "utf8");

const releaseGateRedirect =
  fs.readFileSync(releaseGateRedirectPath, "utf8");

assert.match(
  recruiterEntry,
  /redirect\(["']\/recruiter\/dashboard["']\)/,
);

assert.match(
  releaseGateRedirect,
  /redirect\(["']\/recruiter\/workflow\/automation\/release-gate["']\)/,
);

console.log(
  "recruiterEntryRoutes.test.ts passed",
);