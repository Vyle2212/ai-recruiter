import {
  createClientCandidateConversation,
  parseConversationCreationInput,
} from "@/lib/chatConversationCreation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "json_request_required" }, 415);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > 1000)
    return reply({ error: "request_too_large" }, 413);

  let parsed: ReturnType<typeof parseConversationCreationInput>;
  try {
    const raw = await request.text();
    if (raw.length > 1000) return reply({ error: "request_too_large" }, 413);
    parsed = parseConversationCreationInput(JSON.parse(raw));
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }
  if (!parsed.ok) return reply({ error: "invalid_conversation_scope" }, 400);

  const result = await createClientCandidateConversation(parsed.value);
  if (!result.allowed) return reply({ error: result.code }, result.status);
  return reply({ conversationId: result.conversationId });
}
