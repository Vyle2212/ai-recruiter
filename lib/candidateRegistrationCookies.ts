import type { WritableCookie } from "./supabaseServerCookieAdapter";

// Registration must not inherit or replace an existing authenticated session.
// Buffer SSR writes until the provider proves confirmation is still pending.
export function candidateRegistrationCookies() {
  const pending = new Map<string, WritableCookie>();
  return {
    getAll() {
      return Array.from(pending.values(), ({ name, value }) => ({
        name,
        value,
      }));
    },
    setAll(values: WritableCookie[]) {
      for (const cookie of values) pending.set(cookie.name, cookie);
    },
    commit(
      outcome: { status: number; body: { status?: string } },
      write: (cookie: WritableCookie) => void,
    ) {
      if (
        outcome.status !== 202 ||
        outcome.body.status !== "verification_pending"
      ) {
        pending.clear();
        return;
      }
      // Never publish a session cookie, even if the provider's response is inconsistent.
      for (const cookie of pending.values()) {
        if (!cookie.name.endsWith("-code-verifier")) continue;
        write(cookie);
      }
      pending.clear();
    },
  };
}
