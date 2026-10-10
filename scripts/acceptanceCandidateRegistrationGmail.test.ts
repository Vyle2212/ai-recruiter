import assert from "node:assert/strict";
import { createAcceptanceRegistrationGmailCapture } from "../lib/acceptanceCandidateRegistrationGmail";
import { createAcceptanceCandidateRegistrationIntent } from "../lib/acceptanceCandidateRegistrationIntent";

async function main() {
  const captureEmail = "capture@example.invalid";
  const intent = createAcceptanceCandidateRegistrationIntent(
    "0123456789abcdef",
    captureEmail,
  );
  const input = {
    intent,
    startedAt: new Date(Date.now() - 2000).toISOString(),
    projectRef: "a".repeat(20),
    acceptanceOrigin: "https://acceptance.example.invalid",
  };
  const url = new URL(`https://${input.projectRef}.supabase.co/auth/v1/verify`);
  url.searchParams.set("token", "synthetic_".repeat(4));
  url.searchParams.set("type", "signup");
  url.searchParams.set(
    "redirect_to",
    `${input.acceptanceOrigin}/auth/candidate/callback`,
  );
  const message = {
    id: "abc123",
    internalDate: String(Date.now()),
    payload: {
      mimeType: "multipart/alternative",
      headers: [{ name: "Delivered-To", value: intent.email }],
      parts: ["text/plain", "text/html"].map((mimeType) => ({
        mimeType,
        body: {
          data: Buffer.from(
            mimeType === "text/html"
              ? `<a href="${url.href.replaceAll("&", "&amp;")}">Confirm</a>`
              : url.href,
          ).toString("base64url"),
        },
      })),
    },
  };
  const requests: string[] = [];
  function mock(list: unknown, mail: unknown): typeof fetch {
    return async (target, init) => {
      const targetUrl = new URL(String(target));
      requests.push(targetUrl.pathname);
      assert.equal(targetUrl.origin, "https://gmail.googleapis.com");
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer synthetic_token_for_tests",
      );
      assert.ok(init?.signal);
      if (targetUrl.pathname.endsWith("/messages")) {
        assert.equal(targetUrl.searchParams.get("maxResults"), "10");
        assert.equal(targetUrl.searchParams.get("includeSpamTrash"), "true");
        assert.ok(
          targetUrl.searchParams
            .get("q")
            ?.startsWith(`deliveredto:${intent.email} after:`),
        );
        return Response.json(list);
      }
      assert.equal(targetUrl.pathname, "/gmail/v1/users/me/messages/abc123");
      assert.equal(targetUrl.searchParams.get("format"), "full");
      return Response.json(mail);
    };
  }
  const signal = new AbortController().signal;
  const run = (list: unknown, mail = message) =>
    createAcceptanceRegistrationGmailCapture(
      input,
      captureEmail,
      "synthetic_token_for_tests",
      mock(list, mail),
    )(signal);
  const result = await run({ messages: [{ id: message.id }] });
  assert.deepEqual(result[0].confirmationUrls, [url.href]);
  assert.equal(requests.length, 2);
  assert.deepEqual(await run({}), []);
  for (const list of [
    { messages: [{ id: "../other" }] },
    { messages: [{ id: message.id }, { id: message.id }] },
    { nextPageToken: "more", messages: [] },
    { messages: "invalid" },
  ])
    await assert.rejects(
      run(list),
      /^Error: acceptance_registration_gmail_capture_unavailable$/,
    );
  for (const mail of [
    { ...message, id: "another" },
    { ...message, internalDate: "invalid" },
    {
      ...message,
      payload: {
        ...message.payload,
        headers: [{ name: "To", value: intent.email }],
      },
    },
    {
      ...message,
      payload: {
        ...message.payload,
        headers: [{ name: "Delivered-To", value: "other@example.invalid" }],
      },
    },
    {
      ...message,
      payload: {
        ...message.payload,
        parts: [{ mimeType: "text/plain", body: { data: "!invalid!" } }],
      },
    },
  ])
    await assert.rejects(
      run({ messages: [{ id: message.id }] }, mail),
      /^Error: acceptance_registration_gmail_capture_unavailable$/,
    );
  assert.throws(() =>
    createAcceptanceRegistrationGmailCapture(
      input,
      "wrong@example.invalid",
      "synthetic_token_for_tests",
    ),
  );
  const unsafeTransport: typeof fetch = async () => {
    throw new Error(`private ${url.href}`);
  };
  await assert.rejects(
    createAcceptanceRegistrationGmailCapture(
      input,
      captureEmail,
      "synthetic_token_for_tests",
      unsafeTransport,
    )(signal),
    /^Error: acceptance_registration_gmail_capture_unavailable$/,
  );
  const oversized: typeof fetch = async () => new Response("x".repeat(256001));
  await assert.rejects(
    createAcceptanceRegistrationGmailCapture(
      input,
      captureEmail,
      "synthetic_token_for_tests",
      oversized,
    )(signal),
    /^Error: acceptance_registration_gmail_capture_unavailable$/,
  );
  console.log("Gmail capture contracts passed (mock transport only)");
}
void main().catch(() => {
  console.error("Gmail capture contracts failed");
  process.exitCode = 1;
});
