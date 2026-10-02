const PRODUCTION_PROJECT_URL = "https://hcohaxcojpudauftbntx.supabase.co";

/** Production Auth is opt-in and must never point at staging or Acceptance. */
export function productionAuthConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.VERCEL_ENV === "production" &&
    (!env.APP_ENV || env.APP_ENV === "production") &&
    env.PRODUCTION_AUTH_ENABLED === "true" &&
    env.PRODUCTION_PRIVATE_DATA_RLS_CONFIRMED === "true" &&
    env.NEXT_PUBLIC_SUPABASE_URL === PRODUCTION_PROJECT_URL &&
    Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) &&
    (!env.SUPABASE_URL || env.SUPABASE_URL === PRODUCTION_PROJECT_URL) &&
    (!env.CANDIDATE_SUPABASE_URL ||
      env.CANDIDATE_SUPABASE_URL === PRODUCTION_PROJECT_URL)
  );
}
