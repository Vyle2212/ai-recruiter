import { createClient } from "@/utils/supabase/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function requireClientCandidateSearchAuthorization() {
  const auth = await createClient();
  const { data: identity, error: authError } = await auth.auth.getUser();
  if (authError || !identity.user) return { clientId: null, denial: reply({ error: "authentication_required" }, 401) };
  const { data: profile, error: profileError } = await auth.from("user_profiles")
    .select("id,role,status,client_id")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "client" || profile.status !== "active" || !profile.client_id)
    return { clientId: null, denial: reply({ error: "active_client_required" }, 403) };

  const db = createLazySupabaseServiceClient();
  const [membership, entitlement] = await Promise.all([
    db.from("client_memberships").select("id")
      .eq("user_profile_id", profile.id).eq("client_id", profile.client_id)
      .eq("status", "active").limit(1),
    db.from("client_feature_entitlements").select("status,valid_from,valid_until")
      .eq("client_id", profile.client_id).eq("feature", "unlimited_search").limit(1),
  ]);
  if (membership.error || entitlement.error) return { clientId: null, denial: reply({ error: "search_unavailable" }, 503) };
  const feature = entitlement.data?.[0];
  const now = Date.now();
  if (!membership.data?.length || feature?.status !== "active" ||
      !Number.isFinite(Date.parse(String(feature.valid_from))) || Date.parse(String(feature.valid_from)) > now ||
      (feature.valid_until && (!Number.isFinite(Date.parse(String(feature.valid_until))) || Date.parse(String(feature.valid_until)) <= now)))
    return { clientId: null, denial: reply({ error: "search_not_entitled" }, 403) };
  return { clientId: profile.client_id, denial: null };
}

export async function GET(request: Request) {
  if (process.env.CLIENT_CANDIDATE_LOOKUP_ENABLED !== "true")
    return reply({ error: "search_unavailable" }, 503);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const after = url.searchParams.get("after");
  if (query.length > 120 || (after !== null && !uuid.test(after)))
    return reply({ error: "invalid_search_request" }, 400);

  const authorization = await requireClientCandidateSearchAuthorization();
  if (authorization.denial || !authorization.clientId)
    return authorization.denial || reply({ error: "active_client_required" }, 403);

  const db = createLazySupabaseServiceClient();
  const { data, error } = await db.rpc("client_candidate_lookup", {
    p_client_id: authorization.clientId,
    p_query: query,
    p_after: after,
    p_limit: 21,
  });
  if (error) return reply({ error: "search_unavailable" }, 503);
  const rows = data || [];
  return reply({ candidates: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null });
}
