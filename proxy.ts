import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isStagingPortalGuardEnabled,
  shouldProtectPortal,
  updateStagingSession,
} from "./utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (!shouldProtectPortal(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  /*
   * The real route guard is staging-only.
   * Production authentication remains blocked.
   */
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
  ],
};