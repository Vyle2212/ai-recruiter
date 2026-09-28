import type { UserRole } from "./roleAccessTypes";

export type ChatChannelKind =
  | "client_candidate"
  | "recruiter_candidate"
  | "client_recruiter"
  | "recruiter_admin";

export type ChatParticipant = {
  profileId: string;
  role: UserRole;
  active: boolean;
  organizationId?: string | null;
  clientId?: string | null;
  candidateId?: string | null;
};

export type ChatAuthorizationContext = {
  actor: ChatParticipant;
  recipient: ChatParticipant;
  channelKind: ChatChannelKind;
  scope: {
    organizationId?: string | null;
    jobId?: string | null;
    candidateId?: string | null;
  };
  candidate?: {
    hasAccount: boolean;
    accountActive: boolean;
    identityVerified: boolean;
    contactConsent: boolean;
  };
  client?: {
    organizationActive: boolean;
    membershipActive: boolean;
    anySubscriptionActive: boolean;
    candidateAccessActive?: boolean;
    recruiterAssignmentActive?: boolean;
    recruiterSupportActive?: boolean;
  };
  recruiter?: {
    candidateAssignmentActive?: boolean;
    clientShareActive?: boolean;
    adminContactApprovalActive?: boolean;
  };
};

export type ChatAuthorizationDenial =
  | "active_participants_required"
  | "participant_pair_not_allowed"
  | "conversation_scope_required"
  | "candidate_account_required"
  | "candidate_verification_required"
  | "candidate_contact_consent_required"
  | "active_client_organization_required"
  | "active_client_membership_required"
  | "active_subscription_required"
  | "candidate_access_required"
  | "recruiter_assignment_required"
  | "recruiter_candidate_scope_required"
  | "organization_scope_mismatch";

export type ChatAuthorizationDecision =
  | {
      allowed: true;
      participantIds: [string, string];
      candidateId: string | null;
      organizationId: string | null;
      jobId: string | null;
    }
  | { allowed: false; code: ChatAuthorizationDenial };

const roles = (input: ChatAuthorizationContext) =>
  new Set([input.actor.role, input.recipient.role]);
const recruiterRoles = new Set<UserRole>(["recruiter", "recruiter_manager"]);

function participantPairMatches(input: ChatAuthorizationContext) {
  const pair = roles(input);
  switch (input.channelKind) {
    case "client_candidate":
      return pair.has("client") && pair.has("candidate");
    case "recruiter_candidate":
      return (
        pair.has("candidate") &&
        [...recruiterRoles].some((role) => pair.has(role))
      );
    case "client_recruiter":
      return (
        pair.has("client") &&
        [...recruiterRoles].some((role) => pair.has(role))
      );
    case "recruiter_admin":
      return (
        pair.has("admin") &&
        [...recruiterRoles].some((role) => pair.has(role))
      );
  }
}

function candidateParticipant(input: ChatAuthorizationContext) {
  return [input.actor, input.recipient].find(
    (participant) => participant.role === "candidate",
  );
}

function clientParticipant(input: ChatAuthorizationContext) {
  return [input.actor, input.recipient].find(
    (participant) => participant.role === "client",
  );
}

export function authorizeChatConversation(
  input: ChatAuthorizationContext,
): ChatAuthorizationDecision {
  if (
    !input.actor.active ||
    !input.recipient.active ||
    !input.actor.profileId ||
    !input.recipient.profileId ||
    input.actor.profileId === input.recipient.profileId
  )
    return { allowed: false, code: "active_participants_required" };
  if (!participantPairMatches(input))
    return { allowed: false, code: "participant_pair_not_allowed" };
  if (!input.scope.organizationId && !input.scope.jobId && !input.scope.candidateId)
    return { allowed: false, code: "conversation_scope_required" };

  const candidate = candidateParticipant(input);
  if (candidate) {
    if (
      !candidate.candidateId ||
      candidate.candidateId !== input.scope.candidateId ||
      !input.candidate?.hasAccount ||
      !input.candidate.accountActive
    )
      return { allowed: false, code: "candidate_account_required" };
    if (!input.candidate.identityVerified)
      return { allowed: false, code: "candidate_verification_required" };
    if (!input.candidate.contactConsent)
      return { allowed: false, code: "candidate_contact_consent_required" };
  }

  const client = clientParticipant(input);
  if (client) {
    if (!input.client?.organizationActive)
      return { allowed: false, code: "active_client_organization_required" };
    if (!client.clientId || !input.client?.membershipActive)
      return { allowed: false, code: "active_client_membership_required" };
    if (!input.client.anySubscriptionActive)
      return { allowed: false, code: "active_subscription_required" };
  }

  if (input.channelKind === "client_candidate") {
    if (!input.client?.candidateAccessActive)
      return { allowed: false, code: "candidate_access_required" };
  }
  if (input.channelKind === "client_recruiter") {
    if (!input.client?.recruiterAssignmentActive || !input.client?.recruiterSupportActive)
      return { allowed: false, code: "recruiter_assignment_required" };
  }
  if (input.channelKind === "recruiter_candidate") {
    if (
      !input.recruiter?.candidateAssignmentActive &&
      !input.recruiter?.clientShareActive &&
      !input.recruiter?.adminContactApprovalActive
    )
      return { allowed: false, code: "recruiter_candidate_scope_required" };
  }
  if (input.channelKind === "recruiter_admin") {
    const organizationId = input.scope.organizationId;
    if (
      !organizationId ||
      input.actor.organizationId !== organizationId ||
      input.recipient.organizationId !== organizationId
    )
      return { allowed: false, code: "organization_scope_mismatch" };
  }

  return {
    allowed: true,
    participantIds: [input.actor.profileId, input.recipient.profileId].sort() as [
      string,
      string,
    ],
    candidateId: input.scope.candidateId || null,
    organizationId: input.scope.organizationId || null,
    jobId: input.scope.jobId || null,
  };
}

export function authorizeChatAiSuggestion(input: {
  conversation: ChatAuthorizationDecision;
  originalCvRequested: boolean;
  originalCvAccessApproved: boolean;
}) {
  if (!input.conversation.allowed)
    return { allowed: false as const, code: "conversation_access_required" };
  if (input.originalCvRequested && !input.originalCvAccessApproved)
    return { allowed: false as const, code: "original_cv_access_required" };
  return {
    allowed: true as const,
    delivery: "draft_only" as const,
    autoSend: false as const,
  };
}
