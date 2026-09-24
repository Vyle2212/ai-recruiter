import "server-only";

import { createClient } from "@/utils/supabase/server";
import { supabase } from "@/lib/supabase";

export type CandidateCvAuthorization = {
  authUserId: string;
  userProfileId: string;
  candidateId: string;
  candidateUpdatedAt: string;
  candidateSourceFile: string | null;
  candidateCvVersion: number | null;
  extractionCoverageStatus: string | null;
  profileConfirmationStatus: string | null;
};

export function candidateCvUploadRuntimeEnabled() {
  return process.env.CANDIDATE_CV_UPLOAD_ENABLED === "true";
}

export function validateCandidateCvWriteRequest(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;
  if (
    origin !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return { status: 403 as const, code: "same_origin_required" };
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return { status: 415 as const, code: "json_request_required" };
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > 4096
  )
    return { status: 413 as const, code: "candidate_cv_request_too_large" };
  return null;
}

/**
 * Resolve one current, verified candidate session to exactly one active
 * profile/account/candidate chain. The browser never supplies candidate_id.
 */
export async function authorizeCandidateCvUpload(): Promise<
  | { allowed: true; scope: CandidateCvAuthorization }
  | { allowed: false; status: 401 | 403 | 409; code: string }
> {
  const browserClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await browserClient.auth.getUser();
  if (userError || !user)
    return { allowed: false, status: 401, code: "candidate_auth_required" };
  if (!user.email_confirmed_at)
    return { allowed: false, status: 403, code: "verified_email_required" };

  const profileResult = await browserClient
    .from("user_profiles")
    .select("id,auth_user_id,role,status,candidate_id")
    .eq("auth_user_id", user.id)
    .limit(2);
  if (profileResult.error || profileResult.data?.length !== 1)
    return { allowed: false, status: 409, code: "candidate_profile_ambiguous" };

  const profile = profileResult.data[0];
  if (
    profile.auth_user_id !== user.id ||
    profile.role !== "candidate" ||
    profile.status !== "active" ||
    !profile.candidate_id
  ) {
    return {
      allowed: false,
      status: 403,
      code: "candidate_profile_not_active",
    };
  }

  const accountResult = await supabase
    .from("candidate_accounts")
    .select("user_profile_id,candidate_id,status")
    .eq("user_profile_id", profile.id)
    .eq("candidate_id", profile.candidate_id)
    .limit(2);
  if (
    accountResult.error ||
    accountResult.data?.length !== 1 ||
    accountResult.data[0].status !== "active"
  ) {
    return {
      allowed: false,
      status: 409,
      code: "candidate_ownership_mismatch",
    };
  }

  const candidateResult = await supabase
    .from("candidates")
    .select(
      "id,updated_at,source_file,cv_version,extraction_coverage_status,profile_confirmation_status",
    )
    .eq("id", profile.candidate_id)
    .limit(2);
  if (candidateResult.error || candidateResult.data?.length !== 1)
    return { allowed: false, status: 409, code: "candidate_record_ambiguous" };

  const candidate = candidateResult.data[0];
  if (!candidate.updated_at)
    return { allowed: false, status: 409, code: "candidate_version_missing" };

  return {
    allowed: true,
    scope: {
      authUserId: user.id,
      userProfileId: String(profile.id),
      candidateId: String(candidate.id),
      candidateUpdatedAt: String(candidate.updated_at),
      candidateSourceFile:
        typeof candidate.source_file === "string"
          ? candidate.source_file
          : null,
      candidateCvVersion:
        typeof candidate.cv_version === "number" ? candidate.cv_version : null,
      extractionCoverageStatus:
        typeof candidate.extraction_coverage_status === "string"
          ? candidate.extraction_coverage_status
          : null,
      profileConfirmationStatus:
        typeof candidate.profile_confirmation_status === "string"
          ? candidate.profile_confirmation_status
          : null,
    },
  };
}
