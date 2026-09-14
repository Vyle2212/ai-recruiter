import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { NextRequest } from "next/server";
import {
  RECRUITER_SEARCH_API_SECURITY_VERSION,
  authorizeRecruiterSearchAccess,
  recruiterSearchAuthorizationDeniedBody,
  recruiterSearchScopedCacheKey,
  type RecruiterSearchAuthAdapter,
  type RecruiterSearchSecurityEvent,
} from "../lib/recruiterSearchAuthorizationCore";
import { searchV2RequestDatasetAllowed } from "../lib/searchV2RequestDatasetBoundary";

type ProfileInput = {
  userId?: string | null;
  profileId?: string | null;
  role?: string;
  status?: string;
  organizationId?: string | null;
};

const events: RecruiterSearchSecurityEvent[] = [];
const adapter = (input: ProfileInput): RecruiterSearchAuthAdapter => ({
  async getUser() {
    return { user: input.userId ? { id: input.userId } : null };
  },
  async getProfile(authUserId) {
    return {
      profile: input.profileId
        ? {
            id: input.profileId,
            auth_user_id: authUserId,
            role: input.role || "recruiter",
            status: input.status || "active",
            organization_id: input.organizationId ?? null,
          }
        : null,
    };
  },
});

async function decide(input: ProfileInput) {
  return authorizeRecruiterSearchAccess({
    adapter: adapter(input),
    permission: "search:read",
    route: "/api/recruiter/search-v2",
    log(event) {
      events.push(event);
    },
  });
}

