import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "json_request_required" }, 415);
  const length = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(length) || length < 1 || length > 4096)
    return reply({ error: "request_too_large" }, 413);
  let recruiterProfileId: string;
  let jobId: string | null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    const keys = body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body).sort().join(",") : "";
    if ((keys !== "recruiterProfileId" && keys !== "jobId,recruiterProfileId") ||
        typeof body.recruiterProfileId !== "string" || !uuid.test(body.recruiterProfileId) ||
        (body.jobId !== undefined && (typeof body.jobId !== "string" || !uuid.test(body.jobId))))
      return reply({ error: "invalid_conversation_request" }, 400);
    recruiterProfileId = body.recruiterProfileId;
    jobId = body.jobId ?? null;
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user)
    return reply({ error: "authentication_required" }, 401);
  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,role,status").eq("auth_user_id", identity.user.id).maybeSingle();
  if (actorError) return reply({ error: "chat_authorization_unavailable" }, 503);
  if (!actor || actor.role !== "client" || actor.status !== "active")
    return reply({ error: "conversation_not_available" }, 403);
  const { data: conversationId, error: createError } = await db.rpc(
    "create_client_recruiter_chat_conversation",
    { p_client_profile_id: actor.id, p_recruiter_profile_id: recruiterProfileId,
      p_job_id: jobId },
  );
  if (createError) {
    if (createError.code === "P0001") return reply({ error: "conversation_not_available" }, 404);
    return reply({ error: "chat_store_unavailable" }, 503);
  }
  if (typeof conversationId !== "string" || !uuid.test(conversationId))
    return reply({ error: "chat_store_unavailable" }, 503);
  return reply({ conversationId });
}
