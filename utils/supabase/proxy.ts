import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeRecruiterApiAccess,
  recruiterApiDeniedBody,
  validateRecruiterApiWriteRequest,
} from "@/lib/recruiterApiAuthorizationCore";
import {
  RECRUITER_API_SECURITY_VERSION,
  recruiterApiPolicyForRequest,
} from "@/lib/recruiterApiPolicyRegistry";

type PortalRole =
  "admin" | "recruiter_manager" | "recruiter" | "client" | "candidate";

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
    allowedRoles: ["admin", "recruiter_manager", "recruiter"],
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

function pathnameMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
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

function loginRedirect(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();

  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("reason", reason);
  url.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(url);
}

function roleDeniedRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();

  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("reason", "role_not_allowed");
  url.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(url);
}

export function isPublicPortalRoute(pathname: string) {
  return publicRoutePrefixes.some((prefix) =>
    pathnameMatchesPrefix(pathname, prefix),
  );
}

export function getProtectedPortalArea(pathname: string) {
  if (isPublicPortalRoute(pathname)) {
    return undefined;
  }

  return protectedAreas.find((area) =>
    pathnameMatchesPrefix(pathname, area.prefix),
  );
}

export function shouldProtectPortal(pathname: string) {
  return Boolean(getProtectedPortalArea(pathname));
}

export function isStagingPortalGuardEnabled() {
  return stagingGateApproved();
}

const recruiterApiHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, Origin",
  "X-Recruiter-API-Security-Version": RECRUITER_API_SECURITY_VERSION,
};

function recruiterApiJson(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: recruiterApiHeaders },
  );
}

export async function updateRecruiterApiSession(request: NextRequest) {
  const policy = recruiterApiPolicyForRequest(
    request.nextUrl.pathname,
    request.method,
  );
  if (!policy) {
    console.warn(
      JSON.stringify({
        type: "recruiter_api_security",
        event: "policy_registry_failure",
        method: request.method,
        decision: "denied",
      }),
    );
    return recruiterApiJson(
      403,
      "route_policy_required",
      "Access is not permitted.",
    );
  }

  const writeRejection = validateRecruiterApiWriteRequest({
    method: request.method,
    url: request.url,
    headers: request.headers,
    policyId: policy.id,
    maxRequestBytes: policy.maxRequestBytes,
  });
  if (writeRejection) {
    if (writeRejection.code === "same_origin_required") {
      console.warn(
        JSON.stringify({
          type: "recruiter_api_security",
          event: "csrf_origin_rejection",
          routePolicyId: policy.id,
          method: request.method,
          decision: "denied",
        }),
      );
    }
    return recruiterApiJson(
      writeRejection.status,
      writeRejection.code,
      writeRejection.code === "same_origin_required"
        ? "Access is not permitted."
        : "The request cannot be processed.",
    );
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey)
    return recruiterApiJson(
      401,
      "authentication_required",
      "Authentication is required.",
    );
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const authorization = await authorizeRecruiterApiAccess({
    permission: policy.requiredPermission,
    routePolicyId: policy.id,
    adapter: {
      async getUser() {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        return { user: user ? { id: user.id } : null, error };
      },
      async getProfile(authUserId) {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id,auth_user_id,role,status,organization_id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        return {
          profile: data
            ? {
                id: String(data.id || ""),
                auth_user_id: String(data.auth_user_id || ""),
                role: String(data.role || ""),
                status: String(data.status || ""),
                organization_id:
                  typeof data.organization_id === "string"
                    ? data.organization_id
                    : null,
              }
            : null,
          error,
        };
      },
    },
    log(fields) {
      console.warn(
        JSON.stringify({
          type: "recruiter_api_security",
          routePolicyId: policy.id,
          method: request.method,
          decision: "denied",
          ...fields,
        }),
      );
    },
  });
  if (!authorization.allowed) {
    if (policy.persistentMutation)
      console.warn(
        JSON.stringify({
          type: "recruiter_api_security",
          event: "mutation_rejected",
          routePolicyId: policy.id,
          method: request.method,
          decision: "denied",
          reason: authorization.code,
        }),
      );
    return NextResponse.json(recruiterApiDeniedBody(authorization), {
      status: authorization.status,
      headers: recruiterApiHeaders,
    });
  }
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
    (await request.clone().arrayBuffer()).byteLength > policy.maxRequestBytes
  )
    return recruiterApiJson(
      413,
      "request_too_large",
      "The request cannot be processed.",
    );

  if (policy.persistentMutation || policy.serviceRoleAccess)
    console.warn(
      JSON.stringify({
        type: "recruiter_api_security",
        event: policy.persistentMutation
          ? "mutation_allowed"
          : "service_role_operation_allowed",
        routePolicyId: policy.id,
        method: request.method,
        decision: "allowed",
        actorHash: authorization.scope.cacheKey.slice(0, 12),
        role: authorization.scope.role,
        ...(authorization.scope.organizationId
          ? {
              organizationScopeHash: authorization.scope.cacheKey.slice(12, 24),
            }
          : {}),
      }),
    );

  for (const [key, value] of Object.entries(recruiterApiHeaders))
    response.headers.set(key, value);
  return response;
}

export async function updateStagingSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const area = getProtectedPortalArea(request.nextUrl.pathname);

  if (!area) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return loginRedirect(request, "staging_auth_configuration_missing");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return loginRedirect(request, "authentication_required");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role,status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    return loginRedirect(request, "active_profile_required");
  }

  if (!area.allowedRoles.includes(profile.role as PortalRole)) {
    return roleDeniedRedirect(request);
  }

  return response;
}
