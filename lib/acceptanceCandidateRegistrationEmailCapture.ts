import { acceptanceCandidateRegistrationEmailLink } from "./acceptanceCandidateRegistrationEmail";

type Evidence = Parameters<typeof acceptanceCandidateRegistrationEmailLink>[0];
export type RegistrationCapturedEmail = Pick<
  Evidence,
  "envelopeRecipients" | "receivedAt" | "confirmationUrls"
>;

/** A reviewed provider adapter must query only this intent's mailbox.
 * No message body, URL, address or provider error is logged or returned in evidence.
 * A hung provider request is bounded even if it ignores cancellation.
 */
export async function captureAcceptanceRegistrationEmail(
  input: Omit<Evidence, keyof RegistrationCapturedEmail | "observedAt">,
  list: (signal: AbortSignal) => Promise<RegistrationCapturedEmail[]>,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("acceptance_registration_email_capture_timeout"));
    }, 15_000);
  });
  try {
    const result = await Promise.race([list(controller.signal), timeout]);
    if (!Array.isArray(result) || result.length > 10)
      throw new Error("invalid_capture");
    const matching = result.filter(
      (message) =>
        Array.isArray(message?.envelopeRecipients) &&
        message.envelopeRecipients.some(
          (recipient) =>
            typeof recipient === "string" &&
            recipient.trim().toLowerCase() === input.intent.email,
        ),
    );
    if (matching.length !== 1) throw new Error("ambiguous_capture");
    return acceptanceCandidateRegistrationEmailLink({
      ...input,
      ...matching[0],
      observedAt: new Date().toISOString(),
    });
  } catch {
    // Provider errors may contain credentials or complete mail contents.
    throw new Error("acceptance_registration_email_capture_unavailable");
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
