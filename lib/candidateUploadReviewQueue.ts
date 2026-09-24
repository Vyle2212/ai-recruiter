import "server-only";

import { supabase } from "./supabase";
import {
  ORIGINAL_CV_BUCKET,
  originalCvReference,
} from "./originalCvArchiveKey";

export async function recordCandidateUploadReview(input: {
  objectKey: string;
  fileName: string;
  actorUserId: string;
  reasonCodes: string[];
}) {
  const sourceFile = `${ORIGINAL_CV_BUCKET}/${input.objectKey}`;
  if (!originalCvReference(sourceFile))
    throw new Error("CV_REVIEW_REFERENCE_INVALID");
  const { error } = await supabase.from("candidate_upload_reviews").upsert(
    {
      source_file: sourceFile,
      original_filename: input.fileName.slice(0, 255),
      actor_user_id: input.actorUserId,
      reason_codes: input.reasonCodes.slice(0, 12),
      status: "pending",
    },
    { onConflict: "source_file", ignoreDuplicates: true },
  );
  if (error) throw new Error("CV_REVIEW_QUEUE_UNAVAILABLE");
}
