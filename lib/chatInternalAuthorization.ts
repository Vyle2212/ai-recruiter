import "server-only";

import { authorizeChatConversation, type ChatParticipant } from "./chatAuthorizationCore";
import { createLazySupabaseServiceClient } from "./runtimeClients";
import { createClient } from "@/utils/supabase/server";

type Denial = { allowed: false; status: number; code: string };
type Success = { allowed: true; profileId: string; conversationId: string };
const deny = (code: string, status = 403): Denial => ({ allowed: false, code, status });

type Profile = {
  id: string;
  role: ChatParticipant["role"];
  status: string;
  organization_id: string | null;
};

/** Recheck the pair, current roles, organization and membership on every call. */
export async function authorizeRecruiterAdminMessage(
  conversationId: string,
): Promise<Denial | Success> {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user) return deny("authentication_required", 401);
  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,role,status,organization_id")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (actorError) return deny("chat_authorization_unavailable", 503);
  if (!actor || actor.status !== "active") return deny("active_profile_required");
  const { data: conversation, error: conversationError } = await db.from("chat_conversations")
    .select("id,channel_kind,organization_id,created_by_profile_id,recipient_profile_id,status")
    .eq("id", conversationId).maybeSingle();
  if (conversationError) return deny("chat_authorization_unavailable", 503);
  if (!conversation || conversation.channel_kind !== "recruiter_admin" ||
      conversation.status !== "active" || !conversation.organization_id ||
      ![conversation.created_by_profile_id, conversation.recipient_profile_id].includes(actor.id))
    return deny("conversation_not_available", 404);

  const recipientId = actor.id === conversation.created_by_profile_id
    ? conversation.recipient_profile_id : conversation.created_by_profile_id;
  const [recipientResult, membersResult, orgResult] = await Promise.all([
    db.from("user_profiles").select("id,role,status,organization_id")
      .eq("id", recipientId).maybeSingle(),
    db.from("chat_conversation_participants")
      .select("user_profile_id,role_snapshot,status")
      .eq("conversation_id", conversationId),
    db.from("organizations").select("organization_type,status")
      .eq("id", conversation.organization_id).maybeSingle(),
  ]);
  if (recipientResult.error || membersResult.error || orgResult.error)
    return deny("chat_authorization_unavailable", 503);
  const recipient = recipientResult.data as Profile | null;
  const members = membersResult.data || [];
  if (!recipient || orgResult.data?.organization_type !== "internal" ||
      orgResult.data.status !== "active" || members.length !== 2 ||
      !members.every((member) => member.status === "active" &&
        member.role_snapshot === (member.user_profile_id === actor.id ? actor.role : recipient.role)) ||
      !members.some((member) => member.user_profile_id === actor.id) ||
      !members.some((member) => member.user_profile_id === recipient.id))
    return deny("conversation_not_available", 404);
  const recruiter = actor.id === conversation.created_by_profile_id ? actor : recipient;
  const admin = actor.id === conversation.recipient_profile_id ? actor : recipient;
  if (!(["recruiter", "recruiter_manager"].includes(recruiter.role) && admin.role === "admin"))
    return deny("conversation_not_available", 404);

  const decision = authorizeChatConversation({
    actor: toParticipant(actor), recipient: toParticipant(recipient),
    channelKind: "recruiter_admin",
    scope: { organizationId: conversation.organization_id },
  });
  if (!decision.allowed) return deny(decision.code);
  return { allowed: true, profileId: actor.id, conversationId };
}

function toParticipant(profile: Profile): ChatParticipant {
  return { profileId: profile.id, role: profile.role,
    active: profile.status === "active", organizationId: profile.organization_id };
}
