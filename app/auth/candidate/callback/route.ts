import {
  candidateConfirmationCode,
  provisionCandidateRegistration,
  verifyCandidateConfirmation,
} from "@/lib/candidateRegistrationCallback";
import {
  candidateRegistrationCallbackConfiguration,
  candidateRegistrationPrivateHeaders,
  candidateRegistrationResultUrl,
} from "@/lib/candidateRegistrationRuntime";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

function unavailable(status: number, code: string) {
  return Response.json(
    { error: code },
    { status, headers: candidateRegistrationPrivateHeaders },
  );
}

export async function GET(request: Request) {
  const configuration = candidateRegistrationCallbackConfiguration(request);
  if (!configuration.enabled)
    return unavailable(configuration.status, configuration.code);

  const code = candidateConfirmationCode(new URL(request.url));
  if (!code)
    return NextResponse.redirect(
      candidateRegistrationResultUrl(configuration.origin, "invalid"),
      { headers: candidateRegistrationPrivateHeaders },
    );

  let auth: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    auth = await createClient();
    const identity = await verifyCandidateConfirmation(code, {
      exchangeCodeForSession: (value) =>
        auth!.auth.exchangeCodeForSession(value),
      getUser: () => auth!.auth.getUser(),
    });
    if (!identity.verified) {
      await auth.auth.signOut();
      return NextResponse.redirect(
        candidateRegistrationResultUrl(configuration.origin, "invalid"),
        { headers: candidateRegistrationPrivateHeaders },
      );
    }

    const service = createLazySupabaseServiceClient();
    const result = await provisionCandidateRegistration(
      identity,
      async (args) =>
        await service.rpc("provision_verified_candidate_registration", args),
    );
    if (result !== "ready") await auth.auth.signOut();
    return NextResponse.redirect(
      candidateRegistrationResultUrl(configuration.origin, result),
      { headers: candidateRegistrationPrivateHeaders },
    );
  } catch {
    if (auth) await auth.auth.signOut().catch(() => undefined);
    return NextResponse.redirect(
      candidateRegistrationResultUrl(
        configuration.origin,
        "temporarily_unavailable",
      ),
      { headers: candidateRegistrationPrivateHeaders },
    );
  }
}
