import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { candidateCallbackCookies } from "../lib/candidateCallbackCookies";
import {
  verifyCandidateConfirmation,
  provisionCandidateRegistration,
} from "../lib/candidateRegistrationCallback";

async function main() {
  const originalFetch = globalThis.fetch;
  try {
    for (const mode of [
      "ready",
      "unconfirmed",
      "review",
      "rpc_error",
      "logout_error",
    ] as const) {
      const user = {
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "synthetic@example.invalid",
        app_metadata: {},
        user_metadata: { registration_full_name: "Synthetic Candidate" },
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at:
          mode === "unconfirmed" ? null : "2026-01-01T00:00:00Z",
      };
      const token = [
        Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
        Buffer.from(
          JSON.stringify({
            sub: user.id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url"),
        "synthetic-signature",
      ].join(".");
      const requests: string[] = [];
      globalThis.fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        assert.equal(url.origin, "https://callback-synthetic.invalid");
        requests.push(url.pathname);
        if (url.pathname === "/auth/v1/token") {
          assert.equal(url.searchParams.get("grant_type"), "pkce");
          assert.equal(
            JSON.parse(String(init?.body)).code_verifier,
            "synthetic-verifier",
          );
          return Response.json({
            user,
            access_token: token,
            refresh_token: "synthetic-refresh",
            expires_in: 3600,
            token_type: "bearer",
          });
        }
        if (url.pathname === "/auth/v1/user") return Response.json(user);
        if (url.pathname === "/auth/v1/logout") {
          assert.equal(url.searchParams.get("scope"), "local");
          return new Response(
            mode === "logout_error"
              ? JSON.stringify({ msg: "synthetic failure" })
              : null,
            { status: mode === "logout_error" ? 500 : 204 },
          );
        }
        throw new Error("Unexpected mocked Auth request");
      };
      const staged = candidateCallbackCookies([
        {
          name: "sb-callback-synthetic-auth-token",
          value: "unrelated-session",
        },
        {
          name: "sb-callback-synthetic-auth-token-code-verifier",
          value:
            "base64-" +
            Buffer.from(JSON.stringify("synthetic-verifier")).toString(
              "base64url",
            ),
        },
      ]);
      const auth = createServerClient(
        "https://callback-synthetic.invalid",
        "synthetic-public-key",
        { cookies: staged },
      );
      const identity = await verifyCandidateConfirmation(
        "synthetic-code-123456",
        {
          exchangeCodeForSession: (code) =>
            auth.auth.exchangeCodeForSession(code),
          getUser: () => auth.auth.getUser(),
        },
      );
      assert.equal(identity.verified, mode !== "unconfirmed");
      let calls = 0;
      const result = identity.verified
        ? await provisionCandidateRegistration(identity, async () => {
            calls++;
            if (mode === "rpc_error") throw new Error("synthetic RPC failure");
            return {
              data: {
                status:
                  mode === "ready" ? "created" : "identity_review_required",
              },
              error: null,
            };
          })
        : "invalid";
      assert.equal(calls, mode === "unconfirmed" ? 0 : 1);
      if (result !== "ready") await auth.auth.signOut({ scope: "local" });
      const writes: unknown[] = [];
      staged.commit(result, (cookie) => writes.push(cookie));
      assert.equal(writes.length > 0, mode === "ready");
      assert.deepEqual(requests.slice(0, 2), [
        "/auth/v1/token",
        "/auth/v1/user",
      ]);
      auth.auth.stopAutoRefresh();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("Candidate callback SSR integration PASS (mock network only)");
}
void main();
