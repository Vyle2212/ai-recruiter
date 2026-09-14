import { createHash } from "node:crypto";

export const RECRUITER_SEARCH_API_SECURITY_VERSION =
  "recruiter-search-api-security-v1";

export const RECRUITER_SEARCH_ROLES = [
  "admin",
  "recruiter_manager",
  "recruiter",
] as const;

export type RecruiterSearchRole = (typeof RECRUITER_SEARCH_ROLES)[number];
export type RecruiterSearchPermission =
  | "search:read"
  | "external-search:read"
  | "candidate-detail:read"
  | "external-analysis:generate"
  | "external-profile:import"
  | "guided-intent:generate"
  | "guided-source:read"
  | "search-history:read"
  | "search-history:write";

export type RecruiterSearchSecurityEvent =
  | "authentication_failure"
  | "inactive_user"
  | "role_denial"
  | "invalid_authorization_scope"
  | "cross_scope_continuation_attempt"
  | "unauthorized_external_provider_action"
  | "unauthorized_candidate_detail_access";

type AuthUser = { id: string };
type Profile = {
  id: string;
  auth_user_id: string;
  role: string;
  status: string;
  organization_id?: string | null;
};

export type RecruiterSearchAuthAdapter = {
  getUser(): Promise<{ user: AuthUser | null; error?: unknown }>;
  getProfile(authUserId: string): Promise<{
    profile: Profile | null;
    error?: unknown;
  }>;
};

export type RecruiterSearchSecurityLogger = (
  event: RecruiterSearchSecurityEvent,
  details: {
    route: string;
    permission: RecruiterSearchPermission;
    reason: string;
    actorHash?: string;
  },
) => void;

export type RecruiterSearchAuthorizationScope = {
  version: typeof RECRUITER_SEARCH_API_SECURITY_VERSION;
  subjectId: string;
  profileId: string;
  role: RecruiterSearchRole;
  organizationId: string | null;
  cacheKey: string;
};

export type RecruiterSearchAuthorization =
  | {
      allowed: true;
      scope: RecruiterSearchAuthorizationScope;
    }
  | {
      allowed: false;
      status: 401 | 403;
      code:
        | "authentication_required"
        | "active_profile_required"
        | "recruiter_role_required"
        | "invalid_authorization_scope";
    };

export function recruiterSearchAuthorizationDeniedBody(
  authorization: Extract<RecruiterSearchAuthorization, { allowed: false }>,
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

export function recruiterSearchScopedCacheKey(
  namespace: string,
  authorizationScopeKey: string,
  identity: string,
) {
  const cleanNamespace = namespace.trim();
  const cleanScope = authorizationScopeKey.trim();
  const cleanIdentity = identity.trim();
  if (!cleanNamespace || !cleanScope || !cleanIdentity)
    throw new Error(
      "A complete recruiter authorization cache scope is required.",
    );
  const scopeDigest = createHash("sha256")
    .update(cleanScope)
    .digest("hex")
    .slice(0, 24);
  return `${cleanNamespace}:${scopeDigest}:${cleanIdentity}`;
}

const allowedRoles = new Set<string>(RECRUITER_SEARCH_ROLES);
const permissionsByRole: Record<
  RecruiterSearchRole,
  ReadonlySet<RecruiterSearchPermission>
> = Object.fromEntries(
  RECRUITER_SEARCH_ROLES.map((role) => [
    role,
    new Set<RecruiterSearchPermission>([
      "search:read",
      "external-search:read",
      "candidate-detail:read",
      "external-analysis:generate",
      "external-profile:import",
      "guided-intent:generate",
      "guided-source:read",
      "search-history:read",
      "search-history:write",
    ]),
  ]),
) as unknown as Record<
  RecruiterSearchRole,
  ReadonlySet<RecruiterSearchPermission>
>;
const actorHash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);

export async function authorizeRecruiterSearchAccess(input: {
  adapter: RecruiterSearchAuthAdapter;
  permission: RecruiterSearchPermission;
  route: string;
  log: RecruiterSearchSecurityLogger;
}): Promise<RecruiterSearchAuthorization> {
  const userResult = await input.adapter.getUser();
  if (userResult.error || !userResult.user?.id) {
    input.log("authentication_failure", {
      route: input.route,
      permission: input.permission,
      reason: "authenticated_user_required",
    });
    return {
      allowed: false,
      status: 401,
      code: "authentication_required",
    };
  }

  const profileResult = await input.adapter.getProfile(userResult.user.id);
  const profile = profileResult.profile;
  if (
    profileResult.error ||
    !profile ||
    profile.auth_user_id !== userResult.user.id ||
    !profile.id
  ) {
    input.log("invalid_authorization_scope", {
      route: input.route,
      permission: input.permission,
      reason: "authoritative_profile_required",
      actorHash: actorHash(userResult.user.id),
    });
    return {
      allowed: false,
      status: 403,
      code: "active_profile_required",
    };
  }

  if (profile.status !== "active") {
    input.log("inactive_user", {
      route: input.route,
      permission: input.permission,
      reason: "active_authoritative_profile_required",
      actorHash: actorHash(userResult.user.id),
    });
    return {
      allowed: false,
      status: 403,
      code: "active_profile_required",
    };
  }

  const role = String(profile.role || "")
    .trim()
    .toLocaleLowerCase();
  if (!allowedRoles.has(role)) {
    input.log("role_denial", {
      route: input.route,
      permission: input.permission,
      reason: "role_not_allowed",
      actorHash: actorHash(userResult.user.id),
    });
    return {
      allowed: false,
      status: 403,
      code: "recruiter_role_required",
    };
  }
  if (!permissionsByRole[role as RecruiterSearchRole].has(input.permission)) {
    input.log("role_denial", {
      route: input.route,
      permission: input.permission,
      reason: "permission_not_granted",
      actorHash: actorHash(userResult.user.id),
    });
    return {
      allowed: false,
      status: 403,
      code: "recruiter_role_required",
    };
  }

  const organizationId =
    typeof profile.organization_id === "string" &&
    profile.organization_id.trim()
      ? profile.organization_id.trim()
      : null;
  const scopeMaterial = [
    RECRUITER_SEARCH_API_SECURITY_VERSION,
    userResult.user.id,
    profile.id,
    role,
    profile.status,
    organizationId || "tenant-unassigned",
  ].join("|");
  const cacheKey = createHash("sha256")
    .update(scopeMaterial)
    .digest("hex")
    .slice(0, 32);
  if (!cacheKey) {
    input.log("invalid_authorization_scope", {
      route: input.route,
      permission: input.permission,
      reason: "scope_material_incomplete",
      actorHash: actorHash(userResult.user.id),
    });
    return {
      allowed: false,
      status: 403,
      code: "invalid_authorization_scope",
    };
  }

  return {
    allowed: true,
    scope: {
      version: RECRUITER_SEARCH_API_SECURITY_VERSION,
      subjectId: userResult.user.id,
      profileId: profile.id,
      role: role as RecruiterSearchRole,
      organizationId,
      cacheKey,
    },
  };
}
