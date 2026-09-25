import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  originalCvCollectionMatches,
  verifyOriginalCvCollection,
} from "../lib/originalCvCollectionManifest";

const parent = fs.mkdtempSync(path.join(os.tmpdir(), "cv-manifest-test-"));
const source = path.join(parent, "source");
const verified = path.join(parent, "verified");
const repositoryRoot = process.cwd();
fs.mkdirSync(source);
fs.mkdirSync(verified);

function measure() {
  return verifyOriginalCvCollection({
    sourceDirectory: source,
    verifiedDirectory: verified,
    repositoryRoot,
    minimumUniqueFiles: 2,
  });
}

try {
  const cvA = "Synthetic SAP FI resume\n";
  const cvB = "Synthetic SAP MM resume\n";
  for (const folder of [source, verified]) {
    fs.writeFileSync(path.join(folder, "private-a.txt"), cvA);
    fs.writeFileSync(path.join(folder, "private-b.txt"), cvB);
    fs.writeFileSync(path.join(folder, "private-a-copy.txt"), cvA);
  }
  const evidence = measure();
  assert.equal(evidence.sourceFileCount, 3);
  assert.equal(evidence.verifiedFileCount, 3);
  assert.equal(evidence.sourceUniqueFileCount, 2);
  assert.equal(evidence.verifiedUniqueFileCount, 2);
  assert.equal(
    evidence.manifestFingerprint,
    evidence.verifiedManifestFingerprint,
  );
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /private-a|private-b|SAP FI|SAP MM/,
  );
  assert.equal(
    originalCvCollectionMatches(
      Object.fromEntries(Object.entries(evidence).reverse()),
      evidence,
    ),
    true,
    "JSON property ordering is not evidence of a changed collection",
  );
  assert.equal(
    originalCvCollectionMatches(
      { ...evidence, sourceUniqueFileCount: 3 },
      evidence,
    ),
    false,
  );

  fs.writeFileSync(path.join(verified, "private-b.txt"), "Different SAP CV\n");
  assert.throws(measure, /original_cv_collection_mismatch/);
  fs.writeFileSync(path.join(verified, "private-b.txt"), cvB);

  fs.writeFileSync(path.join(verified, "private-b.txt"), cvA);
  fs.writeFileSync(path.join(source, "private-b.txt"), cvA);
  assert.throws(
    measure,
    /original_cv_collection_mismatch/,
    "matching collections with insufficient distinct CV bytes are refused",
  );
  fs.writeFileSync(path.join(source, "private-b.txt"), cvB);
  fs.writeFileSync(path.join(verified, "private-b.txt"), cvB);

  assert.throws(
    () =>
      verifyOriginalCvCollection({
        sourceDirectory: source,
        verifiedDirectory: source,
        repositoryRoot,
        minimumUniqueFiles: 2,
      }),
    /independent_copy_required/,
  );
  assert.throws(
    () =>
      verifyOriginalCvCollection({
        sourceDirectory: repositoryRoot,
        verifiedDirectory: verified,
        repositoryRoot,
        minimumUniqueFiles: 2,
      }),
    /original_cv_collection_inside_repository/,
  );

  fs.symlinkSync(
    path.join(source, "private-a.txt"),
    path.join(verified, "link.txt"),
  );
  assert.throws(measure, /original_cv_collection_symlink_refused/);
  fs.unlinkSync(path.join(verified, "link.txt"));

  fs.unlinkSync(path.join(verified, "private-a-copy.txt"));
  fs.linkSync(
    path.join(source, "private-a-copy.txt"),
    path.join(verified, "private-a-copy.txt"),
  );
  assert.throws(measure, /original_cv_collection_independent_copy_required/);
  fs.unlinkSync(path.join(verified, "private-a-copy.txt"));
  fs.copyFileSync(
    path.join(source, "private-a-copy.txt"),
    path.join(verified, "private-a-copy.txt"),
  );

  fs.writeFileSync(path.join(source, "secret-candidate.doc"), cvA);
  assert.throws(
    measure,
    (error: unknown) =>
      error instanceof Error &&
      error.message === "original_cv_collection_unsupported_entry",
    "errors must not reveal a CV filename",
  );
  fs.unlinkSync(path.join(source, "secret-candidate.doc"));
  assert.equal(measure().sourceUniqueFileCount, 2);
} finally {
  fs.rmSync(parent, { recursive: true, force: true });
}

console.log("originalCvCollectionManifest.test.ts passed");
