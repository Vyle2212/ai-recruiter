import { NextRequest, NextResponse } from "next/server";

import {
  authorizeCandidateCvUpload,
  candidateCvUploadRuntimeEnabled,
  validateCandidateCvWriteRequest,
} from "@/lib/candidateCvAuthorization";
import { prepareCandidateCv } from "@/lib/candidateCvIngestion";
import { evaluateCandidateProfileCompletion } from "@/lib/candidateProfileIngestion";
import { discardUnlinkedOriginalCv } from "@/lib/originalCvArchive";
import {
  MAX_ORIGINAL_BYTES,
  ORIGINAL_CV_BUCKET,
  ownedOriginalCvObjectKey,
} from "@/lib/originalCvArchiveKey";
import { saveCandidate } from "@/lib/saveCandidate";
import { supabase } from "@/lib/supabase";

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

  let input: { fileName?: unknown; objectKey?: unknown; size?: unknown };
  try {
    input = await request.json();
  } catch {
    return responseError("Invalid upload request.", 400);
  }

  const fileName = typeof input.fileName === "string" ? input.fileName : "";
  const objectKey = typeof input.objectKey === "string" ? input.objectKey : "";
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (
    !ownedOriginalCvObjectKey(authorization.scope.authUserId, objectKey) ||
    !Number.isSafeInteger(input.size) ||
    Number(input.size) < 1 ||
    Number(input.size) > MAX_ORIGINAL_BYTES ||
    objectKey.split(".").at(-1)?.toLowerCase() !== extension
  ) {
    return responseError("Invalid candidate CV reference.", 400);
  }

  const sourceReference = `${ORIGINAL_CV_BUCKET}/${objectKey}`;
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

  const downloaded = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .download(objectKey);
  if (downloaded.error || !downloaded.data)
    return responseError("Original CV was not found in private storage.", 404);

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  if (buffer.length !== input.size || buffer.length > MAX_ORIGINAL_BYTES)
    return responseError("Uploaded CV size does not match the request.", 400);

  try {
    const prepared = await prepareCandidateCv({
      buffer,
      fileName,
      source: "candidate_upload",
    });
    if (!prepared.accepted) {
      await discardUnlinkedOriginalCv(objectKey);
      return NextResponse.json(
        {
          accepted: false,
          recordType: prepared.recordType,
          reason: prepared.reason,
          signals: prepared.signals,
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
    const code =
      error instanceof Error ? error.message : "candidate_cv_update_failed";
    const status = /STALE|VERSION|OWNERSHIP|MAPPING|CONFLICT/.test(code)
      ? 409
      : 500;
    // Keep the private object on ambiguous failures. Deleting here could erase
    // the only original after a transaction committed but the response failed.
    return responseError(code, status);
  }
}
