import assert from "node:assert/strict";
import {
  withAcceptanceRegistrationEmail,
  type RegistrationEmailProvider,
} from "../lib/acceptanceCandidateRegistrationEmailCleanup";
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
  const message = {
    id: "synthetic-message",
    envelopeRecipients: [intent.email],
    receivedAt: new Date().toISOString(),
    confirmationUrls: [url.href],
  };
  for (const mode of [
    "success",
    "journey_failure",
    "changed",
    "residue",
    "provider_failure",
    "ambiguous",
  ] as const) {
    let removed = 0;
    let reads = 0;
    let journeys = 0;
    const provider: RegistrationEmailProvider = {
      list: async () => (mode === "ambiguous" ? [message, message] : [message]),
      read: async () => {
        reads++;
        if (mode === "provider_failure") throw new Error(url.href);
        if (mode === "changed")
          return { ...message, envelopeRecipients: ["other@example.invalid"] };
        return removed && mode !== "residue" ? null : message;
      },
      remove: async (id) => {
        assert.equal(id, message.id);
        removed++;
      },
    };
    const run = withAcceptanceRegistrationEmail(
      input,
      provider,
      async (link) => {
        journeys++;
        assert.equal(link, url.href);
        if (mode === "journey_failure") throw new Error(url.href);
        return "ok";
      },
    );
    if (mode === "success") assert.equal(await run, "ok");
    else
      await assert.rejects(
        run,
        mode === "journey_failure"
          ? /^Error: acceptance_registration_email_journey_unavailable$/
          : mode === "ambiguous"
            ? /^Error: acceptance_registration_email_capture_unavailable$/
            : /^Error: acceptance_registration_email_cleanup_unavailable$/,
      );
    assert.equal(
      removed,
      ["success", "journey_failure", "residue"].includes(mode) ? 1 : 0,
    );
    assert.equal(journeys, mode === "ambiguous" ? 0 : 1);
    if (mode === "ambiguous") assert.equal(reads, 0);
  }
  console.log(
    "Registration email cleanup contracts passed (mock provider only)",
  );
}
void main().catch(() => {
  console.error("Registration email cleanup contracts failed");
  process.exitCode = 1;
});
