import { validateRecruiterApiWriteRequest } from "@/lib/recruiterApiAuthorizationCore";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Origin",
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const reject = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

async function requireClientShareAuthorization() {
  const auth = await createClient();
  const { data: authData, error: authError } = await auth.auth.getUser();
  if (authError || !authData.user)
    return { profile: null, denial: reject("authentication_required", 401) };
  const { data: profile, error: profileError } = await auth
    .from("user_profiles")
    .select("id,role,status,client_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (
    profileError ||
    !profile ||
    profile.role !== "client" ||
    profile.status !== "active" ||
    !profile.client_id
  )
    return { profile: null, denial: reject("active_client_required", 403) };
  return { profile, denial: null };
}

/** A client can share only an explicitly visible CV or owned job with their
 * assigned recruiter, while the support feature is active. Shares are not
 * original-file approval grants.
 */
export async function POST(request: Request) {
  const invalid = validateRecruiterApiWriteRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
    policyId: "client.recruiter-shares.write",
    maxRequestBytes: 4096,
  });
  if (invalid) return reject(invalid.code, invalid.status);
  const { profile, denial } = await requireClientShareAuthorization();
  if (denial || !profile)
    return denial || reject("active_client_required", 403);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reject("request_too_large", 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
  } catch {
    return reject("invalid_json", 400);
  }
  const kind = body.kind;
  const resourceId = body.resourceId;
  const recruiterProfileId = body.recruiterProfileId;
  const action = body.action;
  if (
    (kind !== "candidate" && kind !== "job") ||
    typeof resourceId !== "string" ||
    !uuid.test(resourceId) ||
    typeof recruiterProfileId !== "string" ||
    !uuid.test(recruiterProfileId) ||
    (action !== "share" && action !== "revoke")
  )
    return reject("invalid_share_request", 400);

  const db = createLazySupabaseServiceClient();
  const [membership, assignment, entitlement, ownership] = await Promise.all([
    db
      .from("client_memberships")
      .select("id")
      .eq("user_profile_id", profile.id)
      .eq("client_id", profile.client_id)
      .eq("status", "active")
      .limit(1),
    db
      .from("client_recruiter_assignments")
      .select("id")
      .eq("client_id", profile.client_id)
      .eq("recruiter_profile_id", recruiterProfileId)
      .eq("status", "active")
      .limit(1),
    db
      .from("client_feature_entitlements")
      .select("status,valid_from,valid_until")
      .eq("client_id", profile.client_id)
      .eq("feature", "recruiter_support")
      .limit(1),
    db
      .from(
        kind === "candidate"
          ? "client_candidate_access"
          : "client_job_ownership",
      )
      .select("status")
      .eq("client_id", profile.client_id)
      .eq(kind === "candidate" ? "candidate_id" : "job_id", resourceId)
      .eq("status", "active")
      .limit(1),
  ]);
  if (
    membership.error ||
    assignment.error ||
    entitlement.error ||
    ownership.error
  )
    return reject("share_lookup_unavailable", 503);
  const feature = entitlement.data?.[0];
  const now = Date.now();
  if (
    !membership.data?.length ||
    (action === "share" &&
      (!assignment.data?.length ||
        !ownership.data?.length ||
        feature?.status !== "active" ||
        !Number.isFinite(Date.parse(String(feature.valid_from))) ||
        Date.parse(String(feature.valid_from)) > now ||
        (feature.valid_until &&
          (!Number.isFinite(Date.parse(String(feature.valid_until))) ||
            Date.parse(String(feature.valid_until)) <= now))))
  )
    return reject("share_not_entitled", 403);

  const table =
    kind === "candidate" ? "client_candidate_shares" : "client_job_shares";
  const resourceKey = kind === "candidate" ? "candidate_id" : "job_id";
  if (action === "revoke") {
    const { error } = await db
      .from(table)
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("client_id", profile.client_id)
      .eq("recruiter_profile_id", recruiterProfileId)
      .eq(resourceKey, resourceId);
    if (error) return reject("share_store_unavailable", 503);
    return Response.json({ revoked: true }, { headers });
  }
  const { error } = await db.from(table).upsert(
    {
      client_id: profile.client_id,
      recruiter_profile_id: recruiterProfileId,
      [resourceKey]: resourceId,
      shared_by_profile_id: profile.id,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: `client_id,recruiter_profile_id,${resourceKey}` },
  );
  if (error) return reject("share_store_unavailable", 503);
  return Response.json(
    { shared: true, originalCvApprovalRequired: kind === "candidate" },
    { headers },
  );
}
