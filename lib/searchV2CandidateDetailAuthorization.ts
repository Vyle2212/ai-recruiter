import type { SearchV2CandidateDetailScope } from "./searchV2CandidateDetailContract";

export function candidateDetailDebugFeatureEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return environment.SEARCH_V2_CANDIDATE_DEBUG_ENABLED === "true";
}

export function resolveSearchV2CandidateDetailScope({
  role,
  debugRequested,
  debugFeatureEnabled,
}: {
  role: string;
  debugRequested: boolean;
  debugFeatureEnabled: boolean;
}): SearchV2CandidateDetailScope {
  return debugRequested &&
    debugFeatureEnabled &&
    ["admin", "qa"].includes(role.toLocaleLowerCase())
    ? "technical_debug"
    : "recruiter";
}

export function authorizeSearchV2CandidateDetailRequest({
  authenticated,
  active,
  role,
  debugRequested,
  debugFeatureEnabled,
}: {
  authenticated: boolean;
  active: boolean;
  role: string;
  debugRequested: boolean;
  debugFeatureEnabled: boolean;
}) {
  if (!authenticated)
    return {
      allowed: false,
      status: 401,
      code: "authentication_required",
    } as const;
  if (!active)
    return {
      allowed: false,
      status: 403,
      code: "active_recruiter_profile_required",
    } as const;
  if (
    ![
      "admin",
      "qa",
      "recruiter_manager",
      "recruiter",
      "local_preview",
    ].includes(role)
  )
    return {
      allowed: false,
      status: 403,
      code: "recruiter_role_required",
    } as const;
  return {
    allowed: true,
    status: 200,
    scope: resolveSearchV2CandidateDetailScope({
      role,
      debugRequested,
      debugFeatureEnabled,
    }),
  } as const;
}
