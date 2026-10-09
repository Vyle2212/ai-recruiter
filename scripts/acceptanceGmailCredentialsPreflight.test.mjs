import assert from "node:assert/strict";
import { verifyAcceptanceGmailCredentials } from "./acceptanceGmailCredentialsPreflight.mjs";
const env = {
  APP_ENV: "acceptance", ACCEPTANCE_TEST_MODE: "true",
  ACCEPTANCE_GMAIL_CLIENT_ID: "syntheticclient123.apps.googleusercontent.com",
  ACCEPTANCE_GMAIL_CLIENT_SECRET: "synthetic-secret-123456",
  ACCEPTANCE_GMAIL_REFRESH_TOKEN: "synthetic-refresh-123456",
  ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL: "synthetic@gmail.com",
};
let calls = [];
const token = { token_type: "Bearer", access_token: "synthetic-access-token-123456", expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.readonly" };
const transport = async (url, init) => {
  calls.push(url);
  assert.equal(init.redirect, "error");
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);
  if (url === "https://oauth2.googleapis.com/token") {
    assert.equal(init.method, "POST");
    assert.equal(init.body.get("refresh_token"), env.ACCEPTANCE_GMAIL_REFRESH_TOKEN);
    return Response.json(token);
  }
  assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
  assert.equal(init.method, "GET");
  assert.equal(init.headers.Authorization, "Bearer " + token.access_token);
  return Response.json({ emailAddress: env.ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL });
};
assert.deepEqual(await verifyAcceptanceGmailCredentials(env, transport), {
  status: "PASS_CREDENTIALS_ONLY", mailboxMatched: true, signupVerified: false, cleanupVerified: false,
});
assert.equal(calls.length, 2);
for (const patch of [{ APP_ENV: "production" }, { ACCEPTANCE_TEST_MODE: "false" }, { ACCEPTANCE_GMAIL_REFRESH_TOKEN: "" }, { ACCEPTANCE_GMAIL_CLIENT_ID: "wrong" }, { ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL: "" }]) {
  calls = [];
  await assert.rejects(verifyAcceptanceGmailCredentials({ ...env, ...patch }, transport), /^Error: acceptance_gmail_credentials_unavailable$/);
  assert.equal(calls.length, 0);
}
for (const reply of [
  () => Response.json({ error: env.ACCEPTANCE_GMAIL_CLIENT_SECRET }, { status: 400 }),
  () => Response.json({ ...token, scope: "https://mail.google.com/" }),
  () => Response.json({ ...token, expires_in: 0 }),
  () => new Response("x".repeat(16385)),
  () => new Response("{broken"),
]) {
  await assert.rejects(verifyAcceptanceGmailCredentials(env, async () => reply()), /^Error: acceptance_gmail_credentials_unavailable$/);
}
await assert.rejects(verifyAcceptanceGmailCredentials(env, async (url) => Response.json(
  url.endsWith("/token") ? token : { emailAddress: "different@gmail.com" }
)), /^Error: acceptance_gmail_credentials_unavailable$/);
await assert.rejects(verifyAcceptanceGmailCredentials(env, async () => { throw new Error(env.ACCEPTANCE_GMAIL_REFRESH_TOKEN); }), /^Error: acceptance_gmail_credentials_unavailable$/);
console.log("Gmail credential preflight contracts PASS (mocked transport; no live credentials).");
