import { createCandidateRegistrationClient } from "@/utils/supabase/registration";
import { cookies } from "next/headers";
import { candidateRegistrationCookies } from "@/lib/candidateRegistrationCookies";
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
  const stagedCookies = candidateRegistrationCookies();
  const outcome = await candidateRegistrationOutcome(async () => {
    // SSR stores the PKCE verifier in cookies for the confirmation callback.
    // Client construction is inside the error boundary; no provider detail leaks.
    const auth = createCandidateRegistrationClient(
      configuration.supabaseUrl,
      configuration.publishableKey,
      stagedCookies,
    );
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
  const cookieStore = await cookies();
  stagedCookies.commit(outcome, ({ name, value, options }) =>
    cookieStore.set(name, value, options),
  );
  return Response.json(outcome.body, {
    status: outcome.status,
    headers: candidateRegistrationPrivateHeaders,
  });
}
