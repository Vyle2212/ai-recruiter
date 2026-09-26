import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { originalCvReadGrant } from "@/lib/originalCvAccess";
import { ORIGINAL_CV_BUCKET } from "@/lib/originalCvArchiveKey";
import { originalCvStorageReadStatus } from "@/lib/originalCvStorageRead";
import {
  recruiterOriginalCvAllowed,
  type RecruiterOriginalCvGrant,
} from "@/lib/recruiterOriginalCvPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/candidate360/[candidateId]/resume",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  const { candidateId } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(candidateId))
    return Response.json(
      { error: "invalid_candidate_id" },
      { status: 400, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  const supabase = createLazySupabaseServiceClient();
  let recruiterApproved = false;
  if (authorization.scope.role !== "admin") {
    const grantResult = await supabase
      .from("recruiter_original_cv_grants")
      .select(
        "candidate_id,recruiter_profile_id,approved_by_profile_id,purpose,client_id,approved_at,expires_at,revoked_at,status",
      )
      .eq("candidate_id", candidateId)
      .eq("recruiter_profile_id", authorization.scope.profileId)
      .maybeSingle();
    if (grantResult.error)
      return Response.json(
        { error: "original_cv_entitlement_unavailable" },
        { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
      );
    const grant = grantResult.data as RecruiterOriginalCvGrant | null;
    let support:
      | {
          assigned: boolean;
          candidateShared: boolean;
          candidateVisible: boolean;
          featureActive: boolean;
        }
      | undefined;
    if (grant?.purpose === "client_support" && grant.client_id) {
      const now = new Date().toISOString();
      const [assignment, share, visibility, entitlement] = await Promise.all([
        supabase
          .from("client_recruiter_assignments")
          .select("id")
          .eq("client_id", grant.client_id)
          .eq("recruiter_profile_id", authorization.scope.profileId)
          .eq("status", "active")
          .limit(1),
        supabase
          .from("client_candidate_shares")
          .select("id")
          .eq("client_id", grant.client_id)
          .eq("recruiter_profile_id", authorization.scope.profileId)
          .eq("candidate_id", candidateId)
          .eq("status", "active")
          .limit(1),
        supabase
          .from("client_candidate_access")
          .select("candidate_id")
          .eq("client_id", grant.client_id)
          .eq("candidate_id", candidateId)
          .eq("status", "active")
          .limit(1),
        supabase
          .from("client_feature_entitlements")
          .select("status,valid_from,valid_until")
          .eq("client_id", grant.client_id)
          .eq("feature", "recruiter_support")
          .limit(1),
      ]);
      if (
        assignment.error ||
        share.error ||
        visibility.error ||
        entitlement.error
      )
        return Response.json(
          { error: "original_cv_entitlement_unavailable" },
          { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
        );
      const feature = entitlement.data?.[0];
      support = {
        assigned: assignment.data?.length === 1,
        candidateShared: share.data?.length === 1,
        candidateVisible: visibility.data?.length === 1,
        featureActive: Boolean(
          feature?.status === "active" &&
            Date.parse(String(feature.valid_from)) <= Date.parse(now) &&
            (!feature.valid_until ||
              Date.parse(String(feature.valid_until)) > Date.parse(now)),
        ),
      };
    }
    recruiterApproved = recruiterOriginalCvAllowed({
      candidateId,
      recruiterProfileId: authorization.scope.profileId,
      grant,
      support,
    });
    if (!recruiterApproved)
      return Response.json(
        { error: "original_cv_entitlement_required" },
        { status: 403, headers: recruiterSearchPrivateNoStoreHeaders },
      );
  }
  const candidate = await supabase
    .from("candidates")
    .select("source_file")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidate.error)
    return Response.json(
      { error: "original_cv_lookup_unavailable" },
      { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  const grant = originalCvReadGrant(
    authorization.scope.role,
    candidate.data?.source_file,
    recruiterApproved,
  );
  if (!grant)
    return Response.json(
      { error: "original_cv_not_found" },
      { status: 404, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  try {
    const downloaded = await supabase.storage
      .from(ORIGINAL_CV_BUCKET)
      .download(grant.objectKey);
    if (downloaded.error || !downloaded.data)
      return Response.json(
        {
          error:
            originalCvStorageReadStatus(downloaded.error) === 404
              ? "original_cv_not_found"
              : "original_cv_storage_unavailable",
        },
        {
          status: originalCvStorageReadStatus(downloaded.error),
          headers: recruiterSearchPrivateNoStoreHeaders,
        },
      );
    return new Response(downloaded.data, {
      headers: {
        ...recruiterSearchPrivateNoStoreHeaders,
        "Content-Type": grant.contentType,
        "Content-Disposition": grant.disposition,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "original_cv_storage_unavailable" },
      { status: 503, headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }
}
