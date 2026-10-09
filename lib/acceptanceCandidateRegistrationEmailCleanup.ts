import {
  captureAcceptanceRegistrationEmail,
  type RegistrationCapturedEmail,
} from "./acceptanceCandidateRegistrationEmailCapture";

type Input = Parameters<typeof captureAcceptanceRegistrationEmail>[0];
type Message = RegistrationCapturedEmail & { id: string };
export type RegistrationEmailProvider = {
  list: (signal: AbortSignal) => Promise<Message[]>;
  read: (id: string, signal: AbortSignal) => Promise<Message | null>;
  remove: (id: string, signal: AbortSignal) => Promise<void>;
};

async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("provider_timeout"));
        }, 15_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

/** Adapters must be reviewed and scoped to the persisted run intent's alias.
 * Confirmation URLs and provider IDs remain in memory, never evidence.
 * Cleanup failure blocks success, including when the signup journey fails.
 */
export async function withAcceptanceRegistrationEmail<T>(
  input: Input,
  provider: RegistrationEmailProvider,
  journey: (confirmationUrl: string) => Promise<T>,
): Promise<T> {
  let selected: Message | undefined;
  const url = await captureAcceptanceRegistrationEmail(
    input,
    async (signal) => {
      const messages = await provider.list(signal);
      if (!Array.isArray(messages)) throw new Error("invalid_messages");
      const matching = messages.filter((message) =>
        message?.envelopeRecipients?.some(
          (recipient) =>
            typeof recipient === "string" &&
            recipient.trim().toLowerCase() === input.intent.email,
        ),
      );
      if (matching.length === 1) selected = matching[0];
      return messages;
    },
  );
  if (!selected || !/^[A-Za-z0-9_-]{1,256}$/.test(selected.id))
    throw new Error("acceptance_registration_email_cleanup_identity_invalid");
  const owned = structuredClone(selected);
  try {
    return await journey(url);
  } catch {
    throw new Error("acceptance_registration_email_journey_unavailable");
  } finally {
    try {
      const fresh = await bounded((signal) => provider.read(owned.id, signal));
      if (
        !fresh ||
        fresh.id !== owned.id ||
        JSON.stringify(fresh.envelopeRecipients) !==
          JSON.stringify(owned.envelopeRecipients) ||
        fresh.receivedAt !== owned.receivedAt ||
        JSON.stringify(fresh.confirmationUrls) !==
          JSON.stringify(owned.confirmationUrls)
      )
        throw new Error("identity_changed");
      await bounded((signal) => provider.remove(owned.id, signal));
      if (await bounded((signal) => provider.read(owned.id, signal)))
        throw new Error("residue");
    } catch {
      throw new Error("acceptance_registration_email_cleanup_unavailable");
    }
  }
}
