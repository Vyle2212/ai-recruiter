import { authorizeChatRequest } from "@/lib/chatRequestAuthorization";
import { createLazyOpenAiClient, createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const kinds = new Set(["client_candidate", "recruiter_candidate", "client_recruiter", "recruiter_admin"]);
const roles = new Set(["admin", "client", "candidate", "recruiter", "recruiter_manager"]);

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  if (process.env.CHAT_ENABLED !== "true" || process.env.CHAT_SUGGESTIONS_ENABLED !== "true")
    return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  if (Number(request.headers.get("content-length") || 0) !== 0)
    return reply({ error: "body_not_allowed" }, 400);
  const { conversationId } = await params;
  if (!uuid.test(conversationId)) return reply({ error: "invalid_conversation_id" }, 400);
  const permission = await authorizeChatRequest(conversationId);
  if (!permission.allowed) return reply({ error: permission.code }, permission.status);

  const db = createLazySupabaseServiceClient();
  const [conversation, actor] = await Promise.all([
    db.from("chat_conversations").select("channel_kind")
      .eq("id", permission.conversationId).maybeSingle(),
    db.from("user_profiles").select("role,status")
      .eq("id", permission.profileId).maybeSingle(),
  ]);
  if (conversation.error || actor.error) return reply({ error: "chat_context_unavailable" }, 503);
  const kind = conversation.data?.channel_kind;
  const role = actor.data?.role;
  if (!kinds.has(kind || "") || !roles.has(role || "") || actor.data?.status !== "active")
    return reply({ error: "conversation_not_available" }, 404);

  try {
    const completion = await createLazyOpenAiClient().chat.completions.create({
      model: process.env.CHAT_SUGGESTION_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_completion_tokens: 160,
      messages: [
        { role: "system", content: "Write one concise, professional question or reply draft for a SAP recruiting conversation. Use only the channel and actor role supplied. Do not invent facts about a candidate, job, organization, subscription, interview or prior messages. Do not imply consent or approval. Return plain text only. Do not send anything." },
        { role: "user", content: `Channel: ${kind}. My role: ${role}. Suggest a helpful next question or reply draft.` },
      ],
    });
    const suggestion = completion.choices[0]?.message?.content?.trim().slice(0, 600);
    if (!suggestion) return reply({ error: "suggestion_unavailable" }, 503);
    return reply({ suggestion });
  } catch {
    return reply({ error: "suggestion_unavailable" }, 503);
  }
}
