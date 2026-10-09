import { pathToFileURL } from "node:url";
import { withAcceptanceGmailCredentials } from "../lib/acceptanceGmailCredentials.mjs";
export async function verifyAcceptanceGmailCredentials(env, transport = fetch) {
  return withAcceptanceGmailCredentials(env, async () => ({
    status: "PASS_CREDENTIALS_ONLY", mailboxMatched: true,
    signupVerified: false, cleanupVerified: false,
  }), transport);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyAcceptanceGmailCredentials(process.env).then(
    (result) => console.log(JSON.stringify(result)),
    () => { console.error("acceptance_gmail_credentials_unavailable"); process.exitCode = 1; },
  );
}
