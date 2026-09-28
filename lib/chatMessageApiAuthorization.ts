import "server-only";

import { authorizeChatConversation, type ChatParticipant } from "./chatAuthorizationCore";
import { anyActiveSubscription } from "./chatSubscriptionState";
import { createLazySupabaseServiceClient } from "./runtimeClients";
import { createClient } from "@/utils/supabase/server";

type Denial = { allowed: false; status: number; code: string };
type Success = { allowed: true; profileId: string; conversationId: string };

type ProfileRow = {
  id: string;
  auth_user_id: string;
  role: ChatParticipant["role"];
  status: string;
  organization_id: string | null;
  client_id: string | null;
  candidate_id: string | null;
};

const denied = (code: string, status = 403): Denial => ({ allowed: false, status, code });

/** Re-load all mutable permissions for every read or send; no browser scope is trusted. */
export async function authorizeClientCandidateMessage(
  conversationId: string,
): Promise<Denial | Success> {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user) return denied("authentication_required", 401);

  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,auth_user_id,role,status,organization_id,client_id,candidate_id")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (actorError) return denied("chat_authorization_unavailable", 503);
  if (!actor || actor.status !== "active") return denied("active_profile_required");

  const { data: conversation, error: conversationError } = await db.from("chat_conversations")
    .select("id,channel_kind,organization_id,client_id,job_id,candidate_id,status")
    .eq("id", conversationId).maybeSingle();
  if (conversationError) return denied("chat_authorization_unavailable", 503);
  if (!conversation || conversation.status !== "active" ||
      conversation.channel_kind !== "client_candidate") return denied("conversation_not_available", 404);

  const { data: members, error: membersError } = await db.from("chat_conversation_participants")
    .select("user_profile_id,role_snapshot,status")
    .eq("conversation_id", conversationId);
  if (membersError) return denied("chat_authorization_unavailable", 503);
  if (!members || members.length !== 2 ||
      !members.some((member) => member.user_profile_id === actor.id && member.status === "active"))
    return denied("conversation_not_available", 404);

  const other = members.find((member) => member.user_profile_id !== actor.id);
  if (!other || other.status !== "active") return denied("conversation_not_available", 404);
  const { data: recipient, error: recipientError } = await db.from("user_profiles")
    .select("id,auth_user_id,role,status,organization_id,client_id,candidate_id")
    .eq("id", other.user_profile_id).maybeSingle();
  if (recipientError) return denied("chat_authorization_unavailable", 503);
  if (!recipient || members.some((member) =>
    member.role_snapshot !== (member.user_profile_id === actor.id ? actor.role : recipient.role)))
    return denied("conversation_not_available", 404);

  const client = (actor.role === "client" ? actor : recipient) as ProfileRow;
  const candidate = (actor.role === "candidate" ? actor : recipient) as ProfileRow;
  if (client.role !== "client" || candidate.role !== "candidate" ||
      !client.client_id || client.client_id !== conversation.client_id ||
      candidate.candidate_id !== conversation.candidate_id ||
      client.organization_id !== conversation.organization_id)
    return denied("conversation_not_available", 404);

  const [membership, subscriptions, access, jobOwnership, account, consent, candidateAuth] = await Promise.all([
    db.from("client_memberships").select("id").eq("user_profile_id", client.id)
      .eq("client_id", client.client_id).eq("status", "active").limit(1),
    db.from("client_feature_entitlements")
      .select("status,plan_code,valid_from,valid_until")
      .eq("client_id", client.client_id),
    db.from("client_candidate_access").select("status")
      .eq("client_id", client.client_id).eq("candidate_id", candidate.candidate_id)
      .eq("status", "active").limit(1),
    conversation.job_id
      ? db.from("client_job_ownership").select("status")
          .eq("client_id", client.client_id).eq("job_id", conversation.job_id)
          .eq("status", "active").limit(1)
      : Promise.resolve({ data: [{ status: "active" }], error: null }),
    db.from("candidate_accounts").select("status")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidate.candidate_id)
      .limit(1),
    db.from("candidate_chat_contact_consents").select("consent")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidate.candidate_id)
      .limit(1),
    db.auth.admin.getUserById(candidate.auth_user_id),
  ]);
  if (membership.error || subscriptions.error || access.error || jobOwnership.error || account.error ||
      consent.error || candidateAuth.error)
    return denied("chat_authorization_unavailable", 503);
  if (!jobOwnership.data?.length) return denied("conversation_not_available", 404);

  const decision = authorizeChatConversation({
    actor: toParticipant(actor), recipient: toParticipant(recipient as ProfileRow),
    channelKind: "client_candidate",
    scope: { organizationId: conversation.organization_id,
      jobId: conversation.job_id, candidateId: conversation.candidate_id },
    candidate: {
      hasAccount: Boolean(account.data?.length),
      accountActive: account.data?.[0]?.status === "active",
      identityVerified: Boolean(candidateAuth.data.user?.email_confirmed_at),
      contactConsent: consent.data?.[0]?.consent === true,
    },
    client: {
      membershipActive: Boolean(membership.data?.length),
      anySubscriptionActive: anyActiveSubscription(subscriptions.data || [], Date.now()),
      candidateAccessActive: Boolean(access.data?.length),
    },
  });
  if (!decision.allowed) return denied(decision.code);
  return { allowed: true, profileId: actor.id, conversationId };
}

function toParticipant(profile: ProfileRow): ChatParticipant {
  return {
    profileId: profile.id,
    role: profile.role,
    active: profile.status === "active",
    organizationId: profile.organization_id,
    clientId: profile.client_id,
    candidateId: profile.candidate_id,
  };
}
