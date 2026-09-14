import { createHash } from "node:crypto";

import {
  RECRUITER_API_PERMISSIONS,
  RECRUITER_API_SECURITY_VERSION,
  type RecruiterApiPermission,
} from "@/lib/recruiterApiPolicyRegistry";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const safeContentTypes = [
  "application/json",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
];

export type RecruiterApiWriteRequestRejection = {
  code:
    | "same_origin_required"
    | "request_too_large"
    | "unsupported_content_type"
    | "action_policy_mismatch";
  status: 403 | 413 | 415;
};

export function validateRecruiterApiWriteRequest(input: {
  method: string;
  url: string;
  headers: Headers;
  policyId: string;
  maxRequestBytes: number;
}): RecruiterApiWriteRequestRejection | null {
  if (!writeMethods.has(input.method.toUpperCase())) return null;
  if (input.headers.get("cookie")) {
    const origin = input.headers.get("origin");
    const sameOrigin = origin
      ? origin === new URL(input.url).origin
      : input.headers.get("sec-fetch-site") === "same-origin";
    if (!sameOrigin) return { code: "same_origin_required", status: 403 };
  }
  const length = Number(input.headers.get("content-length") || "0");
  if (!Number.isFinite(length) || length < 0 || length > input.maxRequestBytes)
    return { code: "request_too_large", status: 413 };
  if (length > 0) {
    const contentType = (input.headers.get("content-type") || "").toLowerCase();
    if (!safeContentTypes.some((type) => contentType.startsWith(type)))
      return { code: "unsupported_content_type", status: 415 };
  }
  const declaredAction = input.headers.get("x-recruiter-action");
  if (declaredAction && declaredAction !== input.policyId)
    return { code: "action_policy_mismatch", status: 415 };
  return null;
}

export const RECRUITER_API_ROLES = [
  "admin",
  "recruiter_manager",
  "recruiter",
] as const;
export type RecruiterApiRole = (typeof RECRUITER_API_ROLES)[number];

export type RecruiterApiAuthorizationScope = {
  version: typeof RECRUITER_API_SECURITY_VERSION;
  subjectId: string;
  profileId: string;
  role: RecruiterApiRole;
  organizationId: string | null;
  cacheKey: string;
};
export type RecruiterApiAuthorization =
  | { allowed: true; scope: RecruiterApiAuthorizationScope }
  | {
      allowed: false;
      status: 401 | 403;
      code:
        | "authentication_required"
        | "active_profile_required"
        | "recruiter_role_required"
        | "permission_required"
        | "invalid_authorization_scope";
    };
export type RecruiterApiAuthAdapter = {
  getUser(): Promise<{ user: { id: string } | null; error?: unknown }>;
  getProfile(authUserId: string): Promise<{
    profile: {
      id: string;
      auth_user_id: string;
      role: string;
      status: string;
      organization_id?: string | null;
    } | null;
    error?: unknown;
  }>;
};

const recruiterPermissions = new Set<RecruiterApiPermission>([
  "recruiter.candidate.read",
  "recruiter.candidate.compare",
  "recruiter.shortlist.manage",
  "recruiter.submission.manage",
  "recruiter.workflow.read",
  "recruiter.workflow.write",
  "recruiter.copilot.use",
]);
const managerPermissions = new Set<RecruiterApiPermission>([
  ...recruiterPermissions,
  "recruiter.reporting.read",
  "recruiter.data_quality.review",
  "recruiter.automation.approve",
]);
const permissionsByRole: Record<
  RecruiterApiRole,
  ReadonlySet<RecruiterApiPermission>
> = {
  recruiter: recruiterPermissions,
  recruiter_manager: managerPermissions,
  admin: new Set(RECRUITER_API_PERMISSIONS),
};
const roles = new Set<string>(RECRUITER_API_ROLES);
const hash = (value: string, length = 16) =>
  createHash("sha256").update(value).digest("hex").slice(0, length);

export function recruiterApiRoleHasPermission(
  role: RecruiterApiRole,
  permission: RecruiterApiPermission,
) {
  return permissionsByRole[role].has(permission);
}

export async function authorizeRecruiterApiAccess(input: {
  adapter: RecruiterApiAuthAdapter;
  permission: RecruiterApiPermission;
  routePolicyId: string;
  log: (event: Record<string, string>) => void;
}): Promise<RecruiterApiAuthorization> {
  const userResult = await input.adapter.getUser();
  if (userResult.error || !userResult.user?.id) {
    input.log({
      event: "anonymous_denial",
      reason: "authenticated_user_required",
    });
    return { allowed: false, status: 401, code: "authentication_required" };
  }
  const profileResult = await input.adapter.getProfile(userResult.user.id);
  const profile = profileResult.profile;
  if (
    profileResult.error ||
    !profile ||
    !profile.id ||
    profile.auth_user_id !== userResult.user.id
  ) {
    input.log({
      event: "profile_denial",
      reason: "authoritative_profile_required",
      actorHash: hash(userResult.user.id, 12),
    });
    return { allowed: false, status: 403, code: "active_profile_required" };
  }
  if (profile.status !== "active") {
    input.log({
      event: "inactive_profile_denial",
      reason: "active_profile_required",
      actorHash: hash(userResult.user.id, 12),
    });
    return { allowed: false, status: 403, code: "active_profile_required" };
  }
  const role = String(profile.role || "")
    .trim()
    .toLowerCase();
  if (!roles.has(role)) {
    input.log({
      event: "role_denial",
      reason: "recruiter_role_required",
      actorHash: hash(userResult.user.id, 12),
    });
    return { allowed: false, status: 403, code: "recruiter_role_required" };
  }
  if (
    !recruiterApiRoleHasPermission(role as RecruiterApiRole, input.permission)
  ) {
    input.log({
      event: "permission_denial",
      reason: "permission_not_granted",
      actorHash: hash(userResult.user.id, 12),
    });
    return { allowed: false, status: 403, code: "permission_required" };
  }
  const organizationId =
    typeof profile.organization_id === "string" &&
    profile.organization_id.trim()
      ? profile.organization_id.trim()
      : null;
  return {
    allowed: true,
    scope: {
      version: RECRUITER_API_SECURITY_VERSION,
      subjectId: userResult.user.id,
      profileId: profile.id,
      role: role as RecruiterApiRole,
      organizationId,
      cacheKey: hash(
        [
          RECRUITER_API_SECURITY_VERSION,
          userResult.user.id,
          profile.id,
          role,
          profile.status,
          organizationId || "organization-unassigned",
        ].join("|"),
        32,
      ),
    },
  };
}

export function recruiterApiDeniedBody(
  authorization: Extract<RecruiterApiAuthorization, { allowed: false }>,
) {
  return {
    error: {
      code: authorization.code,
      message:
        authorization.status === 401
          ? "Authentication is required."
          : "Access is not permitted.",
    },
  } as const;
}
