import { NextRequest, NextResponse } from "next/server";

import {
  authorizeCandidateCvUpload,
  candidateCvUploadRuntimeEnabled,
  validateCandidateCvWriteRequest,
} from "@/lib/candidateCvAuthorization";
import {
  candidateCvRejectedOriginalPolicy,
  prepareCandidateCv,
} from "@/lib/candidateCvIngestion";
import { evaluateCandidateProfileCompletion } from "@/lib/candidateProfileIngestion";
import { recordCandidateUploadReview } from "@/lib/candidateUploadReviewQueue";
import { CvSourceError } from "@/lib/cvPdfOcr";
import {
  MAX_ORIGINAL_BYTES,
  ORIGINAL_CV_BUCKET,
  ownedOriginalCvObjectKey,
} from "@/lib/originalCvArchiveKey";
import { saveCandidate } from "@/lib/saveCandidate";
import { supabase } from "@/lib/supabase";
import {
  cvContentDigestMatches,
  normalizeCvContentDigest,
} from "@/lib/serverCvContentDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, Origin",
};

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  if (!candidateCvUploadRuntimeEnabled())
    return responseError("Candidate CV upload is not enabled.", 503);

  const rejectedWrite = validateCandidateCvWriteRequest(request);
  if (rejectedWrite)
    return responseError(rejectedWrite.code, rejectedWrite.status);

  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return responseError(authorization.code, authorization.status);

  let input: {
    fileName?: unknown;
    objectKey?: unknown;
    size?: unknown;
    contentDigest?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return responseError("Invalid upload request.", 400);
  }

  const fileName = typeof input.fileName === "string" ? input.fileName : "";
  const objectKey = typeof input.objectKey === "string" ? input.objectKey : "";
  const contentDigest = normalizeCvContentDigest(input.contentDigest);
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (
    !contentDigest ||
    !ownedOriginalCvObjectKey(authorization.scope.authUserId, objectKey) ||
    !Number.isSafeInteger(input.size) ||
    Number(input.size) < 1 ||
    Number(input.size) > MAX_ORIGINAL_BYTES ||
    objectKey.split(".").at(-1)?.toLowerCase() !== extension
  ) {
    return responseError("Invalid candidate CV reference.", 400);
  }

  const sourceReference = `${ORIGINAL_CV_BUCKET}/${objectKey}`;
  const downloaded = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .download(objectKey);
  if (downloaded.error || !downloaded.data)
    return responseError("Original CV was not found in private storage.", 404);

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  if (buffer.length !== input.size || buffer.length > MAX_ORIGINAL_BYTES) {
    try {
      await recordCandidateUploadReview({
        objectKey,
        fileName,
        actorUserId: authorization.scope.authUserId,
        reasonCodes: ["content_size_mismatch"],
      });
    } catch {
      return responseError("candidate_cv_review_queue_unavailable", 503);
    }
    return responseError("candidate_cv_content_size_mismatch", 409);
  }

  if (!cvContentDigestMatches(buffer, contentDigest)) {
    try {
      await recordCandidateUploadReview({
        objectKey,
        fileName,
        actorUserId: authorization.scope.authUserId,
        reasonCodes: ["content_digest_mismatch"],
      });
    } catch {
      return responseError("candidate_cv_review_queue_unavailable", 503);
    }
    return responseError("candidate_cv_content_digest_mismatch", 409);
  }

  // A replay is successful only if the linked original still exists and its
  // bytes match the digest. Never acknowledge an absent or changed original.
  if (authorization.scope.candidateSourceFile === sourceReference) {
    return NextResponse.json(
      {
        accepted: true,
        alreadyProcessed: true,
        candidateId: authorization.scope.candidateId,
        cvVersion: authorization.scope.candidateCvVersion,
        extractionCoverageStatus: authorization.scope.extractionCoverageStatus,
        profileStatus: authorization.scope.profileConfirmationStatus,
        searchable: false,
        confirmationRequired: true,
      },
      { headers: privateHeaders },
    );
  }

  try {
    const prepared = await prepareCandidateCv({
      buffer,
      fileName,
      source: "candidate_upload",
    });
    if (!prepared.accepted) {
      const originalPolicy = candidateCvRejectedOriginalPolicy(
        prepared.rejectionType,
      );
      try {
        await recordCandidateUploadReview({
          objectKey,
          fileName,
          actorUserId: authorization.scope.authUserId,
          reasonCodes: originalPolicy.reasonCodes,
        });
      } catch {
        return responseError("candidate_cv_review_queue_unavailable", 503);
      }
      return NextResponse.json(
        {
          accepted: false,
          recordType: prepared.recordType,
          reason: prepared.reason,
          signals: prepared.signals,
          originalPreserved: true,
          reviewRequired: true,
        },
        { status: 422, headers: privateHeaders },
      );
    }

    const saved = await saveCandidate({
      ...prepared.candidatePayload,
      archivedCvReference: sourceReference,
      candidate_owned_update_context: {
        auth_user_id: authorization.scope.authUserId,
        user_profile_id: authorization.scope.userProfileId,
        candidate_id: authorization.scope.candidateId,
        expected_updated_at: authorization.scope.candidateUpdatedAt,
      },
    });
    const completion = evaluateCandidateProfileCompletion(saved, {
      requireCandidateConfirmation: true,
    });

    return NextResponse.json(
      {
        accepted: true,
        candidateId: authorization.scope.candidateId,
        cvVersion: saved.cv_version,
        extractionCoverageStatus: saved.extraction_coverage_status,
        profileStatus: saved.profile_confirmation_status,
        searchable: completion.searchable,
        confirmationRequired: completion.confirmationRequired,
        missingRequiredFields: completion.missingRequiredFields,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof CvSourceError) {
      try {
        await recordCandidateUploadReview({
          objectKey,
          fileName,
          actorUserId: authorization.scope.authUserId,
          reasonCodes: [error.code],
        });
      } catch {
        return responseError("candidate_cv_review_queue_unavailable", 503);
      }
      return NextResponse.json(
        {
          accepted: false,
          recordType: "SOURCE_REVIEW_REQUIRED",
          error: error.code,
          originalPreserved: true,
          reviewRequired: true,
        },
        { status: 422, headers: privateHeaders },
      );
    }
    const code =
      error instanceof Error ? error.message : "candidate_cv_update_failed";
    const status = /STALE|VERSION|OWNERSHIP|MAPPING|CONFLICT/.test(code)
      ? 409
      : 500;
    // Keep the private object on ambiguous failures. Deleting here could erase
    // the only original after a transaction committed but the response failed.
    try {
      await recordCandidateUploadReview({
        objectKey,
        fileName,
        actorUserId: authorization.scope.authUserId,
        reasonCodes: [
          status === 409
            ? "candidate_cv_update_conflict"
            : "candidate_cv_processing_failure",
        ],
      });
    } catch {
      return responseError("candidate_cv_review_queue_unavailable", 503);
    }
    return responseError(code, status);
  }
}
