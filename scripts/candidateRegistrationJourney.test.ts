import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createCandidateRegistrationClient } from "../utils/supabase/registration";
import { candidateRegistrationCookies } from "../lib/candidateRegistrationCookies";
import { candidateCallbackCookies } from "../lib/candidateCallbackCookies";
import { candidateRegistrationOutcome } from "../lib/candidateRegistrationOutcome";
import {
  verifyCandidateConfirmation,
  provisionCandidateRegistration,
} from "../lib/candidateRegistrationCallback";

async function main() {
  const originalFetch = globalThis.fetch;
  try {
    for (const mode of ["ready", "wrong_verifier"] as const) {
      const user = {
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "journey@example.invalid",
        app_metadata: {},
        user_metadata: { registration_full_name: "Synthetic Journey" },
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:00:00Z",
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
      let challenge = "";
      const requests: string[] = [];
      globalThis.fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        assert.equal(url.origin, "https://journey-synthetic.invalid");
        requests.push(url.pathname);
        const body = JSON.parse(String(init?.body || "{}"));
        if (url.pathname === "/auth/v1/signup") {
          assert.equal(body.code_challenge_method, "s256");
          assert.equal(
            body.gotrue_meta_security.captcha_token,
            "synthetic-captcha",
          );
          assert.equal(
            url.searchParams.get("redirect_to"),
            "https://acceptance.example.invalid/auth/candidate/callback",
          );
          challenge = body.code_challenge;
          assert.ok(challenge);
          return Response.json({ user: { ...user, email_confirmed_at: null } });
        }
        if (url.pathname === "/auth/v1/token") {
          assert.equal(url.searchParams.get("grant_type"), "pkce");
          assert.equal(body.auth_code, "synthetic-confirmation-code");
          const matches =
            createHash("sha256")
              .update(body.code_verifier)
              .digest("base64url") === challenge;
          assert.equal(matches, mode === "ready");
          if (!matches)
            return Response.json(
              { msg: "synthetic invalid verifier" },
              { status: 400 },
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
        throw new Error("Unexpected journey transport request");
      };
      const signupCookies = candidateRegistrationCookies();
      const signup = createCandidateRegistrationClient(
        "https://journey-synthetic.invalid",
        "synthetic-public-key",
        signupCookies,
      );
      const outcome = await candidateRegistrationOutcome(() =>
        signup.auth.signUp({
          email: user.email,
          password: "Synthetic-only-password-123!",
          options: {
            captchaToken: "synthetic-captcha",
            data: user.user_metadata,
            emailRedirectTo:
              "https://acceptance.example.invalid/auth/candidate/callback",
          },
        }),
      );
      assert.equal(outcome.status, 202);
      const browserCookies: Array<{ name: string; value: string }> = [];
      signupCookies.commit(outcome, (cookie) => browserCookies.push(cookie));
      assert.equal(browserCookies.length, 1);
      assert.ok(browserCookies[0].name.endsWith("-code-verifier"));
      if (mode === "wrong_verifier")
        browserCookies[0].value =
          "base64-" +
          Buffer.from(JSON.stringify("wrong-verifier")).toString("base64url");
      browserCookies.push({
        name: "sb-journey-synthetic-auth-token",
        value: "unrelated-session",
      });
      const callbackCookies = candidateCallbackCookies(browserCookies);
      assert.equal(callbackCookies.getAll().length, 1);
      const callback = createServerClient(
        "https://journey-synthetic.invalid",
        "synthetic-public-key",
        { cookies: callbackCookies },
      );
      const identity = await verifyCandidateConfirmation(
        "synthetic-confirmation-code",
        {
          exchangeCodeForSession: (code) =>
            callback.auth.exchangeCodeForSession(code),
          getUser: () => callback.auth.getUser(),
        },
      );
      assert.equal(identity.verified, mode === "ready");
      let provisionCalls = 0;
      const result = identity.verified
        ? await provisionCandidateRegistration(identity, async (args) => {
            provisionCalls++;
            assert.deepEqual(args, {
              p_auth_user_id: user.id,
              p_email: user.email,
              p_full_name: user.user_metadata.registration_full_name,
            });
            return { data: { status: "created" }, error: null };
          })
        : "invalid";
      const released: unknown[] = [];
      callbackCookies.commit(result, (cookie) => released.push(cookie));
      assert.equal(provisionCalls, mode === "ready" ? 1 : 0);
      assert.equal(released.length > 0, mode === "ready");
      assert.deepEqual(
        requests,
        mode === "ready"
          ? ["/auth/v1/signup", "/auth/v1/token", "/auth/v1/user"]
          : ["/auth/v1/signup", "/auth/v1/token"],
      );
      signup.auth.stopAutoRefresh();
      callback.auth.stopAutoRefresh();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(
    "Signup-to-callback PKCE journey passed (mock transport only; no live email/Auth/DB)",
  );
}
void main().catch(() => {
  console.error("Registration journey contract failed");
  process.exitCode = 1;
});
