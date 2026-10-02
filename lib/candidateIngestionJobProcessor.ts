import { cvContentDigestMatches } from "./serverCvContentDigest";
import {
  ORIGINAL_CV_BUCKET,
  originalCvReference,
} from "./originalCvArchiveKey";

export type ClaimedIngestionJob = {
  id: string;
  actor_user_id: string;
  source_file: string;
  original_filename: string;
  content_sha256: string;
  parser_revision: string;
  byte_size: number;
  attempts: number;
  lease_token: string;
};

type OutcomeCode =
  | "created"
  | "updated"
  | "already_processed"
  | "incomplete_review"
  | "identity_review"
  | "source_review"
  | "non_sap_rejected"
  | "processing_failure";
type Finish = {
  status: "completed" | "review" | "queued";
  candidateId?: string;
  outcomeCode: OutcomeCode;
};
type Prepared =
  | {
      accepted: false;
      rejectionType: "non_sap_or_non_cv" | "resume_quality" | "source";
      reasonCodes: string[];
    }
  | {
      accepted: true;
      candidatePayload: Record<string, unknown>;
      needsReview: boolean;
    };
type Saved = {
  id?: string;
  source_file?: string;
  ingestion_action?: string;
  skipped?: boolean;
  rejected_noise?: boolean;
  status?: string;
  ingestion_reasons?: string[];
};

export type IngestionJobDependencies = {
  download: (objectKey: string) => Promise<Buffer>;
  findBySource: (reference: string) => Promise<{ id: string } | null>;
  prepare: (bytes: Buffer, filename: string) => Promise<Prepared>;
  save: (payload: Record<string, unknown>, reference: string) => Promise<Saved>;
  review: (job: ClaimedIngestionJob, reasonCodes: string[]) => Promise<void>;
  renew: (id: string, token: string) => Promise<boolean>;
  finish: (id: string, token: string, outcome: Finish) => Promise<boolean>;
};

/** A single claimed document. Errors retry with bounded backoff in the SQL ledger.
 * A failed or ambiguous save retains the original, and readback precedes retry.
 */
export async function processClaimedIngestionJob(
  job: ClaimedIngestionJob,
  deps: IngestionJobDependencies,
): Promise<Finish> {
  const reference = originalCvReference(job.source_file);
  if (!reference || !reference.startsWith(`${ORIGINAL_CV_BUCKET}/`))
    throw new Error("INGESTION_JOB_REFERENCE_INVALID");
  if (!job.lease_token) throw new Error("INGESTION_JOB_LEASE_MISSING");
  if (!Number.isInteger(job.attempts) || job.attempts < 1 || job.attempts > 5)
    throw new Error("INGESTION_JOB_ATTEMPTS_INVALID");

  let leaseLost = false;
  let renewal: Promise<void> | undefined;
  const renew = async () => {
    if (leaseLost) throw new Error("INGESTION_JOB_LEASE_LOST");
    if (!renewal) {
      renewal = (async () => {
        if (!(await deps.renew(job.id, job.lease_token))) {
          leaseLost = true;
          throw new Error("INGESTION_JOB_LEASE_LOST");
        }
      })().finally(() => {
        renewal = undefined;
      });
    }
    await renewal;
  };
  // Refresh while extraction is running. The explicit renew before each write
  // also checks for a lease lost between timer ticks.
  const heartbeat = setInterval(() => {
    void renew().catch(() => {
      leaseLost = true;
    });
  }, 60_000);
  heartbeat.unref?.();
  const finish = async (outcome: Finish) => {
    await renew();
    if (!(await deps.finish(job.id, job.lease_token, outcome)))
      throw new Error("INGESTION_JOB_ACK_LOST");
    return outcome;
  };
  const review = async (codes: string[], outcomeCode: OutcomeCode) => {
    await renew();
    await deps.review(job, codes);
    return finish({ status: "review", outcomeCode });
  };

  try {
    await renew();
    const bytes = await deps.download(
      reference.slice(ORIGINAL_CV_BUCKET.length + 1),
    );
    if (
      bytes.length !== job.byte_size ||
      !cvContentDigestMatches(bytes, job.content_sha256)
    )
      return await review(["content_digest_mismatch"], "source_review");

    // An expired lease or ambiguous DB response can leave a committed save.
    // Never parse/save again if the original already belongs to a candidate.
    const existing = await deps.findBySource(reference);
    if (existing)
      return await finish({
        status: "completed",
        candidateId: existing.id,
        outcomeCode: "already_processed",
      });

    const prepared = await deps.prepare(bytes, job.original_filename);
    if (!prepared.accepted)
      return await review(
        prepared.reasonCodes,
        prepared.rejectionType === "source"
          ? "source_review"
          : prepared.rejectionType === "resume_quality"
            ? "incomplete_review"
            : "non_sap_rejected",
      );

    await renew();
    // Read again after a potentially slow parse. A lease alone is insufficient
    // to fence an old in-flight DB write, so activation needs a DB uniqueness
    // invariant on source_file and an integration acceptance test.
    const afterParse = await deps.findBySource(reference);
    if (afterParse)
      return await finish({
        status: "completed",
        candidateId: afterParse.id,
        outcomeCode: "already_processed",
      });

    const saved = await deps.save(prepared.candidatePayload, reference);
    if (saved.ingestion_action === "hold_for_identity_review")
      return await review(
        saved.ingestion_reasons?.length
          ? saved.ingestion_reasons
          : ["identity_review_required"],
        "identity_review",
      );
    if (
      saved.skipped ||
      saved.rejected_noise ||
      saved.status === "rejected_noise"
    )
      return await review(["save_gate_rejected"], "incomplete_review");
    if (!saved.id || saved.source_file !== reference)
      throw new Error("INGESTION_JOB_SAVE_READBACK_MISMATCH");
    return await finish({
      status: "completed",
      candidateId: saved.id,
      outcomeCode: prepared.needsReview
        ? "incomplete_review"
        : saved.ingestion_action === "update_existing"
          ? "updated"
          : "created",
    });
  } catch (error) {
    if (
      leaseLost ||
      (error instanceof Error &&
        /INGESTION_JOB_(?:LEASE_LOST|ACK_LOST)/.test(error.message))
    )
      throw error;
    if (error instanceof Error) {
      if (
        error.message === "INGESTION_SOURCE_OWNERSHIP_CONFLICT" ||
        error.message === "INGESTION_SOURCE_AMBIGUOUS" ||
        error.message === "INGESTION_SOURCE_HISTORY_LIMIT"
      )
        return await review(["source_history_conflict"], "source_review");
      if (error.message === "INGESTION_SOURCE_CANDIDATE_MISSING")
        return await review(["source_candidate_missing"], "source_review");
    }
    // The final attempt must leave a private, actionable review record rather
    // than reporting queued while the SQL ledger silently marks it failed.
    if (job.attempts >= 5)
      return await review(["processing_retry_exhausted"], "processing_failure");
    // If review or ACK failed, do not mark a terminal failure: on retry the
    // source readback recognizes any committed candidate.
    await finish({ status: "queued", outcomeCode: "processing_failure" });
    return { status: "queued", outcomeCode: "processing_failure" };
  } finally {
    clearInterval(heartbeat);
  }
}
