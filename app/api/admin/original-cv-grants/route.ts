import {
  ORIGINAL_CV_BUCKET,
  originalCvReference,
} from "@/lib/originalCvArchiveKey";
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

async function requireAdmin() {
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/admin/original-cv-grants",
  });
  if (!authorization.allowed)
    return {
      profileId: null,
      denial: recruiterSearchAuthorizationDenied(authorization),
    };
  if (authorization.scope.role !== "admin")
    return { profileId: null, denial: response("admin_required", 403) };
  return { profileId: authorization.scope.profileId, denial: null };
}

export async function GET() {
  const { denial } = await requireAdmin();
  if (denial) return denial;
  const { data, error } = await createLazySupabaseServiceClient()
    .from("recruiter_original_cv_requests")
    .select(
      "id,candidate_id,recruiter_profile_id,purpose,client_id,requested_at",
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(50);
  if (error) return response("approval_queue_unavailable", 503);
  return Response.json(
    { requests: data || [] },
    { headers: recruiterSearchPrivateNoStoreHeaders },
  );
}

/** Approval is linked to a pending request and committed atomically with the
 * immutable grant event. Admins may also deny requests or revoke grants.
 */
export async function POST(request: Request) {
  const rejected = validateRecruiterApiWriteRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
    policyId: "admin-original-cv-approval-write",
    maxRequestBytes: 4096,
  });
  if (rejected) return response(rejected.code, rejected.status);
  const { profileId, denial } = await requireAdmin();
  if (denial || !profileId) return denial || response("admin_required", 403);

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
  const action = body.action;
  const supabase = createLazySupabaseServiceClient();
  if (action === "revoke") {
    if (
      typeof body.candidateId !== "string" ||
      !uuid.test(body.candidateId) ||
      typeof body.recruiterProfileId !== "string" ||
      !uuid.test(body.recruiterProfileId)
    )
      return response("invalid_approval_request", 400);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("recruiter_original_cv_grants")
      .update({
        status: "revoked",
        revoked_at: now,
        updated_by_profile_id: profileId,
        updated_at: now,
      })
      .eq("candidate_id", body.candidateId)
      .eq("recruiter_profile_id", body.recruiterProfileId)
      .eq("status", "active")
      .select("id");
    if (error) return response("approval_store_unavailable", 503);
    return Response.json(
      { revoked: (data?.length || 0) > 0 },
      { headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }

  if (
    (action !== "approve" && action !== "deny") ||
    typeof body.requestId !== "string" ||
    !uuid.test(body.requestId)
  )
    return response("invalid_approval_request", 400);
  const { data: pending, error: requestError } = await supabase
    .from("recruiter_original_cv_requests")
    .select("id,candidate_id,recruiter_profile_id,purpose,client_id,status")
    .eq("id", body.requestId)
    .eq("status", "pending")
    .maybeSingle();
  if (requestError) return response("approval_queue_unavailable", 503);
  if (!pending) return response("pending_request_required", 409);
  if (action === "deny") {
    const { data, error } = await supabase
      .from("recruiter_original_cv_requests")
      .update({
        status: "denied",
        resolved_at: new Date().toISOString(),
        resolved_by_profile_id: profileId,
      })
      .eq("id", pending.id)
      .eq("status", "pending")
      .select("id");
    if (error) return response("approval_store_unavailable", 503);
    if (!data?.length) return response("pending_request_required", 409);
    return Response.json(
      { denied: true },
      { headers: recruiterSearchPrivateNoStoreHeaders },
    );
  }
  const expiry =
    typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
  if (
    !Number.isFinite(expiry) ||
    expiry <= Date.now() ||
    expiry > Date.now() + 90 * 24 * 60 * 60 * 1000
  )
    return response("invalid_approval_request", 400);

  const [recruiter, candidate] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id,role,status")
      .eq("id", pending.recruiter_profile_id)
      .maybeSingle(),
    supabase
      .from("candidates")
      .select("source_file")
      .eq("id", pending.candidate_id)
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

  const reference = originalCvReference(candidate.data?.source_file)!;
  const object = await supabase.storage
    .from(ORIGINAL_CV_BUCKET)
    .info(reference.slice(`${ORIGINAL_CV_BUCKET}/`.length));
  if (object.error) {
    if (object.error.status === 404)
      return response("original_cv_not_available", 404);
    return response("original_cv_storage_unavailable", 503);
  }

  // Client support additionally requires a current assignment, explicit CV share
  // and active subscription. The resume route rechecks them at every read.
  if (pending.purpose === "client_support") {
    if (!pending.client_id) return response("client_support_not_entitled", 403);
    const now = new Date().toISOString();
    const [assignment, share, visibility, entitlement] = await Promise.all([
      supabase
        .from("client_recruiter_assignments")
        .select("id")
        .eq("client_id", pending.client_id)
        .eq("recruiter_profile_id", pending.recruiter_profile_id)
        .eq("status", "active")
        .limit(1),
      supabase
        .from("client_candidate_shares")
        .select("id")
        .eq("client_id", pending.client_id)
        .eq("recruiter_profile_id", pending.recruiter_profile_id)
        .eq("candidate_id", pending.candidate_id)
        .eq("status", "active")
        .limit(1),
      supabase
        .from("client_candidate_access")
        .select("candidate_id")
        .eq("client_id", pending.client_id)
        .eq("candidate_id", pending.candidate_id)
        .eq("status", "active")
        .limit(1),
      supabase
        .from("client_feature_entitlements")
        .select("status,valid_from,valid_until")
        .eq("client_id", pending.client_id)
        .eq("feature", "recruiter_support")
        .limit(1),
    ]);
    if (
      assignment.error ||
      share.error ||
      visibility.error ||
      entitlement.error
    )
      return response("approval_lookup_unavailable", 503);
    const feature = entitlement.data?.[0];
    if (
      !assignment.data?.length ||
      !share.data?.length ||
      !visibility.data?.length ||
      feature?.status !== "active" ||
      !Number.isFinite(Date.parse(String(feature.valid_from))) ||
      Date.parse(String(feature.valid_from)) > Date.parse(now) ||
      (feature.valid_until &&
        (!Number.isFinite(Date.parse(String(feature.valid_until))) ||
          Date.parse(String(feature.valid_until)) <= Date.parse(now)))
    )
      return response("client_support_not_entitled", 403);
  }

  const { data, error } = await supabase.rpc(
    "approve_recruiter_original_cv_request",
    {
      p_request_id: pending.id,
      p_admin_profile_id: profileId,
      p_expires_at: new Date(expiry).toISOString(),
    },
  );
  if (error) return response("approval_store_unavailable", 503);
  if (!data) return response("pending_request_required", 409);
  return Response.json(
    { approved: true, expiresAt: new Date(expiry).toISOString() },
    { headers: recruiterSearchPrivateNoStoreHeaders },
  );
}
