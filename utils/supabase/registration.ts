import { createServerClient } from "@supabase/ssr";
import { supabaseServerCookieOptions } from "../../lib/supabaseServerCookiePolicy";
import { candidateRegistrationCookies } from "../../lib/candidateRegistrationCookies";

// Public-key client only. Cookie writes are isolated from the response until
// the registration route explicitly commits a confirmation-pending verifier.
export function createCandidateRegistrationClient(
  url: string,
  publishableKey: string,
  stagedCookies: ReturnType<typeof candidateRegistrationCookies>,
) {
  return createServerClient(url, publishableKey, {
    cookieOptions: supabaseServerCookieOptions(),
    cookies: stagedCookies,
  });
}
