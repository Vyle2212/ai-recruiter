import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createSupabaseStagingRuntimeAdapter,
  type SupabaseStagingAuthClient,
} from "../lib/stagingAuthSupabaseRuntimeAdapter";

type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  role: string;
  status: string;
  organization_id: string | null;
  client_id: string | null;
  candidate_id: string | null;
};

type MockOptions = {
  profile?: ProfileRow | null;
  authUserId?: string;
  email?: string;
  authError?: {
    code?: string;
    message?: string;
    status?: number;
  } | null;
};

function createMockClient(options: MockOptions = {}) {
  const authUserId =
    options.authUserId || "11111111-1111-1111-1111-111111111111";

  const email =
    options.email || "admin.user@example.invalid";

  const profile =
    options.profile === undefined
      ? {
          id: "22222222-2222-2222-2222-222222222222",
          auth_user_id: authUserId,
          email,
          role: "admin",
          status: "active",
          organization_id:
            "33333333-3333-3333-3333-333333333333",
          client_id: null,
          candidate_id: null,
        }
      : options.profile;

  const counters = {
    getSession: 0,
    getUser: 0,
    signIn: 0,
    signOut: 0,
    passwordReset: 0,
    refreshSession: 0,
    profileReads: 0,
  };

  const user = {
    id: authUserId,
    email,
  };

  const session = {
    user,
    expires_at: 2_000_000_000,
  };

  const client: SupabaseStagingAuthClient = {
    auth: {
      async getSession() {
        counters.getSession += 1;

        return {
          data: {
            session: options.authError ? null : session,
          },
          error: options.authError || null,
        };
      },

      async getUser() {
        counters.getUser += 1;

        return {
          data: {
            user: options.authError ? null : user,
          },
          error: options.authError || null,
        };
      },

      async signInWithPassword(_input) {
        counters.signIn += 1;

        return {
          data: {
            user: options.authError ? null : user,
            session: options.authError ? null : session,
          },
          error: options.authError || null,
        };
      },

      async signOut() {
        counters.signOut += 1;

        return {
          data: {},
          error: null,
        };
      },

      async resetPasswordForEmail(_email) {
        counters.passwordReset += 1;

        return {
          data: {},
          error: options.authError || null,
        };
      },

      async refreshSession() {
        counters.refreshSession += 1;

        return {
          data: {
            user: options.authError ? null : user,
            session: options.authError ? null : session,
          },
          error: options.authError || null,
        };
      },
    },

    from(table) {
      assert.equal(table, "user_profiles");

      return {
        select(columns) {
          assert.match(columns, /auth_user_id/);
          assert.match(columns, /organization_id/);

          return {
            eq(column, value) {
              assert.equal(column, "auth_user_id");
              assert.equal(value, authUserId);

              return {
                async maybeSingle() {
                  counters.profileReads += 1;

                  return {
                    data: profile,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    client,
    counters,
    authUserId,
    email,
  };
}

async function testDisabledByDefault() {
  const adapter = createSupabaseStagingRuntimeAdapter();

  assert.equal(adapter.provider, "disabled");

  const results = await Promise.all([
    adapter.getSession(),
    adapter.getUser(),
    adapter.getProfile(),
    adapter.signIn({
      email: "discarded@example.invalid",
      password: "discarded-password",
    }),
    adapter.signOut(),
    adapter.requestPasswordReset({
      email: "discarded@example.invalid",
    }),
    adapter.acceptInvitation({
      invitationToken: "discarded-token",
    }),
    adapter.refreshSession(),
  ]);

  assert.equal(results.length, 8);

  assert(
    results.every(
      (result) =>
        result.ok === false &&
        result.status === "blocked" &&
        result.realActionExecuted === false &&
        result.sensitiveInputReturned === false &&
        result.tokenReturned === false &&
        result.productionBlocked === true,
    ),
  );

  const serialized = JSON.stringify(results);

  assert(!serialized.includes("discarded@example.invalid"));
  assert(!serialized.includes("discarded-password"));
  assert(!serialized.includes("discarded-token"));
}

async function testEnabledWithoutInjectedClient() {
  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
    });

  assert.equal(adapter.provider, "disabled");

  const result = await adapter.getSession();

  assert.equal(result.status, "blocked");
  assert.equal(result.realActionExecuted, false);
  assert(
    result.blockerKeys.includes(
      "supabase_staging_runtime_disabled",
    ),
  );
}

async function testActiveAdminProfileMapping() {
  const mock = createMockClient();

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  assert.equal(adapter.provider, "supabase_staging");

  const userResult = await adapter.getUser();

  assert.equal(userResult.ok, true);
  assert.equal(userResult.status, "success");
  assert.equal(userResult.realActionExecuted, true);
  assert.equal(userResult.data?.userId, mock.authUserId);
  assert.equal(userResult.data?.role, "admin");
  assert.equal(userResult.data?.authenticated, true);
  assert.equal(userResult.data?.realUser, true);
  assert.equal(
    userResult.data?.organizationId,
    "33333333-3333-3333-3333-333333333333",
  );
  assert.equal(userResult.data?.clientId, undefined);
  assert.equal(userResult.data?.candidateId, undefined);
  assert.equal(
    userResult.data?.emailMasked,
    "a***@***.invalid",
  );

  const profileResult = await adapter.getProfile();

  assert.equal(profileResult.ok, true);
  assert.deepEqual(profileResult.data, {
    userId: mock.authUserId,
    role: "admin",
    organizationId:
      "33333333-3333-3333-3333-333333333333",
    clientId: null,
    candidateId: null,
  });

  assert.equal(mock.counters.getUser, 2);
  assert.equal(mock.counters.profileReads, 2);
}

async function testSessionAndRefreshDoNotExposeTokens() {
  const mock = createMockClient();

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const sessionResult = await adapter.getSession();

  assert.equal(sessionResult.ok, true);
  assert.equal(
    sessionResult.data?.status,
    "authenticated",
  );
  assert.equal(sessionResult.data?.realSession, true);
  assert.equal(sessionResult.data?.cookieUsed, true);
  assert.equal(sessionResult.data?.tokenExposed, false);
  assert.equal(sessionResult.tokenReturned, false);
  assert.equal(
    sessionResult.data?.identity?.role,
    "admin",
  );

  const refreshResult = await adapter.refreshSession();

  assert.equal(refreshResult.ok, true);
  assert.equal(
    refreshResult.data?.status,
    "authenticated",
  );
  assert.equal(refreshResult.data?.tokenExposed, false);
  assert.equal(refreshResult.tokenReturned, false);

  const serialized = JSON.stringify({
    sessionResult,
    refreshResult,
  });

  assert.doesNotMatch(
    serialized,
    /access_token|refresh_token|bearer/i,
  );
}

async function testSuccessfulSignInAndSensitiveRedaction() {
  const mock = createMockClient({
    email: "sensitive.admin@example.invalid",
  });

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const password =
    "Sensitive-Password-That-Must-Not-Be-Returned";

  const result = await adapter.signIn({
    email: mock.email,
    password,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "success");
  assert.equal(result.data?.status, "authenticated");
  assert.equal(result.data?.identity?.role, "admin");
  assert.equal(result.sensitiveInputReturned, false);
  assert.equal(result.tokenReturned, false);

  const serialized = JSON.stringify(result);

  assert(!serialized.includes(password));
  assert(!serialized.includes(mock.email));
  assert.equal(
    result.data?.identity?.emailMasked,
    "s***@***.invalid",
  );
}

async function testInactiveProfileRejected() {
  const mock = createMockClient({
    profile: {
      id: "22222222-2222-2222-2222-222222222222",
      auth_user_id:
        "11111111-1111-1111-1111-111111111111",
      email: "inactive@example.invalid",
      role: "admin",
      status: "disabled",
      organization_id:
        "33333333-3333-3333-3333-333333333333",
      client_id: null,
      candidate_id: null,
    },
  });

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const result = await adapter.getUser();

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed_safe");
  assert.equal(
    result.errorCode,
    "active_profile_not_found",
  );
  assert(
    result.blockerKeys.includes(
      "active_profile_required",
    ),
  );
  assert.equal(result.data, null);
}

async function testMissingProfileTriggersSignOutCleanup() {
  const mock = createMockClient({
    profile: null,
  });

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const result = await adapter.signIn({
    email: "missing.profile@example.invalid",
    password: "discarded-password",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed_safe");
  assert.equal(
    result.errorCode,
    "active_profile_not_found",
  );
  assert.equal(mock.counters.signIn, 1);
  assert.equal(mock.counters.signOut, 1);
  assert.equal(result.data?.status, "no_session");
  assert.equal(result.data?.realSession, false);
}

async function testSafeAuthErrorHandling() {
  const mock = createMockClient({
    authError: {
      code: "invalid_credentials",
      message:
        "Unsafe raw error containing user@example.invalid",
      status: 400,
    },
  });

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const result = await adapter.signIn({
    email: "user@example.invalid",
    password: "unsafe-password",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed_safe");
  assert.equal(result.errorCode, "invalid_credentials");

  const serialized = JSON.stringify(result);

  assert(!serialized.includes("user@example.invalid"));
  assert(!serialized.includes("unsafe-password"));
  assert(!serialized.includes("Unsafe raw error"));
}

async function testPasswordResetAndSignOut() {
  const mock = createMockClient();

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const reset = await adapter.requestPasswordReset({
    email: "reset@example.invalid",
  });

  assert.equal(reset.ok, true);
  assert.equal(reset.status, "success");
  assert.equal(mock.counters.passwordReset, 1);
  assert(
    !JSON.stringify(reset).includes(
      "reset@example.invalid",
    ),
  );

  const signOut = await adapter.signOut();

  assert.equal(signOut.ok, true);
  assert.equal(signOut.status, "success");
  assert.equal(mock.counters.signOut, 1);
}

async function testInvitationRemainsBlocked() {
  const mock = createMockClient();

  const adapter =
    createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: async () => mock.client,
    });

  const token =
    "Invitation-Token-Must-Not-Be-Returned";

  const result = await adapter.acceptInvitation({
    invitationToken: token,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.realActionExecuted, false);
  assert(
    result.blockerKeys.includes(
      "supabase_invitation_runtime_not_implemented",
    ),
  );
  assert(!JSON.stringify(result).includes(token));
}

function testProviderSourceBoundary() {
  const providerSource = readFileSync(
    "lib/stagingAuthSupabaseRuntimeAdapter.ts",
    "utf8",
  );

  assert.doesNotMatch(
    providerSource,
    /from\s+["']@supabase\/ssr["']|from\s+["']@supabase\/supabase-js["']|createServerClient|cookies\s*\(|process\.env/,
  );

  assert.match(
    providerSource,
    /createClient\?:\s*\(\)\s*=>\s*Promise/,
  );

  assert.match(
    providerSource,
    /\.from\("user_profiles"\)/,
  );

  assert.match(
    providerSource,
    /\.eq\("auth_user_id",\s*user\.id\)/,
  );
}

async function main() {
  await testDisabledByDefault();
  await testEnabledWithoutInjectedClient();
  await testActiveAdminProfileMapping();
  await testSessionAndRefreshDoNotExposeTokens();
  await testSuccessfulSignInAndSensitiveRedaction();
  await testInactiveProfileRejected();
  await testMissingProfileTriggersSignOutCleanup();
  await testSafeAuthErrorHandling();
  await testPasswordResetAndSignOut();
  await testInvitationRemainsBlocked();
  testProviderSourceBoundary();

  console.log(
    "stagingAuthSupabaseRuntimeAdapter.test.ts passed",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});