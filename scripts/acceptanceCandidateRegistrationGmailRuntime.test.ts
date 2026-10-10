import assert from "node:assert/strict";
import { captureAcceptanceRegistrationGmailFromSecrets } from "../lib/acceptanceCandidateRegistrationGmailRuntime";
import { createAcceptanceCandidateRegistrationIntent } from "../lib/acceptanceCandidateRegistrationIntent";
import { withAcceptanceGmailCredentials } from "../lib/acceptanceGmailCredentials.mjs";

async function main() {
  const email = "synthetic@gmail.com";
  const projectRef = "iujucosewivndjpcjbuz";
  const origin = "https://acceptance.example.invalid";
  const intent = createAcceptanceCandidateRegistrationIntent("0123456789abcdef", email);
  const input = { intent, projectRef, acceptanceOrigin: origin, startedAt: new Date(Date.now() - 2000).toISOString() };
  const env = {
    APP_ENV: "acceptance", ACCEPTANCE_TEST_MODE: "true", ACCEPTANCE_GMAIL_CAPTURE_ENABLED: "true",
    ACCEPTANCE_SUPABASE_PROJECT_REF: projectRef, CANDIDATE_REGISTRATION_CALLBACK_ORIGIN: origin,
    ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL: email,
    ACCEPTANCE_GMAIL_CLIENT_ID: "syntheticclient123.apps.googleusercontent.com",
    ACCEPTANCE_GMAIL_CLIENT_SECRET: "synthetic-secret-123456",
    ACCEPTANCE_GMAIL_REFRESH_TOKEN: "synthetic-refresh-123456",
  };
  const confirmation = new URL(`https://${projectRef}.supabase.co/auth/v1/verify`);
  confirmation.searchParams.set("token", "synthetic_confirmation_token");
  confirmation.searchParams.set("type", "signup");
  confirmation.searchParams.set("redirect_to", origin + "/auth/candidate/callback");
  const message = {
    id: "abc123", internalDate: String(Date.now()),
    payload: { mimeType: "text/plain", headers: [{ name: "Delivered-To", value: intent.email }],
      body: { data: Buffer.from(confirmation.href).toString("base64url") } },
  };
  let requests: string[] = [];
  const transport: typeof fetch = async (target, init) => {
    const url = new URL(String(target));
    requests.push(url.pathname);
    if (url.origin === "https://oauth2.googleapis.com") {
      assert.equal(url.pathname, "/token");
      assert.equal(init?.method, "POST");
      return Response.json({ token_type: "Bearer", access_token: "synthetic_access_token_123", expires_in: 3600,
        scope: "https://www.googleapis.com/auth/gmail.readonly" });
    }
    assert.equal(url.origin, "https://gmail.googleapis.com");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic_access_token_123");
    if (url.pathname.endsWith("/profile")) return Response.json({ emailAddress: email });
    if (url.pathname.endsWith("/messages")) {
      assert.ok(url.searchParams.get("q")?.startsWith("deliveredto:" + intent.email + " after:"));
      return Response.json({ messages: [{ id: "abc123" }] });
    }
    assert.equal(url.pathname, "/gmail/v1/users/me/messages/abc123");
    return Response.json(message);
  };
  const signal = new AbortController().signal;
  const result = await captureAcceptanceRegistrationGmailFromSecrets(input, env, signal, transport);
  assert.deepEqual(result[0].confirmationUrls, [confirmation.href]);
  assert.equal(requests.length, 4);
  for (const patch of [
    { ACCEPTANCE_GMAIL_CAPTURE_ENABLED: "false" }, { APP_ENV: "production" },
    { ACCEPTANCE_SUPABASE_PROJECT_REF: "wrong" }, { CANDIDATE_REGISTRATION_CALLBACK_ORIGIN: "https://wrong.invalid" },
    { ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL: "other@gmail.com" },
  ]) {
    requests = [];
    await assert.rejects(captureAcceptanceRegistrationGmailFromSecrets(input, { ...env, ...patch }, signal, transport),
      /^Error: acceptance_registration_gmail_capture_unavailable$/);
    assert.equal(requests.length, 0);
  }
  const aborted = new AbortController(); aborted.abort();
  requests = [];
  await assert.rejects(captureAcceptanceRegistrationGmailFromSecrets(input, env, aborted.signal, transport));
  assert.equal(requests.length, 0);
  await assert.rejects(withAcceptanceGmailCredentials(env, async () => {
    throw new Error("private confirmation " + confirmation.href);
  }, transport), /^Error: acceptance_gmail_credentials_unavailable$/);
  console.log("Gmail refreshed capture runtime contracts PASS (mocked; no live email, signup or cleanup).");
}
void main().catch(() => { console.error("Gmail refreshed capture runtime contracts failed"); process.exitCode = 1; });
