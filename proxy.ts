import { acceptanceAuthConfigured } from "./lib/acceptanceAuthConfiguration";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isStagingPortalGuardEnabled,
  shouldProtectPortal,
  updateRecruiterApiSession,
  updateStagingSession,
} from "./utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (
    process.env.APP_ENV === "acceptance" &&
    !acceptanceAuthConfigured() &&
    (shouldProtectPortal(request.nextUrl.pathname) ||
      request.nextUrl.pathname.startsWith("/api/recruiter/"))
  ) {
    return new NextResponse("Acceptance authentication is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (request.nextUrl.pathname.startsWith("/api/recruiter/")) {
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
    "/api/recruiter/:path*",
  ],
};
