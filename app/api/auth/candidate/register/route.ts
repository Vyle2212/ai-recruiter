import { createClient } from "@/utils/supabase/server";
import { candidateRegistrationOutcome } from "@/lib/candidateRegistrationOutcome";
import {
  candidateRegistrationConfiguration,
  candidateRegistrationPrivateHeaders,
  readCandidateRegistrationInput,
} from "@/lib/candidateRegistrationRuntime";

export async function POST(request: Request) {
  const configuration = candidateRegistrationConfiguration(request);
  if (!configuration.enabled)
    return Response.json(
      { error: configuration.code },
      {
        status: configuration.status,
        headers: candidateRegistrationPrivateHeaders,
      },
    );
  const input = await readCandidateRegistrationInput(request);
  if (!input)
    return Response.json(
      { error: "candidate_registration_invalid" },
      { status: 400, headers: candidateRegistrationPrivateHeaders },
    );
  const outcome = await candidateRegistrationOutcome(async () => {
    // SSR stores the PKCE verifier in cookies for the confirmation callback.
    // Client construction is inside the error boundary; no provider detail leaks.
    const auth = await createClient();
    return auth.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        captchaToken: input.captchaToken,
        emailRedirectTo: configuration.callback,
        data: { registration_full_name: input.fullName },
      },
    });
  });
  return Response.json(outcome.body, {
    status: outcome.status,
    headers: candidateRegistrationPrivateHeaders,
  });
}
