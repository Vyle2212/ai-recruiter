import "server-only";

import { authorizeChatConversation, type ChatParticipant } from "./chatAuthorizationCore";
import { anyActiveSubscription } from "./chatSubscriptionState";
import { createLazySupabaseServiceClient } from "./runtimeClients";
import { createClient } from "@/utils/supabase/server";

type Denial = { allowed: false; status: number; code: string };
type Success = { allowed: true; profileId: string; conversationId: string };
const deny = (code: string, status = 403): Denial => ({ allowed: false, status, code });
type Profile = {
  id: string; auth_user_id: string; role: ChatParticipant["role"];
  status: string; organization_id: string | null; candidate_id: string | null;
};

/** Client support lane; share, consent and subscription may change at any time. */
export async function authorizeRecruiterCandidateMessage(
  conversationId: string,
): Promise<Denial | Success> {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user) return deny("authentication_required", 401);
  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,auth_user_id,role,status,organization_id,candidate_id")
    .eq("auth_user_id", identity.user.id).maybeSingle();
  if (actorError) return deny("chat_authorization_unavailable", 503);
  if (!actor || actor.status !== "active") return deny("active_profile_required");
  const { data: conversation, error: conversationError } = await db.from("chat_conversations")
    .select("id,channel_kind,organization_id,client_id,candidate_id,created_by_profile_id,recipient_profile_id,status")
    .eq("id", conversationId).maybeSingle();
  if (conversationError) return deny("chat_authorization_unavailable", 503);
  if (!conversation || conversation.channel_kind !== "recruiter_candidate" ||
      conversation.status !== "active" || !conversation.client_id ||
      !conversation.candidate_id || !conversation.organization_id ||
      ![conversation.created_by_profile_id, conversation.recipient_profile_id].includes(actor.id))
    return deny("conversation_not_available", 404);
  const otherId = actor.id === conversation.created_by_profile_id
    ? conversation.recipient_profile_id : conversation.created_by_profile_id;
  const [otherResult, membersResult] = await Promise.all([
    db.from("user_profiles").select("id,auth_user_id,role,status,organization_id,candidate_id")
      .eq("id", otherId).maybeSingle(),
    db.from("chat_conversation_participants")
      .select("user_profile_id,role_snapshot,status").eq("conversation_id", conversationId),
  ]);
  if (otherResult.error || membersResult.error)
    return deny("chat_authorization_unavailable", 503);
  const other = otherResult.data as Profile | null;
  const members = membersResult.data || [];
  if (!other || members.length !== 2 ||
      !members.every((member) => member.status === "active" &&
        member.role_snapshot === (member.user_profile_id === actor.id ? actor.role : other.role)) ||
      !members.some((member) => member.user_profile_id === actor.id) ||
      !members.some((member) => member.user_profile_id === other.id))
    return deny("conversation_not_available", 404);
  const recruiter = actor.id === conversation.created_by_profile_id ? actor : other;
  const candidate = actor.id === conversation.recipient_profile_id ? actor : other;
  if (!['recruiter', 'recruiter_manager'].includes(recruiter.role) ||
      candidate.role !== "candidate" || candidate.candidate_id !== conversation.candidate_id)
    return deny("conversation_not_available", 404);
  const [organization, clients, assignment, share, access, subscription, account, consent, candidateAuth] = await Promise.all([
    db.from("organizations").select("organization_type,status")
      .eq("id", conversation.organization_id).maybeSingle(),
    db.from("client_memberships").select("user_profile_id")
      .eq("organization_id", conversation.organization_id)
      .eq("client_id", conversation.client_id).eq("status", "active").limit(20),
    db.from("client_recruiter_assignments").select("id")
      .eq("client_id", conversation.client_id).eq("recruiter_profile_id", recruiter.id)
      .eq("status", "active").limit(1),
    db.from("client_candidate_shares").select("id")
      .eq("client_id", conversation.client_id).eq("candidate_id", conversation.candidate_id)
      .eq("recruiter_profile_id", recruiter.id).eq("status", "active").limit(1),
    db.from("client_candidate_access").select("status")
      .eq("client_id", conversation.client_id).eq("candidate_id", conversation.candidate_id)
      .eq("status", "active").limit(1),
    db.from("client_feature_entitlements").select("status,plan_code,valid_from,valid_until")
      .eq("client_id", conversation.client_id).eq("feature", "recruiter_support"),
    db.from("candidate_accounts").select("status")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidate.candidate_id).limit(1),
    db.from("candidate_chat_contact_consents").select("consent")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidate.candidate_id).limit(1),
    db.auth.admin.getUserById(candidate.auth_user_id),
  ]);
  if (organization.error || clients.error || assignment.error || share.error || access.error ||
      subscription.error || account.error || consent.error || candidateAuth.error)
    return deny("chat_authorization_unavailable", 503);
  if (organization.data?.organization_type !== "client" || organization.data.status !== "active")
    return deny("conversation_not_available", 404);
  const clientIds = (clients.data || []).map((row) => row.user_profile_id);
  if (!clientIds.length) return deny("conversation_not_available", 404);
  const { data: clientProfiles, error: clientError } = await db.from("user_profiles")
    .select("id").in("id", clientIds).eq("client_id", conversation.client_id)
    .eq("organization_id", conversation.organization_id)
    .eq("role", "client").eq("status", "active").limit(1);
  if (clientError) return deny("chat_authorization_unavailable", 503);
  if (!clientProfiles?.length) return deny("conversation_not_available", 404);
  const decision = authorizeChatConversation({
    actor: toParticipant(actor), recipient: toParticipant(other),
    channelKind: "recruiter_candidate",
    scope: { organizationId: conversation.organization_id,
      candidateId: conversation.candidate_id },
    candidate: { hasAccount: Boolean(account.data?.length),
      accountActive: account.data?.[0]?.status === "active",
      identityVerified: Boolean(candidateAuth.data.user?.email_confirmed_at),
      contactConsent: consent.data?.[0]?.consent === true },
    recruiter: { clientShareActive: Boolean(assignment.data?.length && share.data?.length &&
      access.data?.length && anyActiveSubscription(subscription.data || [], Date.now())) },
  });
  if (!decision.allowed) return deny(decision.code);
  return { allowed: true, profileId: actor.id, conversationId };
}

function toParticipant(profile: Profile): ChatParticipant {
  return { profileId: profile.id, role: profile.role,
    active: profile.status === "active", organizationId: profile.organization_id,
    candidateId: profile.candidate_id };
}
