import { createAcceptanceRegistrationGmailCapture } from "./acceptanceCandidateRegistrationGmail";
import { withAcceptanceRegistrationEmail, type RegistrationEmailProvider } from "./acceptanceCandidateRegistrationEmailCleanup";
import { withAcceptanceGmailCredentials } from "./acceptanceGmailCredentials.mjs";
import { parseAcceptanceCandidateRegistrationIntent } from "./acceptanceCandidateRegistrationIntent";

type Input = Parameters<typeof createAcceptanceRegistrationGmailCapture>[0];
const base = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const fail = () => new Error("acceptance_registration_gmail_cleanup_unavailable");

/** Inactive runner helper. Only IDs captured and revalidated for this run can be removed.
 * No sending, batch deletion, HTTP route, or logging of provider IDs/URLs. */
export async function withAcceptanceRegistrationGmailCleanup<T>(
  input: Input, env: Record<string, string | undefined>,
  journey: (confirmationUrl: string) => Promise<T>, transport: typeof fetch = fetch,
): Promise<T> {
  try {
    if (env.APP_ENV !== "acceptance" || env.ACCEPTANCE_TEST_MODE !== "true" ||
        env.ACCEPTANCE_GMAIL_CLEANUP_ENABLED !== "true" ||
        env.ACCEPTANCE_GMAIL_CREDENTIAL_MODE !== "dedicated-cleanup-preflight" ||
        env.ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL !== "lekhanhha3005@gmail.com" ||
        input.projectRef !== "iujucosewivndjpcjbuz" ||
        env.ACCEPTANCE_SUPABASE_PROJECT_REF !== input.projectRef ||
        env.CANDIDATE_REGISTRATION_CALLBACK_ORIGIN !== input.acceptanceOrigin) throw fail();
    const mailbox = env.ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL;
    parseAcceptanceCandidateRegistrationIntent(JSON.stringify(input.intent), input.intent.runHash, mailbox);
    return await withAcceptanceGmailCredentials(env, async (token: string) => {
      const owned = new Map<string, { id: string; envelopeRecipients: string[]; receivedAt: string; confirmationUrls: string[] }>();
      const removed = new Set<string>();
      const headers = { Authorization: "Bearer " + token };
      const capture = (singleId?: string, observe?: (ids: string[]) => void) =>
        createAcceptanceRegistrationGmailCapture(input, mailbox, token, async (target, init) => {
          const url = new URL(String(target));
          if (url.origin !== "https://gmail.googleapis.com" || init?.method !== "GET") throw fail();
          if (url.pathname === "/gmail/v1/users/me/messages") {
            // A single read reuses the same bounded decoder without listing other mail.
            if (singleId) return Response.json({ messages: [{ id: singleId }] });
            const response = await transport(target, init);
            if (!response.ok || !response.body) throw fail();
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let size = 0;
            try {
              for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 16384) throw fail();
                chunks.push(chunk.value);
              }
            } finally { await reader.cancel().catch(() => {}); }
            const list = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
            if (!Array.isArray(list.messages ?? []) || (list.messages ?? []).length > 10 || list.nextPageToken) throw fail();
            const ids = (list.messages ?? []).map((entry: { id?: unknown }) => entry.id);
            if (ids.some((id: unknown) => typeof id !== "string" || !/^[a-f0-9]{1,64}$/.test(id)) || new Set(ids).size !== ids.length) throw fail();
            observe?.(ids);
            return Response.json(list);
          }
          if (singleId && url.pathname !== "/gmail/v1/users/me/messages/" + singleId) throw fail();
          return transport(target, init);
        });
      const provider: RegistrationEmailProvider = {
        async list(signal) {
          // Retry only an empty exact-alias query. Malformed, ambiguous or
          // mismatched mail fails immediately; none of it becomes deletion authority.
          // Five attempts at two-second intervals fit the outer 15-second deadline.
          for (let attempt = 0; attempt < 5; attempt++) {
            if (signal.aborted) throw fail();
            let ids: string[] = [];
            const messages = await capture(undefined, (values) => { ids = values; })(signal);
            if (messages.length !== ids.length || messages.length > 1) throw fail();
            if (messages.length === 1) {
              const record = { ...messages[0], id: ids[0] };
              owned.set(record.id, structuredClone(record));
              return [record];
            }
            if (attempt === 4) return [];
            await new Promise<void>((resolve, reject) => {
              const abort = () => {
                clearTimeout(timer);
                signal.removeEventListener("abort", abort);
                reject(fail());
              };
              const timer = setTimeout(() => {
                signal.removeEventListener("abort", abort);
                resolve();
              }, 2000);
              signal.addEventListener("abort", abort, { once: true });
              if (signal.aborted) abort();
            });
          }
          throw fail();
        },
        async read(id, signal) {
          if (!owned.has(id)) throw fail();
          if (removed.has(id)) {
            const response = await transport(base + "/" + id + "?format=minimal", { method: "GET", headers, signal, redirect: "error", cache: "no-store" });
            if (response.status === 404) return null;
            throw fail();
          }
          const messages = await capture(id)(signal);
          if (messages.length !== 1) throw fail();
          return { ...messages[0], id };
        },
        async remove(id, signal) {
          const original = owned.get(id);
          if (!original || removed.has(id)) throw fail();
          const fresh = await provider.read(id, signal);
          if (JSON.stringify(fresh) !== JSON.stringify(original)) throw fail();
          const response = await transport(base + "/" + id, { method: "DELETE", headers, signal, redirect: "error", cache: "no-store" });
          if (response.status !== 204) throw fail();
          removed.add(id);
        },
      };
      return withAcceptanceRegistrationEmail(input, provider, journey);
    }, transport);
  } catch { throw fail(); }
}
