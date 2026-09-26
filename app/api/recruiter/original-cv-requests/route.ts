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

export async function POST(request: Request) {
  const rejected = validateRecruiterApiWriteRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
    policyId: "recruiter-original-cv-request",
    maxRequestBytes: 4096,
  });
  if (rejected) return response(rejected.code, rejected.status);
  const authorization = await requireRecruiterSearchAuthorization({
    permission: "candidate-detail:read",
    route: "/api/recruiter/original-cv-requests",
  });
  if (!authorization.allowed)
    return recruiterSearchAuthorizationDenied(authorization);
  if (authorization.scope.role === "admin")
    return response("recruiter_required", 403);

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
  const purpose = body.purpose;
  const clientId = body.clientId;
  if (
    typeof candidateId !== "string" ||
    !uuid.test(candidateId) ||
    (purpose !== "headhunting" && purpose !== "client_support") ||
    (purpose === "headhunting" && clientId != null) ||
    (purpose === "client_support" &&
      (typeof clientId !== "string" || !uuid.test(clientId)))
  )
    return response("invalid_request", 400);

  const db = createLazySupabaseServiceClient();
  const candidate = await db
    .from("candidates")
    .select("source_file")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidate.error) return response("candidate_lookup_unavailable", 503);
  if (!originalCvReference(candidate.data?.source_file))
    return response("original_cv_not_available", 404);

  if (purpose === "client_support") {
    const now = Date.now();
    const [assignment, share, visibility, entitlement] = await Promise.all([
      db
        .from("client_recruiter_assignments")
        .select("id")
        .eq("client_id", clientId)
        .eq("recruiter_profile_id", authorization.scope.profileId)
        .eq("status", "active")
        .limit(1),
      db
        .from("client_candidate_shares")
        .select("id")
        .eq("client_id", clientId)
        .eq("recruiter_profile_id", authorization.scope.profileId)
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .limit(1),
      db
        .from("client_candidate_access")
        .select("candidate_id")
        .eq("client_id", clientId)
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .limit(1),
      db
        .from("client_feature_entitlements")
        .select("status,valid_from,valid_until")
        .eq("client_id", clientId)
        .eq("feature", "recruiter_support")
        .limit(1),
    ]);
    if (
      assignment.error ||
      share.error ||
      visibility.error ||
      entitlement.error
    )
      return response("entitlement_lookup_unavailable", 503);
    const feature = entitlement.data?.[0];
    if (
      !assignment.data?.length ||
      !share.data?.length ||
      !visibility.data?.length ||
      feature?.status !== "active" ||
      !Number.isFinite(Date.parse(String(feature.valid_from))) ||
      Date.parse(String(feature.valid_from)) > now ||
      (feature.valid_until &&
        (!Number.isFinite(Date.parse(String(feature.valid_until))) ||
          Date.parse(String(feature.valid_until)) <= now))
    )
      return response("client_support_not_entitled", 403);
  }

  const currentGrant = await db
    .from("recruiter_original_cv_grants")
    .select("purpose,client_id,status,expires_at")
    .eq("candidate_id", candidateId)
    .eq("recruiter_profile_id", authorization.scope.profileId)
    .maybeSingle();
  if (currentGrant.error) return response("request_store_unavailable", 503);
  if (
    currentGrant.data?.status === "active" &&
    currentGrant.data.purpose === purpose &&
    currentGrant.data.client_id === (clientId || null) &&
    Number.isFinite(Date.parse(String(currentGrant.data.expires_at))) &&
    Date.parse(String(currentGrant.data.expires_at)) > Date.now()
  )
    return Response.json(
      { status: "approved" },
      { headers: recruiterSearchPrivateNoStoreHeaders },
    );

  const existing = await db
    .from("recruiter_original_cv_requests")
    .select("id,purpose,client_id")
    .eq("candidate_id", candidateId)
    .eq("recruiter_profile_id", authorization.scope.profileId)
    .eq("status", "pending")
    .limit(1);
  if (existing.error) return response("request_store_unavailable", 503);
  if (
    existing.data?.length &&
    (existing.data[0].purpose !== purpose ||
      existing.data[0].client_id !== (clientId || null))
  )
    return response("different_pending_request", 409);
  if (existing.data?.length)
    return Response.json(
      { requestId: existing.data[0].id, status: "pending" },
      { headers: recruiterSearchPrivateNoStoreHeaders },
    );

  const inserted = await db
    .from("recruiter_original_cv_requests")
    .insert({
      candidate_id: candidateId,
      recruiter_profile_id: authorization.scope.profileId,
      purpose,
      client_id: purpose === "client_support" ? clientId : null,
      status: "pending",
    })
    .select("id")
    .single();
  if (inserted.error) {
    // A concurrent duplicate can hit the unique pending index. Return the
    // existing ID only when a fresh read proves it is the same scope.
    const duplicate = await db
      .from("recruiter_original_cv_requests")
      .select("id,purpose,client_id")
      .eq("candidate_id", candidateId)
      .eq("recruiter_profile_id", authorization.scope.profileId)
      .eq("status", "pending")
      .limit(1);
    const row = duplicate.data?.[0];
    if (row && row.purpose === purpose && row.client_id === (clientId || null))
      return Response.json(
        { requestId: row.id, status: "pending" },
        { headers: recruiterSearchPrivateNoStoreHeaders },
      );
    return response("request_store_unavailable", 503);
  }
  return Response.json(
    { requestId: inserted.data.id, status: "pending" },
    { status: 201, headers: recruiterSearchPrivateNoStoreHeaders },
  );
}
