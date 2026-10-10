import type { WritableCookie } from "./supabaseServerCookieAdapter";

// Only the PKCE verifier is inherited. A previous browser session must not
// authenticate this confirmation or be replaced on a failed callback.
export function candidateCallbackCookies(
  incoming: { name: string; value: string }[],
) {
  const values = new Map(
    incoming
      .filter((cookie) => cookie.name.endsWith("-code-verifier"))
      .map((cookie) => [cookie.name, cookie]),
  );
  const pending = new Map<string, WritableCookie>();
  return {
    getAll: () => Array.from(values.values()),
    setAll(cookies: WritableCookie[]) {
      for (const cookie of cookies) {
        values.set(cookie.name, { name: cookie.name, value: cookie.value });
        pending.set(cookie.name, cookie);
      }
    },
    commit(result: string, write: (cookie: WritableCookie) => void) {
      if (result === "ready")
        for (const cookie of pending.values()) write(cookie);
      pending.clear();
    },
  };
}
