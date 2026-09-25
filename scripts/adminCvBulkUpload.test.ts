import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildAdminCvUploadPlan,
  classifyAdminCvUploadResult,
  parseAdminCvCheckpoint,
  readyAdminCvUploadItems,
  selectionFingerprintMaterial,
  summarizeAdminCvPlan,
  updateAdminCvCheckpoint,
} from "../lib/adminCvBulkUpload";

const digest = (character: string) => character.repeat(64);
const files = [
  {
    digest: digest("a"),
    name: "older.pdf",
    size: 100,
    lastModified: 100,
    selectionIndex: 0,
  },
  {
    digest: digest("b"),
    name: "latest.docx",
    size: 200,
    lastModified: 300,
    selectionIndex: 1,
  },
  {
    digest: digest("a"),
    name: "same-bytes-copy.pdf",
    size: 100,
    lastModified: 200,
    selectionIndex: 2,
  },
  {
    digest: digest("c"),
    name: "not-a-cv.exe",
    size: 300,
    lastModified: 50,
    selectionIndex: 3,
  },
];

const material = selectionFingerprintMaterial(files.map((file) => file.digest));
assert.equal(
  material,
  selectionFingerprintMaterial([...files].reverse().map((file) => file.digest)),
  "selection identity must not depend on browser ordering",
);

let checkpoint = updateAdminCvCheckpoint({
  checkpoint: null,
  selectionFingerprint: digest("f"),
  digest: digest("b"),
  outcome: "updated",
  now: "2026-09-25T00:00:00.000Z",
});
checkpoint = updateAdminCvCheckpoint({
  checkpoint,
  selectionFingerprint: digest("f"),
  digest: digest("d"),
  outcome: "failed",
  now: "2026-09-25T00:01:00.000Z",
});
const serialized = JSON.stringify(checkpoint);
assert.doesNotMatch(serialized, /older|latest|copy|\.pdf|\.docx/i);
assert.equal(parseAdminCvCheckpoint(serialized, digest("f"))?.items.length, 2);
assert.equal(parseAdminCvCheckpoint(serialized, digest("e")), null);

const plan = buildAdminCvUploadPlan(files, checkpoint);
assert.deepEqual(
  plan.map((item) => [item.name, item.disposition]),
  [
    ["not-a-cv.exe", "invalid"],
    ["older.pdf", "exact_duplicate"],
    ["same-bytes-copy.pdf", "ready"],
    ["latest.docx", "completed"],
  ],
  "valid unique files are ordered oldest-to-newest and terminal work resumes",
);
assert.deepEqual(summarizeAdminCvPlan(plan), {
  total: 4,
  ready: 1,
  completed: 1,
  exactDuplicates: 1,
  invalid: 1,
});
assert.deepEqual(
  readyAdminCvUploadItems(plan).map((item) => item.name),
  ["same-bytes-copy.pdf"],
  "an invalid row, exact duplicate and restored row cannot halt the batch",
);
const interleaved = buildAdminCvUploadPlan(
  [
    files[3],
    files[0],
    files[2],
    files[1],
    {
      digest: digest("e"),
      name: "later.pdf",
      size: 400,
      lastModified: 400,
      selectionIndex: 4,
    },
  ],
  checkpoint,
);
assert.deepEqual(
  readyAdminCvUploadItems(interleaved).map((item) => item.name),
  ["same-bytes-copy.pdf", "later.pdf"],
  "ready CVs remain oldest-first even when skipped rows are interleaved",
);

assert.equal(
  classifyAdminCvUploadResult({
    ok: true,
    ingestionAction: "create_new",
  }),
  "created",
);
assert.equal(
  classifyAdminCvUploadResult({
    ok: true,
    ingestionAction: "update_existing",
  }),
  "updated",
);
assert.equal(
  classifyAdminCvUploadResult({
    ok: true,
    ingestionAction: "update_existing",
    extractionCoverage: { status: "incomplete_needs_review" },
  }),
  "incomplete_review",
);
assert.equal(
  classifyAdminCvUploadResult({
    ingestionAction: "hold_for_identity_review",
  }),
  "identity_review",
);
assert.equal(
  classifyAdminCvUploadResult({ rejected: true, recordType: "NON_SAP_CV" }),
  "non_sap_rejected",
);
assert.equal(
  classifyAdminCvUploadResult({
    recordType: "SOURCE_REVIEW_REQUIRED",
    errorCode: "CV_SOURCE_OCR_REQUIRED",
  }),
  "source_review",
);
assert.equal(classifyAdminCvUploadResult({ errorCode: "NETWORK" }), "failed");

const page = fs.readFileSync("app/upload/page.tsx", "utf8");
assert.match(page, /sessionStorage/);
assert.match(page, /crypto\.subtle\.digest/);
assert.match(page, /contentDigest/);
assert.match(page, /buildAdminCvUploadPlan/);
assert.match(page, /lastModified/);
assert.match(page, /Pause after current CV/);
assert.match(page, /for \(const item of readyAdminCvUploadItems\(items\)\)/);
assert.match(page, /if \(outcome === "failed"\)/);
assert.doesNotMatch(
  page,
  /localStorage/,
  "private batch progress must not outlive the browser session",
);

const uploadRoute = fs.readFileSync("app/api/upload-cv/route.ts", "utf8");
assert.match(uploadRoute, /cvContentDigestMatches\(buffer, contentDigest\)/);
assert.ok(
  uploadRoute.indexOf("cvContentDigestMatches(buffer, contentDigest)") <
    uploadRoute.indexOf("prepareCandidateCv({"),
  "server must verify the exact uploaded bytes before parser or DB writes",
);
assert.match(uploadRoute, /content_digest_mismatch/);

console.log("adminCvBulkUpload.test.ts passed");
