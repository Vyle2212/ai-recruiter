import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";

export const clientLookupHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const clientLookupReply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: clientLookupHeaders });

export function activeClientSearchEntitlement(feature: {
  status: string;
  valid_from: string;
  valid_until: string | null;
} | null | undefined, now: number) {
  const start = Date.parse(String(feature?.valid_from));
  const end = feature?.valid_until ? Date.parse(String(feature.valid_until)) : Infinity;
  return feature?.status === "active" && Number.isFinite(start) &&
    start <= now && end > now;
}

export async function authorizeClientCandidateLookup() {
  const auth = await createClient();
  const { data: identity, error: authError } = await auth.auth.getUser();
  if (authError || !identity.user)
    return { clientId: null, denial: clientLookupReply({ error: "authentication_required" }, 401) };
  const { data: profile, error: profileError } = await auth.from("user_profiles")
    .select("id,role,status,client_id").eq("auth_user_id", identity.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "client" || profile.status !== "active" || !profile.client_id)
    return { clientId: null, denial: clientLookupReply({ error: "active_client_required" }, 403) };
  const db = createLazySupabaseServiceClient();
  const [membership, entitlement] = await Promise.all([
    db.from("client_memberships").select("id")
      .eq("user_profile_id", profile.id).eq("client_id", profile.client_id)
      .eq("status", "active").limit(1),
    db.from("client_feature_entitlements").select("status,valid_from,valid_until")
      .eq("client_id", profile.client_id).eq("feature", "unlimited_search").limit(1),
  ]);
  if (membership.error || entitlement.error)
    return { clientId: null, denial: clientLookupReply({ error: "search_unavailable" }, 503) };
  if (!membership.data?.length || !activeClientSearchEntitlement(entitlement.data?.[0], Date.now()))
    return { clientId: null, denial: clientLookupReply({ error: "search_not_entitled" }, 403) };
  return { clientId: profile.client_id, denial: null };
}
