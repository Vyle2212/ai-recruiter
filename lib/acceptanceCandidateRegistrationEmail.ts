import type { AcceptanceCandidateRegistrationIntent } from "./acceptanceCandidateRegistrationIntent";
import { candidateRegistrationCallback } from "./candidateRegistrationRequest";

/** Provider adapters supply envelope recipients, not addresses parsed from email HTML.
 * The returned URL is a credential: keep it in memory and never include it in evidence.
 * This validates capture evidence only; it never sends mail or confirms an account.
 */
export function acceptanceCandidateRegistrationEmailLink(input: {
  intent: AcceptanceCandidateRegistrationIntent;
  envelopeRecipients: string[];
  receivedAt: string;
  startedAt: string;
  observedAt: string;
  projectRef: string;
  acceptanceOrigin: string;
  confirmationUrls: string[];
}): string {
  const fail = () => {
    throw new Error("acceptance_registration_email_evidence_invalid");
  };
  const start = Date.parse(input.startedAt);
  const received = Date.parse(input.receivedAt);
  const observed = Date.parse(input.observedAt);
  if (
    ![start, received, observed].every(Number.isFinite) ||
    observed < start ||
    observed - start > 15 * 60_000 ||
    received < start ||
    received > observed
  )
    fail();
  if (
    input.envelopeRecipients.length !== 1 ||
    input.envelopeRecipients[0].trim().toLowerCase() !== input.intent.email
  )
    fail();
  const callback = candidateRegistrationCallback(input.acceptanceOrigin);
  if (
    !callback ||
    !/^[a-z0-9]{20}$/.test(input.projectRef) ||
    input.confirmationUrls.length !== 1
  )
    fail();
  const raw = input.confirmationUrls[0];
  if (raw.length > 4096) fail();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail();
  }
  if (
    url.origin !== `https://${input.projectRef}.supabase.co` ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.pathname !== "/auth/v1/verify"
  )
    fail();
  const keys = [...url.searchParams.keys()];
  if (
    keys.length !== 3 ||
    new Set(keys).size !== 3 ||
    keys.some((key) => !["token", "type", "redirect_to"].includes(key)) ||
    url.searchParams.get("type") !== "signup" ||
    url.searchParams.get("redirect_to") !== callback
  )
    fail();
  const token = url.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(token)) fail();
  return url.href;
}
