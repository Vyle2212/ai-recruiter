import { NextRequest, NextResponse } from "next/server";

import { buildCandidate360Profile } from "@/lib/candidate360Profile";
import {
  authorizeCandidateCvUpload,
  validateCandidateProfileWriteRequest,
} from "@/lib/candidateCvAuthorization";
import { buildCandidateProfileConfirmation } from "@/lib/candidateProfileConfirmation";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, Origin",
};

function failure(error: string, status: number, details?: unknown) {
  return NextResponse.json({ error, details }, { status, headers });
}

export async function POST(request: NextRequest) {
  if (process.env.CANDIDATE_PROFILE_CONFIRMATION_ENABLED !== "true")
    return failure("Candidate profile confirmation is not enabled.", 503);
  const rejected = validateCandidateProfileWriteRequest(request);
  if (rejected) return failure(rejected.code, rejected.status);
  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return failure(authorization.code, authorization.status);

  let body: { submittedFields?: unknown; expectedUpdatedAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure("candidate_profile_request_invalid", 400);
  }
  if (
    body.expectedUpdatedAt !== authorization.scope.candidateUpdatedAt ||
    !body.submittedFields ||
    typeof body.submittedFields !== "object" ||
    Array.isArray(body.submittedFields)
  )
    return failure("candidate_profile_version_or_payload_invalid", 409);
  const submittedFields = body.submittedFields as Record<string, unknown>;
  if (
    String(submittedFields.email || "")
      .trim()
      .toLowerCase() !== authorization.scope.verifiedAuthEmail
  )
    return failure("candidate_profile_verified_email_required", 422);

  const result = await supabase
    .from("candidates")
    .select("*")
    .eq("id", authorization.scope.candidateId)
    .eq("updated_at", authorization.scope.candidateUpdatedAt)
    .limit(2);
  if (result.error || result.data?.length !== 1)
    return failure("candidate_profile_stale_or_ambiguous", 409);

  const currentCandidate = result.data[0] as Record<string, unknown>;
  const profile = buildCandidate360Profile(currentCandidate);
  const confirmation = buildCandidateProfileConfirmation({
    candidateId: authorization.scope.candidateId,
    submittedFields,
    profile,
    currentCandidate,
  });
  if (!confirmation.accepted)
    return failure(
      confirmation.validation.riskLevel === "needs_recruiter_review"
        ? "candidate_profile_review_required"
        : "candidate_profile_incomplete",
      422,
      {
        reasons: confirmation.validation.validationReasons,
        fields: confirmation.validation.fieldResults,
      },
    );

  const applied = await supabase.rpc("apply_candidate_profile_confirmation", {
    p_auth_user_id: authorization.scope.authUserId,
    p_user_profile_id: authorization.scope.userProfileId,
    p_candidate_id: authorization.scope.candidateId,
    p_expected_updated_at: authorization.scope.candidateUpdatedAt,
    p_confirmed_at: confirmation.submission.submittedAt,
    p_accuracy_consent: true,
    p_sharing_consent: true,
    p_payload: confirmation.candidatePayload,
    p_search_row: confirmation.searchRow,
  });
  if (applied.error) {
    const conflict = /stale|ownership|mapping|conflict/i.test(
      applied.error.message || "",
    );
    return failure(
      conflict
        ? "candidate_profile_confirmation_conflict"
        : "candidate_profile_confirmation_failed",
      conflict ? 409 : 500,
    );
  }
  if (
    !applied.data ||
    applied.data.profile_confirmation_status !== "candidate_confirmed" ||
    Number(applied.data.search_index_rows) !== 1
  )
    return failure("candidate_profile_confirmation_readback_failed", 500);

  return NextResponse.json(
    {
      confirmed: true,
      profileStatus: "candidate_confirmed",
      searchable: true,
      confirmedAt: applied.data.candidate_confirmed_at,
    },
    { headers },
  );
}
