import { authorizeChatRequest } from "@/lib/chatRequestAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

type Params = { params: Promise<{ conversationId: string }> };

async function scope(context: Params) {
  const { conversationId } = await context.params;
  if (!uuid.test(conversationId))
    return { allowed: false as const, status: 400, code: "invalid_conversation_id" };
  return authorizeChatRequest(conversationId);
}

export async function GET(_request: Request, context: Params) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  const permission = await scope(context);
  if (!permission.allowed) return reply({ error: permission.code }, permission.status);

  const db = createLazySupabaseServiceClient();
  const { data, error } = await db.from("chat_messages")
    .select("id,conversation_id,sender_profile_id,client_message_id,message_type,body,created_at")
    .eq("conversation_id", permission.conversationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(50);
  if (error) return reply({ error: "chat_store_unavailable" }, 503);
  return reply({ messages: (data || []).reverse() });
}

export async function POST(request: Request, context: Params) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "json_request_required" }, 415);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > 12000)
    return reply({ error: "request_too_large" }, 413);

  let body: { clientMessageId: string; text: string };
  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply({ error: "request_too_large" }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        Object.keys(parsed).sort().join(",") !== "clientMessageId,text" ||
        typeof parsed.clientMessageId !== "string" || !uuid.test(parsed.clientMessageId) ||
        typeof parsed.text !== "string" || !parsed.text.trim() ||
        parsed.text.length > 8000)
      return reply({ error: "invalid_message" }, 400);
    body = parsed;
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }

  const permission = await scope(context);
  if (!permission.allowed) return reply({ error: permission.code }, permission.status);
  const db = createLazySupabaseServiceClient();
  const { data, error } = await db.from("chat_messages").insert({
    conversation_id: permission.conversationId,
    sender_profile_id: permission.profileId,
    client_message_id: body.clientMessageId,
    message_type: "user",
    body: body.text.trim(),
  }).select("id,conversation_id,sender_profile_id,client_message_id,message_type,body,created_at").single();
  if (error) {
    if (error.code === "23505") return reply({ error: "duplicate_message_id" }, 409);
    if (error.code === "23503" || error.code === "P0001")
      return reply({ error: "conversation_not_available" }, 403);
    return reply({ error: "chat_store_unavailable" }, 503);
  }
  return reply({ message: data }, 201);
}
