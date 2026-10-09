import { withAcceptanceGmailCredentials } from "./acceptanceGmailCredentials.mjs";
import { createAcceptanceRegistrationGmailCapture } from "./acceptanceCandidateRegistrationGmail";
import { parseAcceptanceCandidateRegistrationIntent } from "./acceptanceCandidateRegistrationIntent";

type Input = Parameters<typeof createAcceptanceRegistrationGmailCapture>[0];
/** OFF preparation only. This reads one run alias; it cannot send or delete email,
 * confirm signup, or establish cleanup success. No HTTP route exposes this helper. */
export async function captureAcceptanceRegistrationGmailFromSecrets(
  input: Input,
  env: Record<string, string | undefined>,
  signal: AbortSignal,
  transport: typeof fetch = fetch,
) {
  const fail = () => new Error("acceptance_registration_gmail_capture_unavailable");
  try {
    if (signal.aborted || env.ACCEPTANCE_GMAIL_CAPTURE_ENABLED !== "true" ||
        env.APP_ENV !== "acceptance" || env.ACCEPTANCE_TEST_MODE !== "true" ||
        input.projectRef !== "iujucosewivndjpcjbuz" ||
        env.ACCEPTANCE_SUPABASE_PROJECT_REF !== input.projectRef ||
        env.CANDIDATE_REGISTRATION_CALLBACK_ORIGIN !== input.acceptanceOrigin)
      throw fail();
    const captureEmail = env.ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL || "";
    parseAcceptanceCandidateRegistrationIntent(JSON.stringify(input.intent), input.intent.runHash, captureEmail);
    return await withAcceptanceGmailCredentials(env, async (token: string) => {
      if (signal.aborted) throw fail();
      return createAcceptanceRegistrationGmailCapture(input, captureEmail, token, transport)(signal);
    }, transport);
  } catch {
    throw fail();
  }
}
