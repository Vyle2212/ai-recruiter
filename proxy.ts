import { acceptanceAuthConfigured } from "./lib/acceptanceAuthConfiguration";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isStagingPortalGuardEnabled,
  shouldProtectPortal,
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
  if (
    process.env.APP_ENV === "acceptance" &&
    !acceptanceAuthConfigured() &&
    (shouldProtectPortal(request.nextUrl.pathname) ||
      recruiterApiNamespace ||
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

  if (!shouldProtectPortal(request.nextUrl.pathname)) {
    return NextResponse.next();
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
  matcher: [
    "/admin/:path*",
    "/recruiter/:path*",
    "/client/:path*",
    "/candidate/:path*",
    "/api/:path*",
  ],
};
