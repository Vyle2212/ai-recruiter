import "server-only";

import { authorizeClientCandidateMessage } from "./chatMessageApiAuthorization";
import { authorizeRecruiterAdminMessage } from "./chatInternalAuthorization";
import { createLazySupabaseServiceClient } from "./runtimeClients";
import { createClient } from "@/utils/supabase/server";

export async function authorizeChatRequest(conversationId: string) {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user)
    return { allowed: false as const, status: 401, code: "authentication_required" };
  const db = createLazySupabaseServiceClient();
  const { data, error } = await db.from("chat_conversations")
    .select("channel_kind").eq("id", conversationId).maybeSingle();
  if (error) return { allowed: false as const, status: 503,
    code: "chat_authorization_unavailable" };
  if (data?.channel_kind === "client_candidate")
    return authorizeClientCandidateMessage(conversationId);
  if (data?.channel_kind === "recruiter_admin")
    return authorizeRecruiterAdminMessage(conversationId);
  return { allowed: false as const, status: 404, code: "conversation_not_available" };
}