async function main() {
  assert.equal(
    RECRUITER_SEARCH_API_SECURITY_VERSION,
    "recruiter-search-api-security-v1",
  );
  const anonymous = await decide({ userId: null });
  assert.deepEqual(anonymous, {
    allowed: false,
    status: 401,
    code: "authentication_required",
  });
  assert.deepEqual(recruiterSearchAuthorizationDeniedBody(anonymous), {
    error: {
      code: "authentication_required",
      message: "Authentication is required.",
    },
  });
  assert.doesNotMatch(
    JSON.stringify(recruiterSearchAuthorizationDeniedBody(anonymous)),
    /candidate|provider|supabase|exa|environment|cookie|token/i,
  );

  const missingProfile = await decide({ userId: "auth-missing" });
  assert.equal(missingProfile.allowed, false);
  assert.equal(missingProfile.status, 403);
  const inactive = await decide({
    userId: "auth-inactive",
    profileId: "profile-inactive",
    status: "inactive",
  });
  assert.equal(inactive.allowed, false);
  assert.equal(inactive.status, 403);

  for (const role of ["client", "candidate", "qa", "unknown"]) {
    const denied = await decide({
      userId: `auth-${role}`,
      profileId: `profile-${role}`,
      role,
    });
    assert.equal(denied.allowed, false, `${role} must be denied`);
    assert.equal(denied.status, 403);
  }

  const allowedScopes = [];
  for (const role of ["recruiter", "recruiter_manager", "admin"]) {
    const allowed = await decide({
      userId: `auth-${role}`,
      profileId: `profile-${role}`,
      role,
      organizationId: "org-authoritative",
    });
    assert.equal(allowed.allowed, true, `${role} must be allowed`);
    if (allowed.allowed) allowedScopes.push(allowed.scope);
  }
  assert.equal(new Set(allowedScopes.map((scope) => scope.cacheKey)).size, 3);
  const activeBeforeDeactivation = await decide({
    userId: "auth-deactivation",
    profileId: "profile-deactivation",
    role: "recruiter",
  });
  const inactiveAfterDeactivation = await decide({
    userId: "auth-deactivation",
    profileId: "profile-deactivation",
    role: "recruiter",
    status: "inactive",
  });
  assert.equal(activeBeforeDeactivation.allowed, true);
  assert.equal(inactiveAfterDeactivation.allowed, false);

  let profileReads = 0;
  let sensitiveDependencyCalls = 0;
  const deniedBeforeDependency = await authorizeRecruiterSearchAccess({
    adapter: {
      async getUser() {
        return { user: null };
      },
      async getProfile() {
        profileReads += 1;
        return { profile: null };
      },
    },
    permission: "external-search:read",
    route: "/api/recruiter/search-v2",
    log() {},
  });
  if (deniedBeforeDependency.allowed) sensitiveDependencyCalls += 1;
  assert.equal(
    profileReads,
    0,
    "anonymous denial precedes profile/data access",
  );
  assert.equal(
    sensitiveDependencyCalls,
    0,
    "denied authorization cannot invoke Supabase, Exa, or AI dependencies",
  );

  const detailScopeA = recruiterSearchScopedCacheKey(
    "candidate-detail-v1",
    "scope-a",
    "candidate-1",
  );
  const detailScopeB = recruiterSearchScopedCacheKey(
    "candidate-detail-v1",
    "scope-b",
    "candidate-1",
  );
  assert.notEqual(detailScopeA, detailScopeB);
  assert.throws(() =>
    recruiterSearchScopedCacheKey("candidate-detail-v1", "", "candidate-1"),
  );
  assert.equal(
    searchV2RequestDatasetAllowed({
      nodeEnv: "production",
      enabled: true,
      authoritativeRole: "admin",
    }),
    false,
  );
  assert.equal(
    searchV2RequestDatasetAllowed({
      nodeEnv: "test",
      enabled: true,
      authoritativeRole: "recruiter",
    }),
    false,
  );
  assert.equal(
    searchV2RequestDatasetAllowed({
      nodeEnv: "test",
      enabled: true,
      authoritativeRole: "admin",
    }),
    true,
  );

  const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
  const postRoute = route.slice(route.indexOf("export async function POST"));
  const authIndex = postRoute.indexOf("requireRecruiterSearchAuthorization({");
  assert.ok(authIndex >= 0);
  assert.ok(authIndex < postRoute.indexOf("readRequestBody(request)"));
  assert.ok(authIndex < postRoute.indexOf("fetchCandidateSource()"));
  assert.ok(
    authIndex < postRoute.indexOf("externalTalentProvider().capability()"),
  );

  const routeFiles = [
    "app/api/recruiter/search-v2/route.ts",
    "app/api/recruiter/search-v2/candidate-details/[candidateId]/route.ts",
    "app/api/recruiter/search-v2/external-analysis/route.ts",
    "app/api/recruiter/search-v2/external-profile-import/route.ts",
    "app/api/recruiter/search-v2/guided-intent/route.ts",
    "app/api/recruiter/search-v2/guided-source/route.ts",
    "app/api/recruiter/search-v2/history/route.ts",
  ];
  for (const file of routeFiles)
    assert.match(
      readFileSync(file, "utf8"),
      /requireRecruiterSearchAuthorization/,
      `${file} must use the central Search V2 boundary`,
    );

  const productionRoute = readFileSync(
    "app/api/recruiter/search-v2/route.ts",
    "utf8",
  );
  assert.match(productionRoute, /SEARCH_V2_TEST_PAYLOADS_ENABLED/);
  assert.match(productionRoute, /searchV2RequestDatasetAllowed/);
  assert.match(productionRoute, /request_dataset_not_allowed/);
  assert.ok(events.includes("authentication_failure"));
  assert.ok(events.includes("inactive_user"));
  assert.ok(events.includes("role_denial"));
  assert.ok(events.includes("invalid_authorization_scope"));

  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const authRuntime = await import("../lib/recruiterSearchAuthorization");
  const providerRuntime = await import("../lib/externalTalentProviderRegistry");
  const searchRoute = await import("../app/api/recruiter/search-v2/route");
  const detailRoute =
    await import("../app/api/recruiter/search-v2/candidate-details/[candidateId]/route");
  const analysisRoute =
    await import("../app/api/recruiter/search-v2/external-analysis/route");
  const importRoute =
    await import("../app/api/recruiter/search-v2/external-profile-import/route");
  const guidedIntentRoute =
    await import("../app/api/recruiter/search-v2/guided-intent/route");
  const guidedSourceRoute =
    await import("../app/api/recruiter/search-v2/guided-source/route");
  const historyRoute =
    await import("../app/api/recruiter/search-v2/history/route");
  let capabilityCalls = 0;
  let providerSearchCalls = 0;
  providerRuntime.setExternalTalentProviderForTests({
    source: "linkedin_talent_pool",
    async capability() {
      capabilityCalls += 1;
      return {
        source: "linkedin_talent_pool",
        providerId: "authorization-fixture",
        providerName: "Authorization fixture",
        connected: true,
        ready: true,
        status: "ready",
        reason: null,
        authentication: "valid",
        supportedFilters: ["query"],
        supportsCandidateDetails: false,
        supportsImport: false,
        pagination: "none",
        sandboxAvailable: true,
      } as const;
    },
    async search() {
      providerSearchCalls += 1;
      return {
        sourceRequestId: "authorization-fixture-request",
        candidates: [],
      };
    },
  });
  authRuntime.setRecruiterSearchAuthorizationResolverForTests(async () => ({
    allowed: false,
    status: 401,
    code: "authentication_required",
  }));

  const anonymousReadiness = await searchRoute.GET(
    new NextRequest("http://localhost/api/recruiter/search-v2"),
  );
  assert.equal(anonymousReadiness.status, 401);
  const anonymousCapability = await searchRoute.GET(
    new NextRequest(
      "http://localhost/api/recruiter/search-v2?source=linkedin_talent_pool",
    ),
  );
  assert.equal(anonymousCapability.status, 401);
  assert.equal(capabilityCalls, 0);

  let deniedBodyReads = 0;
  const deniedInternal = await searchRoute.POST({
    headers: new Headers(),
    async json() {
      deniedBodyReads += 1;
      return { query: "SAP FICO", talentPool: "internal_profiles" };
    },
  } as NextRequest);
  const deniedExternal = await searchRoute.POST({
    headers: new Headers(),
    async json() {
      deniedBodyReads += 1;
      return { query: "SAP FICO", talentPool: "linkedin_talent_pool" };
    },
  } as NextRequest);
  assert.equal(deniedInternal.status, 401);
  assert.equal(deniedExternal.status, 401);
  assert.equal(deniedBodyReads, 0);
  assert.equal(providerSearchCalls, 0);

  let candidateParamReads = 0;
  const deniedDetail = await detailRoute.GET(
    new Request("http://localhost/api/recruiter/search-v2/candidate-details/x"),
    {
      get params() {
        candidateParamReads += 1;
        return Promise.resolve({ candidateId: "private-candidate" });
      },
    },
  );
  assert.equal(deniedDetail.status, 401);
  assert.equal(candidateParamReads, 0);

  let analysisBodyReads = 0;
  const deniedAnalysis = await analysisRoute.POST({
    signal: new AbortController().signal,
    async json() {
      analysisBodyReads += 1;
      return { candidateId: "private-candidate", evidence: [] };
    },
  } as NextRequest);
  assert.equal(deniedAnalysis.status, 401);
  assert.equal(analysisBodyReads, 0);

  let importFormReads = 0;
  const deniedImport = await importRoute.POST({
    async formData() {
      importFormReads += 1;
      return new FormData();
    },
  } as Request);
  assert.equal(deniedImport.status, 401);
  assert.equal(importFormReads, 0);

  let guidedBodyReads = 0;
  const deniedGuidedIntent = await guidedIntentRoute.POST({
    async json() {
      guidedBodyReads += 1;
      return { brief: "private job description" };
    },
  } as NextRequest);
  assert.equal(deniedGuidedIntent.status, 401);
  assert.equal(guidedBodyReads, 0);
  const deniedGuidedSource = await guidedSourceRoute.GET();
  assert.equal(deniedGuidedSource.status, 401);
  const deniedHistory = await historyRoute.GET();
  assert.equal(deniedHistory.status, 401);

  for (const role of ["recruiter", "recruiter_manager", "admin"] as const) {
    authRuntime.setRecruiterSearchAuthorizationResolverForTests(async () => ({
      allowed: true,
      scope: {
        version: RECRUITER_SEARCH_API_SECURITY_VERSION,
        subjectId: `auth-${role}`,
        profileId: `profile-${role}`,
        role,
        organizationId: "org-authoritative",
        cacheKey: `scope-${role}`,
      },
    }));
    const allowedCapability = await searchRoute.GET(
      new NextRequest(
        "http://localhost/api/recruiter/search-v2?source=linkedin_talent_pool",
      ),
    );
    assert.equal(allowedCapability.status, 200);
  }
  assert.equal(capabilityCalls, 3);

  authRuntime.setRecruiterSearchAuthorizationResolverForTests(async () => ({
    allowed: true,
    scope: {
      version: RECRUITER_SEARCH_API_SECURITY_VERSION,
      subjectId: "auth-recruiter",
      profileId: "profile-recruiter",
      role: "recruiter",
      organizationId: "org-authoritative",
      cacheKey: "scope-recruiter",
    },
  }));
  const injectedDataset = await searchRoute.POST(
    new NextRequest("http://localhost/api/recruiter/search-v2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "Private Candidate",
        candidates: [{ id: "private", name: "Private Candidate" }],
      }),
    }),
  );
  assert.equal(injectedDataset.status, 403);
  assert.deepEqual(await injectedDataset.json(), {
    error: {
      code: "request_dataset_not_allowed",
      message: "Request-supplied candidate datasets are not permitted.",
    },
  });

  const previousNodeEnv = process.env.NODE_ENV;
  const previousTestPayloads = process.env.SEARCH_V2_TEST_PAYLOADS_ENABLED;
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.SEARCH_V2_TEST_PAYLOADS_ENABLED = "true";
  authRuntime.setRecruiterSearchAuthorizationResolverForTests(async () => ({
    allowed: true,
    scope: {
      version: RECRUITER_SEARCH_API_SECURITY_VERSION,
      subjectId: "auth-admin",
      profileId: "profile-admin",
      role: "admin",
      organizationId: "org-authoritative",
      cacheKey: "scope-admin-authorized-fixture",
    },
  }));
  const authorizedInternal = await searchRoute.POST(
    new NextRequest("http://localhost/api/recruiter/search-v2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "Authorized Fixture Person",
        talentPool: "internal_profiles",
        candidates: [
          {
            id: "authorized-fixture-person",
            name: "Authorized Fixture Person",
            title: "SAP FICO Consultant",
            country: "Malaysia",
          },
        ],
      }),
    }),
  );
  assert.equal(authorizedInternal.status, 200);
  const authorizedPayload = await authorizedInternal.json();
  assert.equal(authorizedPayload.summary.totalMatched, 1);
  assert.equal(
    authorizedPayload.results[0]?.candidateName,
    "Authorized Fixture Person",
  );
  if (previousNodeEnv === undefined)
    Reflect.deleteProperty(process.env, "NODE_ENV");
  else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
  if (previousTestPayloads === undefined)
    delete process.env.SEARCH_V2_TEST_PAYLOADS_ENABLED;
  else process.env.SEARCH_V2_TEST_PAYLOADS_ENABLED = previousTestPayloads;

  authRuntime.setRecruiterSearchAuthorizationResolverForTests(null);
  providerRuntime.setExternalTalentProviderForTests(null);
  runtime._load = originalLoad;
  console.log("Search V2 authorization boundary regressions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
