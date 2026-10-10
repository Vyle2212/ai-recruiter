import {
  authorizeCandidateCvUpload,
  validateCandidateCvWriteRequest,
} from "@/lib/candidateCvAuthorization";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Origin",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

function chatEnabled() {
  return process.env.CHAT_ENABLED === "true";
}

export async function GET() {
  if (!chatEnabled()) return reply({ error: "not_found" }, 404);
  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return reply({ error: authorization.code }, authorization.status);
  const db = createLazySupabaseServiceClient();
  const { data, error } = await db
    .from("candidate_chat_contact_consents")
    .select("consent,updated_at")
    .eq("candidate_id", authorization.scope.candidateId)
    .eq("user_profile_id", authorization.scope.userProfileId)
    .maybeSingle();
  if (error) return reply({ error: "chat_consent_unavailable" }, 503);
  return reply({
    consent: data?.consent === true,
    updatedAt: data?.updated_at || null,
  });
}

export async function POST(request: Request) {
  if (!chatEnabled()) return reply({ error: "not_found" }, 404);
  const invalid = validateCandidateCvWriteRequest(request);
  if (invalid) return reply({ error: invalid.code }, invalid.status);
  const authorization = await authorizeCandidateCvUpload();
  if (!authorization.allowed)
    return reply({ error: authorization.code }, authorization.status);

  let consent: boolean;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.consent !== "boolean"
    )
      return reply({ error: "invalid_chat_consent" }, 400);
    consent = body.consent;
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }

  const db = createLazySupabaseServiceClient();
  const { error } = await db.from("candidate_chat_contact_consents").upsert(
    {
      candidate_id: authorization.scope.candidateId,
      user_profile_id: authorization.scope.userProfileId,
      consent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id" },
  );
  if (error) return reply({ error: "chat_consent_unavailable" }, 503);
  return reply({ consent });
}
