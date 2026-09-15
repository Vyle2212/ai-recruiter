/** Acceptance authentication is opt-in and isolated from staging approvals. */
export function acceptanceAuthConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (
    env.APP_ENV !== "acceptance" ||
    env.ACCEPTANCE_TEST_MODE !== "true" ||
    env.ACCEPTANCE_AUTH_ENABLED !== "true" ||
    env.PRODUCTION_AUTH_ENABLED === "true"
  )
    return false;
  const ref = env.ACCEPTANCE_SUPABASE_PROJECT_REF || "";
  const list = (value: string | undefined) =>
    (value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const denied = [
    "hcohaxcojpudauftbntx",
    "grppxoecxmltiqxelukf",
    ...list(env.ACCEPTANCE_PRODUCTION_PROJECT_REF_DENYLIST),
  ];
  if (
    !/^[a-z0-9]{20}$/.test(ref) ||
    denied.includes(ref) ||
    !list(env.ACCEPTANCE_SUPABASE_PROJECT_REF_ALLOWLIST).includes(ref) ||
    !env.ACCEPTANCE_ENVIRONMENT_ID ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return false;
  // Exact origins prevent credential forwarding to an alternate host or path.
  const origin = `https://${ref}.supabase.co`;
  return (
    env.NEXT_PUBLIC_SUPABASE_URL === origin &&
    [env.SUPABASE_URL, env.CANDIDATE_SUPABASE_URL].every(
      (value) => !value || value === origin,
    )
  );
}
