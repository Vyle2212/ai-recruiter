import { acceptanceCandidateRegistrationEmailLink } from "./acceptanceCandidateRegistrationEmail";
import { parseAcceptanceCandidateRegistrationIntent } from "./acceptanceCandidateRegistrationIntent";

type Input = Omit<
  Parameters<typeof acceptanceCandidateRegistrationEmailLink>[0],
  "envelopeRecipients" | "receivedAt" | "confirmationUrls" | "observedAt"
>;
type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string };
  parts?: Part[];
};
const fail = (): never => {
  throw new Error("acceptance_registration_gmail_capture_unavailable");
};

/** Inactive read-only adapter. Tokens are supplied in memory by a separately
 * reviewed runner; this module does not obtain credentials or mutate mail.
 * Query results and Delivered-To are filters, not deletion authorization.
 */
export function createAcceptanceRegistrationGmailCapture(
  input: Input,
  captureEmail: string,
  accessToken: string,
  transport: typeof fetch = fetch,
) {
  try {
    parseAcceptanceCandidateRegistrationIntent(
      JSON.stringify(input.intent),
      input.intent.runHash,
      captureEmail,
    );
    if (!/^[A-Za-z0-9._~-]{16,4096}$/.test(accessToken)) fail();
    if (!Number.isFinite(Date.parse(input.startedAt))) fail();
  } catch {
    fail();
  }
  return async (signal: AbortSignal) => {
    async function request(path: string) {
      const response = await transport(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages${path}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          redirect: "error",
          cache: "no-store",
          signal,
        },
      );
      if (!response.ok || !response.body) return fail();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 256_000) fail();
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    }
    try {
      const query = new URLSearchParams({
        q: `deliveredto:${input.intent.email} after:${Math.floor(Date.parse(input.startedAt) / 1000)}`,
        maxResults: "10",
        includeSpamTrash: "true",
      });
      const listed = await request(`?${query}`);
      const messages = listed.messages ?? [];
      if (
        !Array.isArray(messages) ||
        messages.length > 10 ||
        listed.nextPageToken ||
        new Set(messages.map((m: { id?: unknown }) => m?.id)).size !==
          messages.length
      )
        fail();
      const result = [];
      for (const entry of messages) {
        if (!/^[a-f0-9]{1,64}$/.test(entry?.id || "")) fail();
        const message = await request(`/${entry.id}?format=full`);
        if (
          message.id !== entry.id ||
          !/^\d{1,16}$/.test(message.internalDate || "")
        )
          fail();
        const receivedAt = new Date(Number(message.internalDate)).toISOString();
        const payload: Part = message.payload;
        if (!payload || !Array.isArray(payload.headers)) return fail();
        const recipients = payload.headers
          .filter((h) => h.name?.toLowerCase() === "delivered-to")
          .map((h) => h.value.trim().toLowerCase());
        if (recipients.length !== 1 || recipients[0] !== input.intent.email)
          fail();
        let count = 0;
        const urls = new Set<string>();
        function visit(part: Part, depth: number) {
          if (++count > 20 || depth > 5 || !part || typeof part !== "object")
            fail();
          if (part.filename || part.body?.attachmentId) return;
          if (
            ["text/plain", "text/html"].includes(part.mimeType || "") &&
            part.body?.data
          ) {
            if (
              part.body.data.length > 128_000 ||
              !/^[A-Za-z0-9_-]+={0,2}$/.test(part.body.data)
            )
              fail();
            const bytes = Buffer.from(part.body.data, "base64url");
            if (
              bytes.toString("base64url") !== part.body.data.replace(/=+$/, "")
            )
              fail();
            const text = new TextDecoder("utf-8", { fatal: true }).decode(
              bytes,
            );
            for (const match of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
              const raw = match[0].replace(/&amp;/g, "&");
              const url = new URL(raw);
              if (url.pathname === "/auth/v1/verify") urls.add(url.href);
            }
          }
          if (part.parts !== undefined && !Array.isArray(part.parts)) fail();
          for (const child of part.parts || []) visit(child, depth + 1);
        }
        visit(payload, 0);
        const captured = {
          envelopeRecipients: recipients,
          receivedAt,
          confirmationUrls: [...urls],
        };
        acceptanceCandidateRegistrationEmailLink({
          ...input,
          ...captured,
          observedAt: new Date().toISOString(),
        });
        result.push(captured);
      }
      return result;
    } catch {
      return fail();
    }
  };
}
