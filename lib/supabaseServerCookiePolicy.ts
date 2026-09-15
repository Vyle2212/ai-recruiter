/** Server-owned auth sessions: browser JavaScript must not read session tokens. */
export function supabaseServerCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
) {
  return {
    httpOnly: true,
    secure:
      env.NODE_ENV === "production" ||
      env.APP_ENV === "acceptance" ||
      env.APP_ENV === "staging",
    sameSite: "lax" as const,
    path: "/",
  };
}
