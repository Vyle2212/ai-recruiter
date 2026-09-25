import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { MAX_ORIGINAL_BYTES } from "./originalCvArchiveKey";
import type { ProductionRecoveryEvidence } from "./productionCutoverPlan";

const SUPPORTED_CV = /\.(?:pdf|docx|doc|txt)$/i;
const MAX_COLLECTION_FILES = 100_000;

class OriginalCvCollectionError extends Error {}

function fail(code: string): never {
  throw new OriginalCvCollectionError(code);
}

function privateDirectory(directory: string, repositoryRoot: string) {
  const real = fs.realpathSync(directory);
  const repository = fs.realpathSync(repositoryRoot);
  const relative = path.relative(repository, real);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    fail("original_cv_collection_inside_repository");
  if (!fs.statSync(real).isDirectory())
    fail("original_cv_collection_not_directory");
  return real;
}

function scanDirectory(directory: string) {
  const digests: string[] = [];
  const fileIdentities = new Set<string>();
  const walk = (current: string) => {
    for (const name of fs.readdirSync(current).sort()) {
      // Finder/Windows folder metadata is not a CV and must not count.
      if (name === ".DS_Store" || name === "Thumbs.db") continue;
      const filePath = path.join(current, name);
      const stat = fs.lstatSync(filePath);
      if (stat.isSymbolicLink()) fail("original_cv_collection_symlink_refused");
      if (stat.isDirectory()) {
        walk(filePath);
        continue;
      }
      if (!stat.isFile() || !SUPPORTED_CV.test(name))
        fail("original_cv_collection_unsupported_entry");
      if (stat.size < 1 || stat.size > MAX_ORIGINAL_BYTES)
        fail("original_cv_collection_invalid_size");
      if (digests.length >= MAX_COLLECTION_FILES)
        fail("original_cv_collection_too_large");
      if (stat.ino > 0) fileIdentities.add(`${stat.dev}:${stat.ino}`);
      const bytes = fs.readFileSync(filePath);
      if (bytes.length !== stat.size)
        fail("original_cv_collection_changed_during_scan");
      digests.push(createHash("sha256").update(bytes).digest("hex"));
    }
  };
  walk(directory);
  digests.sort();
  return {
    fileCount: digests.length,
    uniqueFileCount: new Set(digests).size,
    fileIdentities,
    // A multiset digest detects a missing or substituted original even when
    // total and unique counts stay the same. Never serialize filenames/text.
    fingerprint: createHash("sha256")
      .update(JSON.stringify(digests), "utf8")
      .digest("hex"),
  };
}

/** Read two separate offline copies without exposing CV names or contents. */
export function verifyOriginalCvCollection(input: {
  sourceDirectory: string;
  verifiedDirectory: string;
  repositoryRoot: string;
  minimumUniqueFiles?: number;
}): ProductionRecoveryEvidence["originalCvCollection"] {
  try {
    const source = privateDirectory(
      input.sourceDirectory,
      input.repositoryRoot,
    );
    const verified = privateDirectory(
      input.verifiedDirectory,
      input.repositoryRoot,
    );
    if (source === verified)
      fail("original_cv_collection_independent_copy_required");
    const first = scanDirectory(source);
    const second = scanDirectory(verified);
    if (
      [...first.fileIdentities].some((identity) =>
        second.fileIdentities.has(identity),
      )
    )
      fail("original_cv_collection_independent_copy_required");
    const minimum = input.minimumUniqueFiles ?? 970;
    if (
      !Number.isSafeInteger(minimum) ||
      minimum < 1 ||
      first.uniqueFileCount < minimum ||
      first.fileCount !== second.fileCount ||
      first.uniqueFileCount !== second.uniqueFileCount ||
      first.fingerprint !== second.fingerprint
    )
      fail("original_cv_collection_mismatch");
    return {
      retainedOutsideSupabase: true,
      manifestFingerprint: first.fingerprint,
      verifiedManifestFingerprint: second.fingerprint,
      sourceFileCount: first.fileCount,
      verifiedFileCount: second.fileCount,
      sourceUniqueFileCount: first.uniqueFileCount,
      verifiedUniqueFileCount: second.uniqueFileCount,
    };
  } catch (error) {
    if (error instanceof OriginalCvCollectionError) throw error;
    // Filesystem errors can include candidate names; never log the raw error.
    fail("original_cv_collection_scan_failed");
  }
}

export function originalCvCollectionMatches(
  provided: unknown,
  measured: ProductionRecoveryEvidence["originalCvCollection"],
) {
  if (!provided || typeof provided !== "object" || Array.isArray(provided))
    return false;
  const fields = Object.entries(measured);
  const values = provided as Record<string, unknown>;
  return (
    Object.keys(values).length === fields.length &&
    fields.every(([field, value]) => values[field] === value)
  );
}
