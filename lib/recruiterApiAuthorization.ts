import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  authorizeRecruiterApiAccess,
  recruiterApiDeniedBody,
  validateRecruiterApiWriteRequest,
  type RecruiterApiAuthorization,
} from "@/lib/recruiterApiAuthorizationCore";
import {
  RECRUITER_API_SECURITY_VERSION,
  recruiterApiPolicyById,
  recruiterApiPolicyForRequest,
  type RecruiterApiRoutePolicy,
} from "@/lib/recruiterApiPolicyRegistry.server";
import { createClient } from "@/utils/supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, Origin",
  "X-Recruiter-API-Security-Version": RECRUITER_API_SECURITY_VERSION,
};
type AuthorizationResolver = (input: {
  request: Request;
  policy: RecruiterApiRoutePolicy;
}) => Promise<RecruiterApiAuthorization>;
let testResolver: AuthorizationResolver | null = null;
let testAuditSink: ((event: Record<string, string>) => void) | null = null;

export function setRecruiterApiAuthorizationResolverForTests(
  resolver: AuthorizationResolver | null,
) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Test authorization adapters are disabled in production.");
  testResolver = resolver;
}

export function setRecruiterApiAuditSinkForTests(
  sink: ((event: Record<string, string>) => void) | null,
) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Test audit sinks are disabled in production.");
  testAuditSink = sink;
}

function correlationId(request: Request) {
  const supplied = request.headers.get("x-request-id") || "";
  return /^[A-Za-z0-9._:-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

function audit(
  request: Request,
  policy: RecruiterApiRoutePolicy,
  fields: Record<string, string>,
) {
  const event = {
    type: "recruiter_api_security",
    timestamp: new Date().toISOString(),
    correlationId: correlationId(request),
    routePolicyId: policy.id,
    method: request.method.toUpperCase(),
    category: policy.auditCategory,
    ...fields,
  };
  if (testAuditSink) testAuditSink(event);
  else console.warn(JSON.stringify(event));
}

function matchesPattern(pattern: string, pathname: string) {
  const segments = pattern.split("/");
  const actual = pathname.split("/");
  return (
    segments.length === actual.length &&
    segments.every(
      (segment, index) =>
        (/^\[[^/]+\]$/.test(segment) && Boolean(actual[index])) ||
        segment === actual[index],
    )
  );
}

async function productionAuthorization(
  request: Request,
  policy: RecruiterApiRoutePolicy,
) {
  const client = await createClient();
  return authorizeRecruiterApiAccess({
    permission: policy.requiredPermission,
    routePolicyId: policy.id,
    adapter: {
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
    },
    log(fields) {
      audit(request, policy, { decision: "denied", ...fields });
    },
  });
}

export type RecruiterApiRouteAuthorization =
  | {
      allowed: true;
      scope: Extract<RecruiterApiAuthorization, { allowed: true }>["scope"];
      policy: RecruiterApiRoutePolicy;
    }
  | { allowed: false; response: NextResponse };

export async function requireRecruiterApiRouteAuthorization(input: {
  request: Request;
  policyId?: string;
}): Promise<RecruiterApiRouteAuthorization> {
  const pathname = new URL(input.request.url).pathname;
  const policy = input.policyId
    ? recruiterApiPolicyById(input.policyId, input.request.method)
    : recruiterApiPolicyForRequest(pathname, input.request.method);
  if (!policy || !matchesPattern(policy.routePattern, pathname)) {
    console.warn(
      JSON.stringify({
        type: "recruiter_api_security",
        event: "policy_registry_failure",
        method: input.request.method,
        decision: "denied",
      }),
    );
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "route_policy_required",
            message: "Access is not permitted.",
          },
        },
        { status: 403, headers: privateHeaders },
      ),
    };
  }
  const writeRejection = validateRecruiterApiWriteRequest({
    method: input.request.method,
    url: input.request.url,
    headers: input.request.headers,
    policyId: policy.id,
    maxRequestBytes: policy.maxRequestBytes,
  });
  if (writeRejection) {
    audit(input.request, policy, {
      event:
        writeRejection.code === "same_origin_required"
          ? "csrf_origin_rejection"
          : "write_request_rejection",
      decision: "denied",
      reason: writeRejection.code,
    });
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: writeRejection.code,
            message:
              writeRejection.code === "same_origin_required"
                ? "Access is not permitted."
                : "The request cannot be processed.",
          },
        },
        {
          status: writeRejection.status,
          headers: privateHeaders,
        },
      ),
    };
  }
  let authorization: RecruiterApiAuthorization;
  try {
    authorization = testResolver
      ? await testResolver({ request: input.request, policy })
      : await productionAuthorization(input.request, policy);
  } catch {
    audit(input.request, policy, {
      event: "authorization_failure",
      decision: "denied",
    });
    authorization = {
      allowed: false,
      status: 403,
      code: "invalid_authorization_scope",
    };
  }
  if (!authorization.allowed) {
    if (policy.persistentMutation)
      audit(input.request, policy, {
        event: "mutation_rejected",
        decision: "denied",
        reason: authorization.code,
      });
    return {
      allowed: false,
      response: NextResponse.json(recruiterApiDeniedBody(authorization), {
        status: authorization.status,
        headers: privateHeaders,
      }),
    };
  }
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(
      input.request.method.toUpperCase(),
    ) &&
    (await input.request.clone().arrayBuffer()).byteLength >
      policy.maxRequestBytes
  ) {
    audit(input.request, policy, {
      event: "write_request_rejection",
      decision: "denied",
      reason: "request_too_large",
    });
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "request_too_large",
            message: "The request cannot be processed.",
          },
        },
        { status: 413, headers: privateHeaders },
      ),
    };
  }
  audit(input.request, policy, {
    event: policy.persistentMutation
      ? "mutation_allowed"
      : policy.serviceRoleAccess
        ? "service_role_operation_allowed"
        : "request_allowed",
    decision: "allowed",
    actorHash: authorization.scope.cacheKey.slice(0, 12),
    role: authorization.scope.role,
    ...(authorization.scope.organizationId
      ? { organizationScopeHash: authorization.scope.cacheKey.slice(12, 24) }
      : {}),
  });
  return { allowed: true, scope: authorization.scope, policy };
}

export { privateHeaders as recruiterApiPrivateNoStoreHeaders };
