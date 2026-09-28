import { authorizeChatConversation } from "@/lib/chatAuthorizationCore";
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
  let adminProfileId: string;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 1 || typeof body.adminProfileId !== "string" ||
        !uuid.test(body.adminProfileId))
      return reply({ error: "invalid_conversation_request" }, 400);
    adminProfileId = body.adminProfileId;
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user)
    return reply({ error: "authentication_required" }, 401);
  const db = createLazySupabaseServiceClient();
  const [actorResult, adminResult] = await Promise.all([
    db.from("user_profiles").select("id,role,status,organization_id")
      .eq("auth_user_id", identity.user.id).maybeSingle(),
    db.from("user_profiles").select("id,role,status,organization_id")
      .eq("id", adminProfileId).maybeSingle(),
  ]);
  if (actorResult.error || adminResult.error)
    return reply({ error: "chat_authorization_unavailable" }, 503);
  const actor = actorResult.data;
  const admin = adminResult.data;
  if (!actor || !admin || !actor.organization_id ||
      actor.organization_id !== admin.organization_id)
    return reply({ error: "conversation_not_available" }, 404);
  const { data: org, error: orgError } = await db.from("organizations")
    .select("organization_type,status").eq("id", actor.organization_id).maybeSingle();
  if (orgError) return reply({ error: "chat_authorization_unavailable" }, 503);
  if (org?.organization_type !== "internal" || org.status !== "active")
    return reply({ error: "conversation_not_available" }, 404);
  const decision = authorizeChatConversation({
    actor: { profileId: actor.id, role: actor.role, active: actor.status === "active",
      organizationId: actor.organization_id },
    recipient: { profileId: admin.id, role: admin.role, active: admin.status === "active",
      organizationId: admin.organization_id },
    channelKind: "recruiter_admin",
    scope: { organizationId: actor.organization_id },
  });
  if (!decision.allowed || !["recruiter", "recruiter_manager"].includes(actor.role))
    return reply({ error: "conversation_not_available" }, 403);
  const { data: conversationId, error: createError } = await db.rpc(
    "create_recruiter_admin_chat_conversation",
    { p_recruiter_profile_id: actor.id, p_admin_profile_id: admin.id },
  );
  if (createError || typeof conversationId !== "string" || !uuid.test(conversationId))
    return reply({ error: "conversation_not_available" }, 503);
  return reply({ conversationId });
}
