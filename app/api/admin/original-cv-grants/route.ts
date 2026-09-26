import { originalCvReference } from "@/lib/originalCvArchiveKey";
import { validateRecruiterApiWriteRequest } from "@/lib/recruiterApiAuthorizationCore";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const response = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: recruiterSearchPrivateNoStoreHeaders },
  );

/** Admin-only approval/revocation. The database trigger records every change atomically. */
export async function POST(request: Request) {
  const rejected = validateRecruiterApiWriteRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
    policyId: "admin.original-cv-grants.write",
    maxRequestBytes: 4096,
  });
  if (rejected) return response(rejected.code, rejected.status);
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/admin/original-cv-grants",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  if (authorization.scope.role !== "admin")
    return response("admin_required", 403);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return response("request_too_large", 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
  } catch {
    return response("invalid_json", 400);
  }
  const candidateId = body.candidateId;
  const recruiterProfileId = body.recruiterProfileId;
  const action = body.action;
  if (
    typeof candidateId !== "string" ||
    !uuid.test(candidateId) ||
    typeof recruiterProfileId !== "string" ||
    !uuid.test(recruiterProfileId) ||
    (action !== "approve" && action !== "revoke")
  )
    return response("invalid_approval_request", 400);

  const supabase = createLazySupabaseServiceClient();
  if (action === "revoke") {
    const { data, error } = await supabase
      .from("recruiter_original_cv_grants")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_by_profile_id: authorization.scope.profileId,
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", candidateId)
      .eq("recruiter_profile_id", recruiterProfileId)
      .eq("status", "active")
      .select("id");
    if (error) return response("approval_store_unavailable", 503);
    return Response.json(
      { revoked: (data?.length || 0) > 0 },
      { headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }

  const purpose = body.purpose;
  const clientId = body.clientId;
  const expiresAt = body.expiresAt;
  const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
  if (
    (purpose !== "headhunting" && purpose !== "client_support") ||
    (purpose === "headhunting" && clientId != null) ||
    (purpose === "client_support" &&
      (typeof clientId !== "string" || !uuid.test(clientId))) ||
    !Number.isFinite(expiry) ||
    expiry <= Date.now() ||
    expiry > Date.now() + 90 * 24 * 60 * 60 * 1000
  )
    return response("invalid_approval_request", 400);

  const [recruiter, candidate] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id,role,status")
      .eq("id", recruiterProfileId)
      .maybeSingle(),
    supabase
      .from("candidates")
      .select("source_file")
      .eq("id", candidateId)
      .maybeSingle(),
  ]);
  if (recruiter.error || candidate.error)
    return response("approval_lookup_unavailable", 503);
  if (
    !recruiter.data ||
    recruiter.data.status !== "active" ||
    !["recruiter", "recruiter_manager"].includes(recruiter.data.role) ||
    !originalCvReference(candidate.data?.source_file)
  )
    return response("approval_target_unavailable", 404);

  // Client support additionally requires a current assignment, explicit CV share
  // and active subscription. The resume route rechecks them at every read.
  if (purpose === "client_support") {
    const now = new Date().toISOString();
    const [assignment, share, entitlement] = await Promise.all([
      supabase
        .from("client_recruiter_assignments")
        .select("id")
        .eq("client_id", clientId)
        .eq("recruiter_profile_id", recruiterProfileId)
        .eq("status", "active")
        .limit(1),
      supabase
        .from("client_candidate_shares")
        .select("id")
        .eq("client_id", clientId)
        .eq("recruiter_profile_id", recruiterProfileId)
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .limit(1),
      supabase
        .from("client_feature_entitlements")
        .select("status,valid_from,valid_until")
        .eq("client_id", clientId)
        .eq("feature", "recruiter_support")
        .limit(1),
    ]);
    if (assignment.error || share.error || entitlement.error)
      return response("approval_lookup_unavailable", 503);
    const feature = entitlement.data?.[0];
    if (
      !assignment.data?.length ||
      !share.data?.length ||
      feature?.status !== "active" ||
      Date.parse(String(feature.valid_from)) > Date.parse(now) ||
      (feature.valid_until &&
        Date.parse(String(feature.valid_until)) <= Date.parse(now))
    )
      return response("client_support_not_entitled", 403);
  }

  const approvedAt = new Date().toISOString();
  const { error } = await supabase.from("recruiter_original_cv_grants").upsert(
    {
      candidate_id: candidateId,
      recruiter_profile_id: recruiterProfileId,
      approved_by_profile_id: authorization.scope.profileId,
      updated_by_profile_id: authorization.scope.profileId,
      purpose,
      client_id: purpose === "client_support" ? clientId : null,
      status: "active",
      approved_at: approvedAt,
      expires_at: new Date(expiry).toISOString(),
      revoked_at: null,
      updated_at: approvedAt,
    },
    { onConflict: "candidate_id,recruiter_profile_id" },
  );
  if (error) return response("approval_store_unavailable", 503);
  return Response.json(
    { approved: true, expiresAt: new Date(expiry).toISOString() },
    { headers: recruiterSearchPrivateNoStoreHeaders },
  );
}
