export const ADMIN_CV_CHECKPOINT_VERSION = 1 as const;
export const MAX_ADMIN_CV_BYTES = 10 * 1024 * 1024;

export type AdminCvUploadOutcome =
  | "created"
  | "updated"
  | "already_processed"
  | "incomplete_review"
  | "identity_review"
  | "source_review"
  | "non_sap_rejected"
  | "failed";

export type AdminCvDescriptor = {
  digest: string;
  name: string;
  size: number;
  lastModified: number;
  selectionIndex: number;
};

export type AdminCvPlanItem = AdminCvDescriptor & {
  disposition: "ready" | "invalid" | "exact_duplicate" | "completed";
  reason?: string;
  priorOutcome?: AdminCvUploadOutcome;
};

export type AdminCvCheckpointItem = {
  digest: string;
  outcome: AdminCvUploadOutcome;
  attempts: number;
};

export type AdminCvCheckpoint = {
  schemaVersion: typeof ADMIN_CV_CHECKPOINT_VERSION;
  selectionFingerprint: string;
  updatedAt: string;
  items: AdminCvCheckpointItem[];
};

export type AdminCvUploadResultLike = {
  ok?: unknown;
  rejected?: unknown;
  recordType?: unknown;
  errorCode?: unknown;
  ingestionAction?: unknown;
  extractionCoverage?: { status?: unknown } | null;
};

const SUPPORTED_CV = /\.(?:pdf|docx|txt)$/i;
const TERMINAL_OUTCOMES = new Set<AdminCvUploadOutcome>([
  "created",
  "updated",
  "already_processed",
  "incomplete_review",
  "identity_review",
  "source_review",
  "non_sap_rejected",
]);

export function selectionFingerprintMaterial(digests: string[]) {
  return [...digests].sort().join("|");
}

export function isTerminalAdminCvOutcome(outcome: AdminCvUploadOutcome) {
  return TERMINAL_OUTCOMES.has(outcome);
}

function invalidReason(file: AdminCvDescriptor) {
  if (!SUPPORTED_CV.test(file.name)) return "unsupported_file_type";
  if (!Number.isSafeInteger(file.size) || file.size < 1)
    return "empty_or_invalid_file";
  if (file.size > MAX_ADMIN_CV_BYTES) return "file_too_large";
  if (!/^[a-f0-9]{64}$/i.test(file.digest)) return "invalid_content_digest";
  return null;
}

/**
 * Produces an ordered, fail-closed plan for one complete admin collection.
 * Files are committed oldest-to-newest so a later version cannot be raced by
 * an older one. Exact byte duplicates are processed only once.
 */
export function buildAdminCvUploadPlan(
  files: AdminCvDescriptor[],
  checkpoint?: AdminCvCheckpoint | null,
): AdminCvPlanItem[] {
  const prior = new Map(
    checkpoint?.schemaVersion === ADMIN_CV_CHECKPOINT_VERSION
      ? checkpoint.items.map((item) => [item.digest, item])
      : [],
  );
  const newestExactCopy = new Map<string, AdminCvDescriptor>();
  for (const file of files) {
    const current = newestExactCopy.get(file.digest);
    if (
      !current ||
      file.lastModified > current.lastModified ||
      (file.lastModified === current.lastModified &&
        file.selectionIndex < current.selectionIndex)
    ) {
      newestExactCopy.set(file.digest, file);
    }
  }

  return files
    .map<AdminCvPlanItem>((file) => {
      const invalid = invalidReason(file);
      if (invalid) return { ...file, disposition: "invalid", reason: invalid };
      if (newestExactCopy.get(file.digest) !== file)
        return {
          ...file,
          disposition: "exact_duplicate",
          reason: "same_bytes_selected_more_than_once",
        };
      const previous = prior.get(file.digest);
      if (previous && isTerminalAdminCvOutcome(previous.outcome)) {
        return {
          ...file,
          disposition: "completed",
          priorOutcome: previous.outcome,
        };
      }
      return { ...file, disposition: "ready" };
    })
    .sort(
      (a, b) =>
        a.lastModified - b.lastModified || a.selectionIndex - b.selectionIndex,
    );
}

