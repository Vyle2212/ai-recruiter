import assert from "node:assert/strict";
import { acceptanceCandidateRegistrationEmailLink } from "../lib/acceptanceCandidateRegistrationEmail";
import { createAcceptanceCandidateRegistrationIntent } from "../lib/acceptanceCandidateRegistrationIntent";
const projectRef = "a".repeat(20);
const origin = "https://acceptance.example.invalid";
const link = new URL(`https://${projectRef}.supabase.co/auth/v1/verify`);
link.searchParams.set("token", "synthetic_".repeat(4));
link.searchParams.set("type", "signup");
link.searchParams.set("redirect_to", `${origin}/auth/candidate/callback`);
const intent = createAcceptanceCandidateRegistrationIntent(
  "0123456789abcdef",
  "capture@example.invalid",
);
const good = {
  intent,
  envelopeRecipients: [intent.email],
  receivedAt: "2026-10-09T01:01:00Z",
  startedAt: "2026-10-09T01:00:00Z",
  observedAt: "2026-10-09T01:02:00Z",
  projectRef,
  acceptanceOrigin: origin,
  confirmationUrls: [link.href],
};
assert.equal(acceptanceCandidateRegistrationEmailLink(good), link.href);
for (const patch of [
  { envelopeRecipients: ["other@example.invalid"] },
  { envelopeRecipients: [intent.email, "other@example.invalid"] },
  { receivedAt: "2026-10-09T00:59:59Z" },
  { receivedAt: "2026-10-09T01:03:00Z" },
  { startedAt: "invalid" },
  { observedAt: "2026-10-09T01:16:00Z" },
  { projectRef: "b".repeat(20) },
  { acceptanceOrigin: "http://acceptance.example.invalid" },
  { confirmationUrls: [] },
  { confirmationUrls: [link.href, link.href] },
])
  assert.throws(
    () => acceptanceCandidateRegistrationEmailLink({ ...good, ...patch }),
    /email_evidence_invalid/,
  );
for (const mutate of [
  (u: URL) => {
    u.hostname = "untrusted.example.invalid";
  },
  (u: URL) => {
    u.pathname = "/other";
  },
  (u: URL) => {
    u.hash = "fragment";
  },
  (u: URL) => {
    u.searchParams.set("type", "recovery");
  },
  (u: URL) => {
    u.searchParams.set("redirect_to", "https://other.example.invalid");
  },
  (u: URL) => {
    u.searchParams.append("type", "signup");
  },
  (u: URL) => {
    u.searchParams.set("extra", "value");
  },
  (u: URL) => {
    u.searchParams.set("token", "short");
  },
]) {
  const changed = new URL(link);
  mutate(changed);
  assert.throws(
    () =>
      acceptanceCandidateRegistrationEmailLink({
        ...good,
        confirmationUrls: [changed.href],
      }),
    /email_evidence_invalid/,
  );
}
console.log(
  "Registration email evidence contracts passed (synthetic only; no email or Auth calls)",
);
