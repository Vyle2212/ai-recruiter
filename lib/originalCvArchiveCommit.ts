export type ArchivedCv = { reference: string; objectKey: string };

// Storage and Postgres cannot share one transaction. If the database call
// fails ambiguously, retain a private orphan: deleting it could erase the
// original for a candidate whose save actually committed.
export async function commitCandidateWithArchivedCv<
  T extends {
    source_file?: unknown;
    skipped?: unknown;
    rejected_noise?: unknown;
    status?: unknown;
  },
>(
  archive: () => Promise<ArchivedCv>,
  save: (reference: string) => Promise<T>,
  discardRejected: (objectKey: string) => Promise<void>,
): Promise<T> {
  const uploaded = await archive();
  const result = await save(uploaded.reference);
  if (
    result?.skipped ||
    result?.rejected_noise ||
    String(result?.status || "").toLowerCase() === "rejected_noise"
  ) {
    try {
      await discardRejected(uploaded.objectKey);
    } catch {
      /* private orphan */
    }
    return result;
  }
  if (result?.source_file !== uploaded.reference) {
    throw new Error("CV_ORIGINAL_REFERENCE_MISMATCH");
  }
  return result;
}
