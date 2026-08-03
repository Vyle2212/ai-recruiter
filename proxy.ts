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
   * This guard is intentionally staging-only.
   * Production authentication remains disabled.
   */
  if (!isStagingPortalGuardEnabled()) {
    return NextResponse.next();
  }

  return updateStagingSession(request);
}

export const config = {
  matcher: [
    "/admin/portal/:path*",
    "/recruiter/dashboard/:path*",
    "/client/portal/:path*",
    "/candidate/portal/:path*",
  ],
};