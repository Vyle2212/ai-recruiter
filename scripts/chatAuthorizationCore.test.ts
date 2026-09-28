import assert from "node:assert/strict";

import {
  authorizeChatAiSuggestion,
  authorizeChatConversation,
  type ChatAuthorizationContext,
} from "../lib/chatAuthorizationCore";

const candidate = {
  profileId: "candidate-profile",
  role: "candidate" as const,
  active: true,
  candidateId: "candidate-1",
};
const client = {
  profileId: "client-profile",
  role: "client" as const,
  active: true,
  organizationId: "client-org",
  clientId: "client-1",
};
const recruiter = {
  profileId: "recruiter-profile",
  role: "recruiter" as const,
  active: true,
  organizationId: "primus-org",
};
const admin = {
  profileId: "admin-profile",
  role: "admin" as const,
  active: true,
  organizationId: "primus-org",
};
const eligibleCandidate = {
  hasAccount: true,
  accountActive: true,
  identityVerified: true,
  contactConsent: true,
};
const activeClient = {
  organizationActive: true,
  membershipActive: true,
  anySubscriptionActive: true,
  candidateAccessActive: true,
  recruiterAssignmentActive: true,
  recruiterSupportActive: true,
};

const clientCandidate: ChatAuthorizationContext = {
  actor: client,
  recipient: candidate,
  channelKind: "client_candidate",
  scope: { candidateId: "candidate-1", jobId: "job-1" },
  candidate: eligibleCandidate,
  client: activeClient,
};
assert.equal(authorizeChatConversation(clientCandidate).allowed, true);
assert.deepEqual(
  authorizeChatConversation({
    ...clientCandidate,
    client: { ...activeClient, organizationActive: false },
  }),
  { allowed: false, code: "active_client_organization_required" },
  "client chat is revoked when the owning organization is inactive",
);
assert.deepEqual(
  authorizeChatConversation({
    ...clientCandidate,
    client: { ...activeClient, anySubscriptionActive: false },
  }),
  { allowed: false, code: "active_subscription_required" },
  "candidate chat requires an active subscription of any plan",
);
assert.equal(
  authorizeChatConversation({
    ...clientCandidate,
    client: { ...activeClient, anySubscriptionActive: true },
  }).allowed,
  true,
  "candidate chat does not require a candidate_chat feature entitlement",
);
assert.deepEqual(
  authorizeChatConversation({
    ...clientCandidate,
    candidate: { ...eligibleCandidate, contactConsent: false },
  }),
  { allowed: false, code: "candidate_contact_consent_required" },
);
assert.deepEqual(
  authorizeChatConversation({
    ...clientCandidate,
    recipient: { ...candidate, candidateId: "admin-import-without-account" },
    scope: { candidateId: "admin-import-without-account" },
    candidate: { ...eligibleCandidate, hasAccount: false },
  }),
  { allowed: false, code: "candidate_account_required" },
  "an admin-imported CV never becomes a chat recipient by itself",
);

const recruiterCandidate = authorizeChatConversation({
  actor: recruiter,
  recipient: candidate,
  channelKind: "recruiter_candidate",
  scope: { candidateId: "candidate-1" },
  candidate: eligibleCandidate,
  recruiter: { clientShareActive: true },
});
assert.equal(recruiterCandidate.allowed, true);
assert.deepEqual(
  authorizeChatConversation({
    actor: recruiter,
    recipient: candidate,
    channelKind: "recruiter_candidate",
    scope: { candidateId: "candidate-1" },
    candidate: eligibleCandidate,
    recruiter: {},
  }),
  { allowed: false, code: "recruiter_candidate_scope_required" },
);

assert.equal(
  authorizeChatConversation({
    actor: client,
    recipient: recruiter,
    channelKind: "client_recruiter",
    scope: { jobId: "job-1" },
    client: activeClient,
  }).allowed,
  true,
);
assert.deepEqual(
  authorizeChatConversation({
    actor: client, recipient: recruiter, channelKind: "client_recruiter",
    scope: { jobId: "job-1" },
    client: { ...activeClient, recruiterSupportActive: false },
  }),
  { allowed: false, code: "recruiter_assignment_required" },
  "a plan without recruiter support cannot open client recruiter chat",
);
assert.deepEqual(
  authorizeChatConversation({
    actor: recruiter,
    recipient: admin,
    channelKind: "recruiter_admin",
    scope: { organizationId: "different-org" },
  }),
  { allowed: false, code: "organization_scope_mismatch" },
);
const recruiterAdmin = authorizeChatConversation({
  actor: recruiter,
  recipient: admin,
  channelKind: "recruiter_admin",
  scope: { organizationId: "primus-org" },
});
assert.equal(recruiterAdmin.allowed, true);

assert.deepEqual(
  authorizeChatAiSuggestion({
    conversation: recruiterCandidate,
    originalCvRequested: true,
    originalCvAccessApproved: false,
  }),
  { allowed: false, code: "original_cv_access_required" },
);
assert.deepEqual(
  authorizeChatAiSuggestion({
    conversation: recruiterCandidate,
    originalCvRequested: false,
    originalCvAccessApproved: false,
  }),
  { allowed: true, delivery: "draft_only", autoSend: false },
  "AI suggestions remain user-reviewed drafts",
);

console.log("Chat authorization core tests passed.");
