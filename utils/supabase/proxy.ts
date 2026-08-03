import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PortalRole =
  | "admin"
  | "recruiter_manager"
  | "recruiter"
  | "client"
  | "candidate";

const portalRules: Array<{
  pathname: string;
  allowedRoles: PortalRole[];
}> = [
  {
    pathname: "/admin/portal",
    allowedRoles: ["admin"],
  },
  {
    pathname: "/recruiter/dashboard",
    allowedRoles: ["admin", "recruiter_manager", "recruiter"],
  },
  {
    pathname: "/client/portal",
    allowedRoles: ["client"],
  },
  {
    pathname: "/candidate/portal",
    allowedRoles: ["candidate"],
  },
];

function stagingGateApproved() {
  return (
    process.env.APP_ENV === "staging" &&
    process.env.AUTH_MODE === "staging_approved" &&
    process.env.STAGING_AUTH_ENABLED === "true" &&
    process.env.STAGING_AUTH_APPROVED === "true" &&
    process.env.PRODUCTION_AUTH_ENABLED !== "true"
  );
}

function loginRedirect(request: NextRequest, reason: string) {
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

export async function updateStagingSession(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

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

  const rule = portalRules.find(
    (item) =>
      request.nextUrl.pathname === item.pathname ||
      request.nextUrl.pathname.startsWith(
        item.pathname + "/",
      ),
  );

  if (
    rule &&
    !rule.allowedRoles.includes(
      profile.role as PortalRole,
    )
  ) {
    const url = request.nextUrl.clone();

    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("reason", "role_not_allowed");

    return NextResponse.redirect(url);
  }

  return response;
}

export function shouldProtectPortal(
  pathname: string,
) {
  return portalRules.some(
    (item) =>
      pathname === item.pathname ||
      pathname.startsWith(item.pathname + "/"),
  );
}

export function isStagingPortalGuardEnabled() {
  return stagingGateApproved();
}