export function classifyAdminCvUploadResult(
  result: AdminCvUploadResultLike,
): AdminCvUploadOutcome {
  const action = String(result.ingestionAction || "").toLowerCase();
  const recordType = String(result.recordType || "").toUpperCase();
  const errorCode = String(result.errorCode || "").toUpperCase();
  const coverage = String(result.extractionCoverage?.status || "");

  if (action === "already_processed") return "already_processed";
  if (action === "hold_for_identity_review") return "identity_review";
  if (result.ok === true && coverage === "incomplete_needs_review")
    return "incomplete_review";
  if (result.ok === true && action === "update_existing") return "updated";
  if (result.ok === true && action === "create_new") return "created";
  if (
    recordType === "NON_SAP_CV" ||
    recordType === "NON_SAP" ||
    (result.rejected === true && recordType.includes("NON_SAP"))
  )
    return "non_sap_rejected";
  if (
    recordType === "SOURCE_REVIEW_REQUIRED" ||
    // The upload API has already archived these originals and queued them for
    // human review. Retrying cannot resolve a parser/quality rejection and
    // would stop the rest of an otherwise valid collection at this file.
    (result.rejected === true &&
      (recordType === "REJECTED_RESUME_QUALITY" ||
        recordType === "REJECTED_NOISE")) ||
    recordType === "UNKNOWN" ||
    recordType === "JD" ||
    errorCode.startsWith("CV_SOURCE_")
  )
    return "source_review";
  return "failed";
}

export function updateAdminCvCheckpoint(params: {
  checkpoint: AdminCvCheckpoint | null;
  selectionFingerprint: string;
  digest: string;
  outcome: AdminCvUploadOutcome;
  now?: string;
}): AdminCvCheckpoint {
  const { checkpoint, selectionFingerprint, digest, outcome } = params;
  const reusable =
    checkpoint?.schemaVersion === ADMIN_CV_CHECKPOINT_VERSION &&
    checkpoint.selectionFingerprint === selectionFingerprint;
  const items = new Map(
    reusable ? checkpoint.items.map((item) => [item.digest, item]) : [],
  );
  const previous = items.get(digest);
  items.set(digest, {
    digest,
    outcome,
    attempts: (previous?.attempts || 0) + 1,
  });
  return {
    schemaVersion: ADMIN_CV_CHECKPOINT_VERSION,
    selectionFingerprint,
    updatedAt: params.now || new Date().toISOString(),
    items: [...items.values()].sort((a, b) => a.digest.localeCompare(b.digest)),
  };
}

export function parseAdminCvCheckpoint(
  raw: string | null,
  selectionFingerprint: string,
): AdminCvCheckpoint | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AdminCvCheckpoint>;
    if (
      value.schemaVersion !== ADMIN_CV_CHECKPOINT_VERSION ||
      value.selectionFingerprint !== selectionFingerprint ||
      !Array.isArray(value.items)
    )
      return null;
    const items = value.items.filter((item): item is AdminCvCheckpointItem =>
      Boolean(
        item &&
          /^[a-f0-9]{64}$/i.test(String(item.digest || "")) &&
          Number.isSafeInteger(item.attempts) &&
          Number(item.attempts) > 0 &&
          [
            "created",
            "updated",
            "already_processed",
            "incomplete_review",
            "identity_review",
            "source_review",
            "non_sap_rejected",
            "failed",
          ].includes(item.outcome),
      ),
    );
    return {
      schemaVersion: ADMIN_CV_CHECKPOINT_VERSION,
      selectionFingerprint,
      updatedAt: String(value.updatedAt || ""),
      items,
    };
  } catch {
    return null;
  }
}

export function summarizeAdminCvPlan(plan: AdminCvPlanItem[]) {
  const counts = {
    total: plan.length,
    ready: 0,
    completed: 0,
    exactDuplicates: 0,
    invalid: 0,
  };
  for (const item of plan) {
    if (item.disposition === "ready") counts.ready++;
    else if (item.disposition === "completed") counts.completed++;
    else if (item.disposition === "exact_duplicate") counts.exactDuplicates++;
    else counts.invalid++;
  }
  return counts;
}

/** Only actionable files are processed; invalid, duplicate and resumed rows
 * must never act as an end-of-batch sentinel. Preserve the plan's age order. */
export function readyAdminCvUploadItems<T extends AdminCvPlanItem>(
  plan: T[],
): T[] {
  return plan.filter((item) => item.disposition === "ready");
}
