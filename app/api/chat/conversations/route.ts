import { authorizeChatConversation } from "@/lib/chatAuthorizationCore";
import { anyActiveSubscription } from "@/lib/chatSubscriptionState";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (process.env.CHAT_ENABLED !== "true") return reply({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "json_request_required" }, 415);
  const size = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(size) || size < 1 || size > 4096)
    return reply({ error: "request_too_large" }, 413);

  let candidateId: string;
  let jobId: string | null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "candidateId" && key !== "jobId") ||
        typeof body.candidateId !== "string" || !uuid.test(body.candidateId) ||
        (body.jobId !== undefined && (typeof body.jobId !== "string" || !uuid.test(body.jobId))))
      return reply({ error: "invalid_conversation_request" }, 400);
    candidateId = body.candidateId;
    jobId = body.jobId || null;
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }

  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user)
    return reply({ error: "authentication_required" }, 401);
  const db = createLazySupabaseServiceClient();
  const [actorResult, candidateResult] = await Promise.all([
    db.from("user_profiles")
      .select("id,role,status,organization_id,client_id,candidate_id")
      .eq("auth_user_id", identity.user.id).limit(2),
    db.from("user_profiles")
      .select("id,auth_user_id,role,status,organization_id,client_id,candidate_id")
      .eq("candidate_id", candidateId).eq("role", "candidate").limit(2),
  ]);
  if (actorResult.error || candidateResult.error)
    return reply({ error: "chat_authorization_unavailable" }, 503);
  if (actorResult.data?.length !== 1 || candidateResult.data?.length !== 1)
    return reply({ error: "conversation_not_available" }, 404);
  const actor = actorResult.data[0];
  const candidate = candidateResult.data[0];
  if (actor.role !== "client" || actor.status !== "active" || !actor.client_id ||
      !actor.organization_id || candidate.status !== "active")
    return reply({ error: "conversation_not_available" }, 404);

  const [membership, subscription, access, ownership, account, consent, verified] = await Promise.all([
    db.from("client_memberships").select("id")
      .eq("user_profile_id", actor.id).eq("client_id", actor.client_id)
      .eq("status", "active").limit(1),
    db.from("client_feature_entitlements")
      .select("status,plan_code,valid_from,valid_until")
      .eq("client_id", actor.client_id),
    db.from("client_candidate_access").select("status")
      .eq("client_id", actor.client_id).eq("candidate_id", candidateId)
      .eq("status", "active").limit(1),
    jobId ? db.from("client_job_ownership").select("status")
      .eq("client_id", actor.client_id).eq("job_id", jobId)
      .eq("status", "active").limit(1)
      : Promise.resolve({ data: [{ status: "active" }], error: null }),
    db.from("candidate_accounts").select("status")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidateId).limit(1),
    db.from("candidate_chat_contact_consents").select("consent")
      .eq("user_profile_id", candidate.id).eq("candidate_id", candidateId).limit(1),
    db.auth.admin.getUserById(candidate.auth_user_id),
  ]);
  if (membership.error || subscription.error || access.error || ownership.error ||
      account.error || consent.error || verified.error)
    return reply({ error: "chat_authorization_unavailable" }, 503);
  if (!ownership.data?.length) return reply({ error: "conversation_not_available" }, 404);

  const decision = authorizeChatConversation({
    actor: { profileId: actor.id, role: "client", active: true,
      organizationId: actor.organization_id, clientId: actor.client_id },
    recipient: { profileId: candidate.id, role: "candidate", active: true,
      candidateId: candidate.candidate_id },
    channelKind: "client_candidate",
    scope: { organizationId: actor.organization_id, candidateId, jobId },
    candidate: {
      hasAccount: Boolean(account.data?.length),
      accountActive: account.data?.[0]?.status === "active",
      identityVerified: Boolean(verified.data.user?.email_confirmed_at),
      contactConsent: consent.data?.[0]?.consent === true,
    },
    client: {
      membershipActive: Boolean(membership.data?.length),
      anySubscriptionActive: anyActiveSubscription(subscription.data || [], Date.now()),
      candidateAccessActive: Boolean(access.data?.length),
    },
  });
  if (!decision.allowed) return reply({ error: decision.code }, 403);

  const { data: conversationId, error: createError } = await db.rpc(
    "create_client_candidate_chat_conversation",
    { p_client_profile_id: actor.id, p_candidate_id: candidateId, p_job_id: jobId },
  );
  if (createError || typeof conversationId !== "string" || !uuid.test(conversationId))
    return reply({ error: "conversation_not_available" }, 503);
  return reply({ conversationId });
}
