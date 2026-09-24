import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const ocrRelease = read("docs/cv-ocr-upload-release.md");
const originalLayout = read("docs/original-cv-layout-verification-20260915.md");
const productionTrust = read("docs/production-trust-release-promotion.md");

for (const [name, contents] of [
  ["CV OCR release", ocrRelease],
  ["original layout verification", originalLayout],
  ["production trust promotion", productionTrust],
] as const) {
  assert.match(contents, /precision-v131-production-readonly-reverification/);
  assert.match(contents, /precision-v140-resumable-admin-cv-upload/);
  assert.match(contents, /production remains (?:\*\*)?NO_GO/i);
  assert.doesNotMatch(
    contents,
    /contains_candidate_identifiers['"]?\s*:\s*true/i,
  );
  assert.ok(contents.endsWith("\n"), `${name} must end with a newline`);
}

// This long-lived release ledger was once truncated during a remote upload.
// Keep markers from its opening, middle and final historical checkpoints so a
// partial file cannot pass exact-head CI again.
assert.match(ocrRelease, /^# CV upload OCR integration/m);
assert.match(ocrRelease, /## Consolidated precision and audit review/);
assert.match(ocrRelease, /## Original-file batch checkpoint — 2026-09-16/);
assert.match(
  ocrRelease,
  /## Owned fields and recruiter-authorized project estimates — 2026-09-16/,
);
assert.match(ocrRelease, /### Recruiter-requested estimate policy/);
assert.ok(
  Buffer.byteLength(ocrRelease, "utf8") > 120_000,
  "CV OCR release ledger is unexpectedly truncated",
);

console.log("Release documentation integrity regression passed.");
