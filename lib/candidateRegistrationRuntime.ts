import {
  candidateRegistrationCallback,
  parseCandidateRegistrationInput,
} from "./candidateRegistrationRequest";

export const candidateRegistrationPrivateHeaders = {
  "Cache-Control": "private, no-store",
} as const;

function candidateRegistrationSupabaseConfiguration(
  env: Record<string, string | undefined>,
) {
  const projectRef =
    env.CANDIDATE_REGISTRATION_SUPABASE_PROJECT_REF?.trim() || "";
  const configuredUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!/^[a-z0-9]{20}$/.test(projectRef)) return null;
  try {
    const url = new URL(configuredUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.hostname !== `${projectRef}.supabase.co`
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function candidateRegistrationCallbackConfiguration(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.CANDIDATE_REGISTRATION_ENABLED !== "true")
    return { enabled: false as const, status: 404 as const, code: "not_found" };
  const callback = candidateRegistrationCallback(
    env.CANDIDATE_REGISTRATION_ORIGIN || "",
  );
  if (
    !callback ||
    !env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !candidateRegistrationSupabaseConfiguration(env) ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
    return {
      enabled: false as const,
      status: 503 as const,
      code: "candidate_registration_not_configured",
    };
  const requestUrl = new URL(request.url);
  const callbackUrl = new URL(callback);
  if (
    requestUrl.origin !== callbackUrl.origin ||
    requestUrl.pathname !== callbackUrl.pathname ||
    requestUrl.hash
  )
    return {
      enabled: false as const,
      status: 403 as const,
      code: "candidate_registration_callback_blocked",
    };
  return { enabled: true as const, origin: callbackUrl.origin };
}

export function candidateRegistrationResultUrl(
  origin: string,
  result: "ready" | "invalid" | "review_required" | "temporarily_unavailable",
) {
  if (result === "ready") return new URL("/candidate/portal", origin);
  const url = new URL("/auth/signup", origin);
  url.searchParams.set("status", result);
  return url;
}

export function candidateRegistrationUiConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const callback = candidateRegistrationCallback(
    env.CANDIDATE_REGISTRATION_ORIGIN || "",
  );
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  if (
    env.CANDIDATE_REGISTRATION_ENABLED !== "true" ||
    !callback ||
    !candidateRegistrationSupabaseConfiguration(env) ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    !env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !/^[A-Za-z0-9_-]{3,256}$/.test(siteKey)
  )
    return { enabled: false as const };
  return { enabled: true as const, turnstileSiteKey: siteKey };
}

export function candidateRegistrationConfiguration(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.CANDIDATE_REGISTRATION_ENABLED !== "true")
    return { enabled: false as const, status: 404 as const, code: "not_found" };
  const configuredCallback = candidateRegistrationCallback(
    env.CANDIDATE_REGISTRATION_ORIGIN || "",
  );
  if (!configuredCallback)
    return {
      enabled: false as const,
      status: 503 as const,
      code: "candidate_registration_not_configured",
    };
  if (
    new URL(request.url).origin !== new URL(configuredCallback).origin ||
    request.headers.get("origin") !== new URL(configuredCallback).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return {
      enabled: false as const,
      status: 403 as const,
      code: "same_origin_required",
    };
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return {
      enabled: false as const,
      status: 415 as const,
      code: "json_request_required",
    };
  const length = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(length) || length < 1 || length > 8192)
    return {
      enabled: false as const,
      status: 413 as const,
      code: "candidate_registration_request_too_large",
    };
  const supabaseUrl = candidateRegistrationSupabaseConfiguration(env);
  if (!supabaseUrl || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
    return {
      enabled: false as const,
      status: 503 as const,
      code: "candidate_registration_not_configured",
    };
  return {
    enabled: true as const,
    callback: configuredCallback,
    supabaseUrl,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function readCandidateRegistrationInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    if (bytes !== Number(request.headers.get("content-length"))) return null;
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value = new TextDecoder("utf-8", { fatal: true }).decode(combined);
    return parseCandidateRegistrationInput(JSON.parse(value));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
