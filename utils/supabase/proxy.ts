import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PortalRole =
  | "admin"
  | "recruiter_manager"
  | "recruiter"
  | "client"
  | "candidate";

type ProtectedArea = {
  prefix: string;
  allowedRoles: PortalRole[];
};

const protectedAreas: ProtectedArea[] = [
  {
    prefix: "/admin",
    allowedRoles: ["admin"],
  },
  {
    prefix: "/recruiter",
    allowedRoles: [
      "admin",
      "recruiter_manager",
      "recruiter",
    ],
  },
  {
    prefix: "/client",
    allowedRoles: ["client"],
  },
  {
    prefix: "/candidate",
    allowedRoles: ["candidate"],
  },
];

const publicRoutePrefixes = [
  "/client/portal/preview",
  "/candidate/self-confirm",
];

function pathnameMatchesPrefix(
  pathname: string,
  prefix: string,
) {
  return (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`)
  );
}

function stagingGateApproved() {
  return (
    process.env.APP_ENV === "staging" &&
    process.env.AUTH_MODE === "staging_approved" &&
    process.env.STAGING_AUTH_ENABLED === "true" &&
    process.env.STAGING_AUTH_APPROVED === "true" &&
    process.env.PRODUCTION_AUTH_ENABLED !== "true"
  );
}

function loginRedirect(
  request: NextRequest,
  reason: string,
) {
  const url = request.nextUrl.clone();

  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("reason", reason);
  url.searchParams.set(
    "next",
    request.nextUrl.pathname,
  );

  return NextResponse.redirect(url);
}

function roleDeniedRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();

  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("reason", "role_not_allowed");
  url.searchParams.set(
    "next",
    request.nextUrl.pathname,
  );

  return NextResponse.redirect(url);
}

export function isPublicPortalRoute(
  pathname: string,
) {
  return publicRoutePrefixes.some((prefix) =>
    pathnameMatchesPrefix(pathname, prefix),
  );
}

export function getProtectedPortalArea(
  pathname: string,
) {
  if (isPublicPortalRoute(pathname)) {
    return undefined;
  }

  return protectedAreas.find((area) =>
    pathnameMatchesPrefix(pathname, area.prefix),
  );
}

export function shouldProtectPortal(
  pathname: string,
) {
  return Boolean(getProtectedPortalArea(pathname));
}

export function isStagingPortalGuardEnabled() {
  return stagingGateApproved();
}

export async function updateStagingSession(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const area = getProtectedPortalArea(
    request.nextUrl.pathname,
  );

  if (!area) {
    return response;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return loginRedirect(
      request,
      "staging_auth_configuration_missing",
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return loginRedirect(
      request,
      "authentication_required",
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("user_profiles")
      .select("role,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.status !== "active"
  ) {
    return loginRedirect(
      request,
      "active_profile_required",
    );
  }

  if (
    !area.allowedRoles.includes(
      profile.role as PortalRole,
    )
  ) {
    return roleDeniedRedirect(request);
  }

  return response;
}