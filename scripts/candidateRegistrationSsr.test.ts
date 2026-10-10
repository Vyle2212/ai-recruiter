import assert from "node:assert/strict";
import { createCandidateRegistrationClient } from "../utils/supabase/registration";
import { candidateRegistrationCookies } from "../lib/candidateRegistrationCookies";
import { candidateRegistrationOutcome } from "../lib/candidateRegistrationOutcome";

async function main() {
  const originalFetch = globalThis.fetch;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  try {
    for (const mode of ["pending", "session", "error"] as const) {
      let requests = 0;
      globalThis.fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        assert.equal(url.origin, "https://registration-synthetic.invalid");
        assert.equal(url.pathname, "/auth/v1/signup");
        assert.equal(init?.method, "POST");
        requests++;
        const body = JSON.parse(String(init?.body));
        assert.equal(body.code_challenge_method, "s256");
        assert.ok(body.code_challenge);
        assert.equal(
          body.gotrue_meta_security.captcha_token,
          "synthetic-captcha",
        );
        const token = [
          Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
            "base64url",
          ),
          Buffer.from(
            JSON.stringify({
              sub: user.id,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ).toString("base64url"),
          "synthetic-signature",
        ].join(".");
        return Response.json(
          mode === "pending"
            ? { user }
            : mode === "session"
              ? {
                  user,
                  access_token: token,
                  refresh_token: "synthetic-refresh",
                  token_type: "bearer",
                  expires_in: 3600,
                }
              : { msg: "synthetic provider failure" },
          { status: mode === "error" ? 422 : 200 },
        );
      };
      const staged = candidateRegistrationCookies();
      const auth = createCandidateRegistrationClient(
        "https://registration-synthetic.invalid",
        "synthetic-public-key",
        staged,
      );
      const outcome = await candidateRegistrationOutcome(() =>
        auth.auth.signUp({
          email: user.email,
          password: "Synthetic-only-password-123!",
          options: {
            captchaToken: "synthetic-captcha",
            emailRedirectTo:
              "https://app.example.invalid/auth/candidate/callback",
          },
        }),
      );
      assert.equal(requests, 1);
      assert.equal(outcome.status, mode === "pending" ? 202 : 503);
      const writes: Array<{ name: string; value: string }> = [];
      staged.commit(outcome, (value) => writes.push(value));
      if (mode === "pending") {
        assert.equal(writes.length, 1);
        assert.ok(writes[0].name.endsWith("-code-verifier"));
      } else assert.deepEqual(writes, []);
      assert.deepEqual(staged.getAll(), []);
      assert.equal(
        JSON.stringify(outcome).includes("synthetic-refresh"),
        false,
      );
      auth.auth.stopAutoRefresh();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(
    "Candidate registration SSR integration PASS (mock Auth only, no network)",
  );
}
void main();
