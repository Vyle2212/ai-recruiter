import { pathToFileURL } from "node:url";

const unavailable = () => new Error("acceptance_gmail_credentials_unavailable");
export async function verifyAcceptanceGmailCredentials(env, transport = fetch) {
  try {
    if (env.APP_ENV !== "acceptance" || env.ACCEPTANCE_TEST_MODE !== "true") throw unavailable();
    const clientId = env.ACCEPTANCE_GMAIL_CLIENT_ID;
    const clientSecret = env.ACCEPTANCE_GMAIL_CLIENT_SECRET;
    const refreshToken = env.ACCEPTANCE_GMAIL_REFRESH_TOKEN;
    const expectedEmail = env.ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL;
    if (typeof clientId !== "string" || !/^[A-Za-z0-9_-]{10,200}\.apps\.googleusercontent\.com$/.test(clientId)) throw unavailable();
    for (const value of [clientSecret, refreshToken])
      if (typeof value !== "string" || value.length < 16 || value.length > 4096 || /\s/.test(value)) throw unavailable();
    if (typeof expectedEmail !== "string" || !/^[a-z0-9._+-]+@gmail\.com$/.test(expectedEmail)) throw unavailable();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      async function request(url, init) {
        const response = await transport(url, { ...init, redirect: "error", cache: "no-store", signal: controller.signal });
        if (!response.ok || !response.body) throw unavailable();
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 16384) throw unavailable();
            chunks.push(chunk.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      }
      const token = await request("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      });
      if (token.token_type?.toLowerCase() !== "bearer" ||
          typeof token.access_token !== "string" || !/^[A-Za-z0-9._~-]{16,4096}$/.test(token.access_token) ||
          !Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
          typeof token.scope !== "string" || token.scope.trim() !== "https://www.googleapis.com/auth/gmail.readonly")
        throw unavailable();
      const profile = await request("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        method: "GET", headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (typeof profile.emailAddress !== "string" || profile.emailAddress.toLowerCase() !== expectedEmail) throw unavailable();
      return { status: "PASS_CREDENTIALS_ONLY", mailboxMatched: true, signupVerified: false, cleanupVerified: false };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  } catch {
    throw unavailable();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyAcceptanceGmailCredentials(process.env).then(
    (result) => console.log(JSON.stringify(result)),
    () => { console.error("acceptance_gmail_credentials_unavailable"); process.exitCode = 1; },
  );
}
