import assert from "node:assert/strict";
import { captureAcceptanceRegistrationEmail } from "../lib/acceptanceCandidateRegistrationEmailCapture";
import { createAcceptanceCandidateRegistrationIntent } from "../lib/acceptanceCandidateRegistrationIntent";
async function main() {
  const intent = createAcceptanceCandidateRegistrationIntent(
    "0123456789abcdef",
    "capture@example.invalid",
  );
  const projectRef = "a".repeat(20);
  const acceptanceOrigin = "https://acceptance.example.invalid";
  const url = new URL(`https://${projectRef}.supabase.co/auth/v1/verify`);
  url.searchParams.set("token", "synthetic_".repeat(4));
  url.searchParams.set("type", "signup");
  url.searchParams.set(
    "redirect_to",
    `${acceptanceOrigin}/auth/candidate/callback`,
  );
  const input = {
    intent,
    projectRef,
    acceptanceOrigin,
    startedAt: new Date(Date.now() - 1000).toISOString(),
  };
  const mail = {
    envelopeRecipients: [intent.email],
    receivedAt: new Date().toISOString(),
    confirmationUrls: [url.href],
  };
  let signal: AbortSignal | undefined;
  let calls = 0;
  assert.equal(
    await captureAcceptanceRegistrationEmail(input, async (s) => {
      signal = s;
      calls++;
      return [mail];
    }),
    url.href,
  );
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
  for (const messages of [
    [],
    [mail, mail],
    Array(11).fill(mail),
    [{ ...mail, envelopeRecipients: [intent.email, "other@example.invalid"] }],
    [{ ...mail, confirmationUrls: ["invalid"] }],
  ]) {
    await assert.rejects(
      captureAcceptanceRegistrationEmail(input, async () => messages),
      /^Error: acceptance_registration_email_capture_unavailable$/,
    );
  }
  await assert.rejects(
    captureAcceptanceRegistrationEmail(input, async () => {
      throw new Error(`private provider error ${url.href}`);
    }),
    /^Error: acceptance_registration_email_capture_unavailable$/,
  );
  let hungSignal: AbortSignal | undefined;
  await assert.rejects(
    captureAcceptanceRegistrationEmail(input, async (s) => {
      hungSignal = s;
      return new Promise(() => {});
    }),
    /^Error: acceptance_registration_email_capture_unavailable$/,
  );
  assert.equal(hungSignal?.aborted, true);
  console.log(
    "Registration email capture contracts passed (mock transport only)",
  );
}
void main().catch(() => {
  console.error("Registration email capture contracts failed");
  process.exitCode = 1;
});
