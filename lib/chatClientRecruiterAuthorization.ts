import "server-only";

import { authorizeChatConversation, type ChatParticipant } from "./chatAuthorizationCore";
import { anyActiveSubscription } from "./chatSubscriptionState";
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
  client_id: string | null;
};

/** Re-load assignment, subscription, membership and optional job scope per request. */
export async function authorizeClientRecruiterMessage(
  conversationId: string,
): Promise<Denial | Success> {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user) return deny("authentication_required", 401);
  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,role,status,organization_id,client_id")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (actorError) return deny("chat_authorization_unavailable", 503);
  if (!actor || actor.status !== "active") return deny("active_profile_required");
  const { data: conversation, error: conversationError } = await db.from("chat_conversations")
    .select("id,channel_kind,organization_id,client_id,job_id,created_by_profile_id,recipient_profile_id,status")
    .eq("id", conversationId).maybeSingle();
  if (conversationError) return deny("chat_authorization_unavailable", 503);
  if (!conversation || conversation.channel_kind !== "client_recruiter" ||
      conversation.status !== "active" || !conversation.client_id ||
      !conversation.organization_id ||
      ![conversation.created_by_profile_id, conversation.recipient_profile_id].includes(actor.id))
    return deny("conversation_not_available", 404);
  const recipientId = actor.id === conversation.created_by_profile_id
    ? conversation.recipient_profile_id : conversation.created_by_profile_id;
  const [recipientResult, membersResult] = await Promise.all([
    db.from("user_profiles").select("id,role,status,organization_id,client_id")
      .eq("id", recipientId).maybeSingle(),
    db.from("chat_conversation_participants")
      .select("user_profile_id,role_snapshot,status").eq("conversation_id", conversationId),
  ]);
  if (recipientResult.error || membersResult.error)
    return deny("chat_authorization_unavailable", 503);
  const recipient = recipientResult.data as Profile | null;
  const members = membersResult.data || [];
  if (!recipient || members.length !== 2 ||
      !members.every((member) => member.status === "active" &&
        member.role_snapshot === (member.user_profile_id === actor.id ? actor.role : recipient.role)) ||
      !members.some((member) => member.user_profile_id === actor.id) ||
      !members.some((member) => member.user_profile_id === recipient.id))
    return deny("conversation_not_available", 404);
  const client = (actor.role === "client" ? actor : recipient) as Profile;
  const recruiter = (actor.role === "client" ? recipient : actor) as Profile;
  if (client.role !== "client" || !["recruiter", "recruiter_manager"].includes(recruiter.role) ||
      client.client_id !== conversation.client_id ||
      client.organization_id !== conversation.organization_id)
    return deny("conversation_not_available", 404);

  const [organization, membership, subscriptions, assignment, jobOwnership] = await Promise.all([
    db.from("organizations").select("organization_type,status")
      .eq("id", client.organization_id).maybeSingle(),
    db.from("client_memberships").select("id").eq("user_profile_id", client.id)
      .eq("organization_id", client.organization_id).eq("client_id", client.client_id)
      .eq("status", "active").limit(1),
    db.from("client_feature_entitlements").select("status,plan_code,valid_from,valid_until")
      .eq("client_id", client.client_id).eq("feature", "recruiter_support"),
    db.from("client_recruiter_assignments").select("id")
      .eq("client_id", client.client_id).eq("recruiter_profile_id", recruiter.id)
      .eq("status", "active").limit(1),
    conversation.job_id
      ? db.from("client_job_ownership").select("status")
          .eq("client_id", client.client_id).eq("job_id", conversation.job_id)
          .eq("status", "active").limit(1)
      : Promise.resolve({ data: [{ status: "active" }], error: null }),
  ]);
  if (organization.error || membership.error || subscriptions.error || assignment.error || jobOwnership.error)
    return deny("chat_authorization_unavailable", 503);
  if (!jobOwnership.data?.length) return deny("conversation_not_available", 404);
  const decision = authorizeChatConversation({
    actor: toParticipant(actor), recipient: toParticipant(recipient),
    channelKind: "client_recruiter",
    scope: { organizationId: conversation.organization_id, jobId: conversation.job_id },
    client: {
      organizationActive: organization.data?.organization_type === "client" &&
        organization.data.status === "active",
      membershipActive: Boolean(membership.data?.length),
      anySubscriptionActive: anyActiveSubscription(subscriptions.data || [], Date.now()),
      recruiterAssignmentActive: Boolean(assignment.data?.length),
      recruiterSupportActive: anyActiveSubscription(subscriptions.data || [], Date.now()),
    },
  });
  if (!decision.allowed) return deny(decision.code);
  return { allowed: true, profileId: actor.id, conversationId };
}

function toParticipant(profile: Profile): ChatParticipant {
  return { profileId: profile.id, role: profile.role, active: profile.status === "active",
    organizationId: profile.organization_id, clientId: profile.client_id };
}
