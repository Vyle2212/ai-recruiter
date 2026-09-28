import "server-only";

import { createLazySupabaseServiceClient } from "./runtimeClients";
import { createClient } from "@/utils/supabase/server";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type ConversationCreationInput = {
  candidateId: string;
  jobId: string | null;
};

type Denial = { allowed: false; status: number; code: string };
type Success = {
  allowed: true;
  conversationId: string;
};

export function parseConversationCreationInput(value: unknown):
  | { ok: true; value: ConversationCreationInput }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort().join(",");
  if (keys !== "candidateId" && keys !== "candidateId,jobId") return { ok: false };
  if (typeof body.candidateId !== "string" || !uuid.test(body.candidateId))
    return { ok: false };
  if (body.jobId !== undefined &&
      (typeof body.jobId !== "string" || !uuid.test(body.jobId)))
    return { ok: false };
  return {
    ok: true,
    value: { candidateId: body.candidateId, jobId: (body.jobId as string | undefined) ?? null },
  };
}

const denied = (code: string, status: number): Denial =>
  ({ allowed: false, status, code });

/** Authenticate the browser actor; the SQL RPC independently rechecks all mutable grants. */
export async function createClientCandidateConversation(
  input: ConversationCreationInput,
): Promise<Denial | Success> {
  const auth = await createClient();
  const { data: identity, error: identityError } = await auth.auth.getUser();
  if (identityError || !identity.user) return denied("authentication_required", 401);

  const db = createLazySupabaseServiceClient();
  const { data: actor, error: actorError } = await db.from("user_profiles")
    .select("id,role,status")
    .eq("auth_user_id", identity.user.id)
    .maybeSingle();
  if (actorError) return denied("chat_authorization_unavailable", 503);
  if (!actor || actor.role !== "client" || actor.status !== "active")
    return denied("active_client_profile_required", 403);

  const { data, error } = await db.rpc("create_client_candidate_chat_conversation", {
    p_client_profile_id: actor.id,
    p_candidate_id: input.candidateId,
    p_job_id: input.jobId,
  });
  if (error) {
    if (error.code === "P0001") return denied("conversation_not_available", 404);
    return denied("chat_store_unavailable", 503);
  }
  if (typeof data !== "string" || !uuid.test(data))
    return denied("chat_store_unavailable", 503);
  return {
    allowed: true,
    conversationId: data,
  };
}
