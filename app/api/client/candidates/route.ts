import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { authorizeClientCandidateLookup, clientLookupReply as reply } from "@/lib/clientCandidateLookupAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (process.env.CLIENT_CANDIDATE_LOOKUP_ENABLED !== "true")
    return reply({ error: "search_unavailable" }, 503);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const after = url.searchParams.get("after");
  if (query.length > 120 || (after !== null && !uuid.test(after)))
    return reply({ error: "invalid_search_request" }, 400);

  const authorization = await authorizeClientCandidateLookup();
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
