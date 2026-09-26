import { acceptanceAuthConfigured } from "./lib/acceptanceAuthConfiguration";
import { productionAuthConfigured } from "./lib/productionAuthConfiguration";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isStagingPortalGuardEnabled,
  shouldProtectPortal,
  updateClientShareApiSession,
  updateRecruiterApiSession,
  updateStagingSession,
} from "./utils/supabase/proxy";
import { recruiterApiPolicyForRequest } from "./lib/recruiterApiPolicyRegistry";

export async function proxy(request: NextRequest) {
  const apiPolicy = recruiterApiPolicyForRequest(
    request.nextUrl.pathname,
    request.method,
  );
  const recruiterApiNamespace =
    request.nextUrl.pathname.startsWith("/api/recruiter/");
  const clientShareApi =
    request.nextUrl.pathname === "/api/client/recruiter-shares";
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.PRODUCTION_AUTH_ENABLED === "true" &&
    !productionAuthConfigured() &&
    request.nextUrl.pathname !== "/" &&
    request.nextUrl.pathname !== "/auth/login"
  ) {
    return new NextResponse("Production authentication is not configured.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (
    process.env.APP_ENV === "acceptance" &&
    !acceptanceAuthConfigured() &&
    (shouldProtectPortal(request.nextUrl.pathname) ||
      recruiterApiNamespace ||
      clientShareApi ||
      Boolean(apiPolicy))
  ) {
    return new NextResponse("Acceptance authentication is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (recruiterApiNamespace || apiPolicy) {
    return updateRecruiterApiSession(request);
  }

  if (clientShareApi) {
    return updateClientShareApiSession(request);
  }

  if (
    productionAuthConfigured() &&
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    return new NextResponse(
      "This API is not available during the production Auth cutover.",
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  if (!shouldProtectPortal(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (productionAuthConfigured()) {
    return updateStagingSession(request);
  }

  if (process.env.APP_ENV === "acceptance") {
    return updateStagingSession(request);
  }

  // Preserve the existing staging approval gate for other environments.
  if (!isStagingPortalGuardEnabled()) {
    return NextResponse.next();
  }

  return updateStagingSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
