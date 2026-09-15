import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { supabaseServerCookieOptions } from "../lib/supabaseServerCookiePolicy";

async function main() {
  for (const env of [
    { NODE_ENV: "production" },
    { APP_ENV: "acceptance" },
    { APP_ENV: "staging" },
  ]) {
    const writes: Array<{ name: string; value: string; options: any }> = [];
    const client = createServerClient(
      "https://example.supabase.co",
      "synthetic-anon-key",
      {
        cookieOptions: supabaseServerCookieOptions(env as NodeJS.ProcessEnv),
        cookies: {
          getAll: () => writes.filter((c) => c.value),
          setAll: (values) => {
            writes.push(...values);
          },
        },
        global: {
          fetch: async () =>
            new Response(
              JSON.stringify({
                access_token: "synthetic-access-token",
                refresh_token: "synthetic-refresh-token",
                expires_in: 3600,
                token_type: "bearer",
                user: {
                  id: "synthetic-user",
                  aud: "authenticated",
                  created_at: "2026-01-01T00:00:00Z",
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        },
      },
    );
    const { error } = await client.auth.signInWithPassword({
      email: "test@example.invalid",
      password: "synthetic-password",
    });
    assert.equal(error, null);
    const session = writes.filter(
      (c) => c.name.includes("auth-token") && c.value,
    );
    assert.ok(session.length > 0);
    for (const cookie of session) {
      assert.equal(cookie.options.httpOnly, true);
      assert.equal(cookie.options.secure, true);
      assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.path, "/");
    }
    writes.length = 0;
    await client.auth.refreshSession({
      refresh_token: "synthetic-refresh-token",
    });
    assert.ok(writes.length > 0);
    for (const cookie of writes) {
      assert.equal(cookie.options.httpOnly, true);
      assert.equal(cookie.options.secure, true);
    }
  }
  assert.equal(
    supabaseServerCookieOptions({ NODE_ENV: "development" }).secure,
    false,
  );
  console.log(
    "PASS actual Supabase SSR cookie serialization for sign-in and refresh: HttpOnly, Secure, SameSite, path; local HTTP development supported",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
