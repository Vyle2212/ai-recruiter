import { authorizeClientCandidateMessage } from "@/lib/chatMessageApiAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
type Context = { params: Promise<{ conversationId: string }> };

async function authorize(context: Context) {
  const { conversationId } = await context.params;
  if (!uuid.test(conversationId))
    return { allowed: false as const, status: 400, code: "invalid_conversation_id" };
  return authorizeClientCandidateMessage(conversationId);
}

export async function GET(_request: Request, context: Context) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  const permission = await authorize(context);
  if (!permission.allowed) return reply({ error: permission.code }, permission.status);
  const db = createLazySupabaseServiceClient();
  const { count, error } = await db.from("chat_message_receipts")
    .select("message_id", { head: true, count: "exact" })
    .eq("conversation_id", permission.conversationId)
    .eq("user_profile_id", permission.profileId)
    .is("read_at", null);
  if (error) return reply({ error: "chat_receipts_unavailable" }, 503);
  return reply({ unreadCount: count || 0 });
}

export async function POST(request: Request, context: Context) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  const permission = await authorize(context);
  if (!permission.allowed) return reply({ error: permission.code }, permission.status);
  const db = createLazySupabaseServiceClient();
  const { data: unread, error: loadError } = await db.from("chat_message_receipts")
    .select("message_id")
    .eq("conversation_id", permission.conversationId)
    .eq("user_profile_id", permission.profileId)
    .is("read_at", null)
    .order("message_id", { ascending: true })
    .limit(50);
  if (loadError) return reply({ error: "chat_receipts_unavailable" }, 503);
  if (!unread?.length) return reply({ markedRead: 0 });
  const timestamp = new Date().toISOString();
  const { data, error } = await db.from("chat_message_receipts")
    .update({ read_at: timestamp })
    .eq("conversation_id", permission.conversationId)
    .eq("user_profile_id", permission.profileId)
    .is("read_at", null)
    .in("message_id", unread.map((item) => item.message_id))
    .select("message_id");
  if (error) return reply({ error: "chat_receipts_unavailable" }, 503);
  return reply({ markedRead: data?.length || 0 });
}
