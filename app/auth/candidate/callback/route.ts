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
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { candidateCallbackCookies } from "@/lib/candidateCallbackCookies";
import { supabaseServerCookieOptions } from "@/lib/supabaseServerCookiePolicy";
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

  let auth: Awaited<ReturnType<typeof createServerClient>> | undefined;
  try {
    const cookieStore = await cookies();
    const stagedCookies = candidateCallbackCookies(cookieStore.getAll());
    auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: supabaseServerCookieOptions(),
        cookies: stagedCookies,
      },
    );
    const identity = await verifyCandidateConfirmation(code, {
      exchangeCodeForSession: (value) =>
        auth!.auth.exchangeCodeForSession(value),
      getUser: () => auth!.auth.getUser(),
    });
    if (!identity.verified) {
      await auth.auth.signOut({ scope: "local" });
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
    if (result !== "ready") await auth.auth.signOut({ scope: "local" });
    const response = NextResponse.redirect(
      candidateRegistrationResultUrl(configuration.origin, result),
      { headers: candidateRegistrationPrivateHeaders },
    );
    stagedCookies.commit(result, ({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
    return response;
  } catch {
    if (auth)
      await auth.auth.signOut({ scope: "local" }).catch(() => undefined);
    return NextResponse.redirect(
      candidateRegistrationResultUrl(
        configuration.origin,
        "temporarily_unavailable",
      ),
      { headers: candidateRegistrationPrivateHeaders },
    );
  }
}
