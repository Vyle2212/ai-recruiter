import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ADMIN_CV_CHECKPOINT_VERSION,
  buildAdminCvUploadPlan,
  MAX_ADMIN_CV_BYTES,
  classifyAdminCvUploadResult,
  parseAdminCvCheckpoint,
  readyAdminCvUploadItems,
  selectionFingerprintMaterial,
  summarizeAdminCvPlan,
  updateAdminCvCheckpoint,
} from "../lib/adminCvBulkUpload";
import { CANDIDATE_CV_INGESTION_REVISION } from "../lib/cvIngestionRevision";

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

assert.equal(
  buildAdminCvUploadPlan(
    [
      {
        digest: digest("d"),
        name: "legacy.doc",
        size: 256,
        lastModified: 1,
        selectionIndex: 0,
      },
    ],
    null,
  )[0]?.disposition,
  "ready",
  "the shared bulk uploader accepts legacy Word CVs for server-side validation",
);
assert.equal(
  buildAdminCvUploadPlan(
    [
      {
        digest: digest("e"),
        name: "legacy.rtf",
        size: 256,
        lastModified: 1,
        selectionIndex: 0,
      },
    ],
    null,
  )[0]?.disposition,
  "ready",
  "the shared bulk uploader sends RTF to the same parser",
);
assert.equal(
  buildAdminCvUploadPlan([
    {
      digest: digest("f"),
      name: "large.docx",
      size: 14_855_900,
      lastModified: 1,
      selectionIndex: 0,
    },
  ])[0]?.disposition,
  "ready",
);
assert.equal(
  buildAdminCvUploadPlan([
    {
      digest: digest("f"),
      name: "too-large.docx",
      size: MAX_ADMIN_CV_BYTES + 1,
      lastModified: 1,
      selectionIndex: 0,
    },
  ])[0]?.reason,
  "file_too_large",
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
assert.equal(checkpoint.schemaVersion, ADMIN_CV_CHECKPOINT_VERSION);
assert.equal(checkpoint.parserRevision, CANDIDATE_CV_INGESTION_REVISION);
assert.doesNotMatch(serialized, /older|latest|copy|\.pdf|\.docx/i);
assert.equal(parseAdminCvCheckpoint(serialized, digest("f"))?.items.length, 2);
assert.equal(parseAdminCvCheckpoint(serialized, digest("e")), null);
const outdated = { ...checkpoint, parserRevision: "cv-ingestion-older" };
assert.equal(
  parseAdminCvCheckpoint(JSON.stringify(outdated), digest("f")),
  null,
);
assert.equal(
  buildAdminCvUploadPlan([files[1]], outdated as typeof checkpoint)[0]
    ?.disposition,
  "ready",
  "a newer parser must reconsider CVs completed by an older parser",
);
assert.equal(
  updateAdminCvCheckpoint({
    checkpoint: outdated as typeof checkpoint,
    selectionFingerprint: digest("f"),
    digest: digest("d"),
    outcome: "created",
  }).items.length,
  1,
);
assert.equal(
  parseAdminCvCheckpoint(
    JSON.stringify({
      ...checkpoint,
      schemaVersion: 1,
      parserRevision: undefined,
    }),
    digest("f"),
  ),
  null,
);

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
assert.equal(
  classifyAdminCvUploadResult({ rejected: true, recordType: "UNKNOWN" }),
  "source_review",
);
assert.equal(
  classifyAdminCvUploadResult({ rejected: true, recordType: "JD" }),
  "source_review",
);
assert.equal(
  classifyAdminCvUploadResult({
    rejected: true,
    recordType: "REJECTED_RESUME_QUALITY",
  }),
  "source_review",
  "a preserved CV awaiting quality review must not repeatedly stop the batch",
);
assert.equal(
  classifyAdminCvUploadResult({
    rejected: true,
    recordType: "REJECTED_NOISE",
  }),
  "source_review",
  "a preserved CV rejected by the save gate must not be uploaded again",
);
assert.equal(
  classifyAdminCvUploadResult({
    rejected: false,
    recordType: "REJECTED_NOISE",
  }),
  "failed",
  "only an explicit archived-and-rejected outcome can be marked for review",
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
