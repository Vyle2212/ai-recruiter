import "server-only";

import { supabase } from "./supabase";
import { saveCandidate } from "./saveCandidate";
import {
  prepareCandidateCv,
  candidateCvRejectedOriginalPolicy,
} from "./candidateCvIngestion";
import { recordCandidateUploadReview } from "./candidateUploadReviewQueue";
import { CvSourceError } from "./cvPdfOcr";
import { CANDIDATE_PARSER_VERSION } from "./candidateCanonicalPipeline";
import { ORIGINAL_CV_BUCKET } from "./originalCvArchiveKey";
import {
  processClaimedIngestionJob,
  type ClaimedIngestionJob,
  type IngestionJobDependencies,
} from "./candidateIngestionJobProcessor";

function requireData<T>(data: T, error: { message: string } | null): T {
  if (error) throw new Error("INGESTION_DATA_UNAVAILABLE");
  return data;
}

export async function claimAndProcessCandidateIngestionJobs(limit = 1) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error("INGESTION_LIMIT_INVALID");
  const claimed = await supabase.rpc("claim_candidate_ingestion_jobs", {
    p_limit: limit,
  });
  const jobs = requireData(
    claimed.data,
    claimed.error,
  ) as ClaimedIngestionJob[];
  const outcomes: Array<{ jobId: string; status: string }> = [];
  for (const job of jobs) {
    // An older parser must never silently process a job queued for a newer
    // revision. Do not ACK it; let the correct deployment reclaim its lease.
    if (job.parser_revision !== CANDIDATE_PARSER_VERSION)
      throw new Error("INGESTION_PARSER_REVISION_MISMATCH");
    const dependencies: IngestionJobDependencies = {
      download: async (objectKey) => {
        const { data, error } = await supabase.storage
          .from(ORIGINAL_CV_BUCKET)
          .download(objectKey);
        if (error || !data) throw new Error("INGESTION_SOURCE_UNAVAILABLE");
        return Buffer.from(await data.arrayBuffer());
      },
      findBySource: async (reference) => {
        const { data, error } = await supabase
          .from("candidates")
          .select("id")
          .eq("source_file", reference)
          .limit(2);
        requireData(data, error);
        if ((data?.length || 0) > 1)
          throw new Error("INGESTION_SOURCE_AMBIGUOUS");
        return data?.[0] ?? null;
      },
      prepare: async (bytes, filename) => {
        try {
          const prepared = await prepareCandidateCv({
            buffer: bytes,
            fileName: filename,
            source: "admin_upload",
          });
          if (!prepared.accepted)
            return {
              accepted: false as const,
              rejectionType: prepared.rejectionType,
              reasonCodes: candidateCvRejectedOriginalPolicy(
                prepared.rejectionType,
              ).reasonCodes,
            };
          return {
            accepted: true as const,
            candidatePayload: prepared.candidatePayload,
            needsReview:
              prepared.extractionCoverage.status !==
                "complete_for_validation" ||
              prepared.parserQuality.needsManualReview ||
              prepared.sourceExtraction.method === "ocr",
          };
        } catch (error) {
          if (error instanceof CvSourceError)
            return {
              accepted: false as const,
              rejectionType: "source" as const,
              reasonCodes: [error.code],
            };
          throw error;
        }
      },
      save: (payload, reference) =>
        saveCandidate({ ...payload, archivedCvReference: reference }),
      review: (claimedJob, reasonCodes) =>
        recordCandidateUploadReview({
          objectKey: claimedJob.source_file.slice(
            ORIGINAL_CV_BUCKET.length + 1,
          ),
          fileName: claimedJob.original_filename,
          actorUserId: claimedJob.actor_user_id,
          reasonCodes,
        }),
      renew: async (id, token) => {
        const { data, error } = await supabase.rpc(
          "renew_candidate_ingestion_job",
          { p_job_id: id, p_lease_token: token },
        );
        return requireData(data, error) === true;
      },
      finish: async (id, token, outcome) => {
        const { data, error } = await supabase.rpc(
          "finish_candidate_ingestion_job",
          {
            p_job_id: id,
            p_lease_token: token,
            p_status: outcome.status,
            p_result_candidate_id: outcome.candidateId ?? null,
            p_outcome_code: outcome.outcomeCode,
          },
        );
        return requireData(data, error) === true;
      },
    };
    const result = await processClaimedIngestionJob(job, dependencies);
    outcomes.push({ jobId: job.id, status: result.status });
  }
  return outcomes;
}
