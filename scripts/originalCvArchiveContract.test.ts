import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_ORIGINAL_BYTES,
  originalCvObjectKey,
  originalCvReference,
} from "../lib/originalCvArchiveKey";
import { commitCandidateWithArchivedCv } from "../lib/originalCvArchiveCommit";

const cv = Buffer.from("synthetic resume fixture");
for (const [name, type] of [
  ["Private Applicant.pdf", "application/pdf"],
  [
    "Private Applicant.DOCX",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["Private Applicant.txt", "text/plain"],
] as const) {
  const { objectKey, contentType } = originalCvObjectKey(name, cv);
  assert.equal(contentType, type);
  assert.match(objectKey, /^[0-9a-f-]{36}\.(?:pdf|docx|txt)$/);
  assert.ok(!objectKey.includes("Applicant"));
  assert.equal(
    originalCvReference(`candidate-original-cvs/${objectKey}`),
    `candidate-original-cvs/${objectKey}`,
  );
}
assert.throws(
  () => originalCvObjectKey("candidate.pdf", Buffer.alloc(0)),
  /CV_ORIGINAL_INVALID/,
);
assert.throws(
  () =>
    originalCvObjectKey("candidate.pdf", Buffer.alloc(MAX_ORIGINAL_BYTES + 1)),
  /CV_ORIGINAL_INVALID/,
);
assert.throws(
  () => originalCvObjectKey("candidate.html", cv),
  /CV_ORIGINAL_INVALID/,
);
assert.equal(
  originalCvReference("candidate-original-cvs/../../public.pdf"),
  undefined,
);
assert.equal(
  originalCvReference("candidate-original-cvs/applicant-name.pdf"),
  undefined,
);

const upload = fs.readFileSync("app/api/upload-cv/route.ts", "utf8");
assert.match(upload, /commitCandidateWithArchivedCv\(/);
const ref = "candidate-original-cvs/00000000-0000-4000-8000-000000000000.pdf";
async function verifyArchiveCommit() {
  const archive = async () => ({
    reference: ref,
    objectKey: "00000000-0000-4000-8000-000000000000.pdf",
  });
  let discarded = 0;
  const discard = async () => {
    discarded++;
  };
  await assert.rejects(
    commitCandidateWithArchivedCv(
      async () => {
        throw Error("storage unavailable");
      },
      async () => {
        throw Error("save must not run");
      },
      discard,
    ),
    /storage unavailable/,
  );
  await assert.rejects(
    commitCandidateWithArchivedCv(
      archive,
      async () => {
        throw Error("ambiguous database failure");
      },
      discard,
    ),
    /ambiguous database failure/,
  );
  assert.equal(
    discarded,
    0,
    "ambiguous DB failure must never delete a possibly linked original",
  );
  await assert.rejects(
    commitCandidateWithArchivedCv(
      archive,
      async () => ({ source_file: "" }),
      discard,
    ),
    /CV_ORIGINAL_REFERENCE_MISMATCH/,
  );
  assert.equal(discarded, 0, "readback mismatch keeps the private original");
  assert.equal(
    (
      await commitCandidateWithArchivedCv(
        archive,
        async (reference) => ({ source_file: reference }),
        discard,
      )
    ).source_file,
    ref,
  );
  await commitCandidateWithArchivedCv(
    archive,
    async () => ({ skipped: true }),
    discard,
  );
  assert.equal(
    discarded,
    1,
    "explicitly rejected save removes its unlinked original",
  );
}
const save = fs.readFileSync("lib/saveCandidate.ts", "utf8");
assert.match(
  save,
  /source_file: originalCvReference\(cleanCandidate\.archivedCvReference\)/,
);
assert.match(save, /"source_file",/);
const sql = fs.readFileSync(
  "supabase/manual/202609240003_private_original_cv_archive.sql",
  "utf8",
);
assert.match(sql, /'candidate-original-cvs', 'candidate-original-cvs', false/);
assert.doesNotMatch(sql, /CREATE POLICY|TO authenticated|TO anon/i);
const readback = fs.readFileSync(
  "supabase/manual/202609240004_private_original_cv_archive_readback.sql",
  "utf8",
);
assert.match(readback, /BEGIN READ ONLY/);
assert.match(readback, /bucket\.public IS DISTINCT FROM false/);
assert.match(readback, /roles && ARRAY\['public', 'anon', 'authenticated'\]/);
verifyArchiveCommit().then(
  () => console.log("Original CV archive contract passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
