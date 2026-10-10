import "server-only";
import { recruiterSearchProfilePrefetch } from "./recruiterSearchProfilePrefetch";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  RECRUITER_SEARCH_API_SECURITY_VERSION,
  authorizeRecruiterSearchAccess,
  recruiterSearchAuthorizationDeniedBody,
  type RecruiterSearchAuthorization,
  type RecruiterSearchAuthAdapter,
  type RecruiterSearchPermission,
  type RecruiterSearchSecurityLogger,
} from "@/lib/recruiterSearchAuthorizationCore";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
  "X-Search-Security-Version": RECRUITER_SEARCH_API_SECURITY_VERSION,
};

const securityLog: RecruiterSearchSecurityLogger = (event, details) => {
  console.warn(
    JSON.stringify({
      type: "recruiter_search_security",
      event,
      route: details.route,
      permission: details.permission,
      reason: details.reason,
      ...(details.actorHash ? { actorHash: details.actorHash } : {}),
    }),
  );
};

let testResolver:
  | ((input: {
      permission: RecruiterSearchPermission;
      route: string;
    }) => Promise<RecruiterSearchAuthorization>)
  | null = null;

export function setRecruiterSearchAuthorizationResolverForTests(
  resolver:
    | ((input: {
        permission: RecruiterSearchPermission;
        route: string;
      }) => Promise<RecruiterSearchAuthorization>)
    | null,
) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Test authorization adapters are disabled in production.");
  testResolver = resolver;
}

async function productionAdapter(permission: RecruiterSearchPermission): Promise<RecruiterSearchAuthAdapter> {
  const client = await createClient();
  const adapter: RecruiterSearchAuthAdapter = {
    async getUser() {
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      return { user: user ? { id: user.id } : null, error };
    },
    async getProfile(authUserId) {
      const { data, error } = await client
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
  };
  return recruiterSearchProfilePrefetch(adapter, async () => {
    // The cookie-backed session is only a speculative I/O hint. The helper
    // reuses its RLS-bound profile read only when fresh getUser returns the
    // exact same subject, so session data never authorizes the request.
    const { data, error } = await client.auth.getSession();
    const subject = data.session?.user?.id;
    return !error && typeof subject === "string" &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(subject)
      ? subject : null;
  });
}

export async function requireRecruiterSearchAuthorization(input: {
  permission: RecruiterSearchPermission;
  route: string;
}) {
  try {
    if (testResolver) return testResolver(input);
    return await authorizeRecruiterSearchAccess({
      adapter: await productionAdapter(input.permission),
      permission: input.permission,
      route: input.route,
      log: securityLog,
    });
  } catch {
    securityLog("invalid_authorization_scope", {
      route: input.route,
      permission: input.permission,
      reason: "authorization_service_failed",
    });
    return {
      allowed: false,
      status: 403,
      code: "invalid_authorization_scope",
    } as const;
  }
}

export function recruiterSearchAuthorizationDenied(
  authorization: Extract<RecruiterSearchAuthorization, { allowed: false }>,
) {
  return NextResponse.json(
    recruiterSearchAuthorizationDeniedBody(authorization),
    { status: authorization.status, headers: privateNoStoreHeaders },
  );
}

export function logRecruiterSearchSecurityEvent(
  ...parameters: Parameters<RecruiterSearchSecurityLogger>
) {
  securityLog(...parameters);
}

export { privateNoStoreHeaders as recruiterSearchPrivateNoStoreHeaders };
