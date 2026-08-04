import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { executeStagingAuthRuntimeAction } from "../lib/stagingAuthRuntimeActionService";
import type { StagingAuthRuntimeAdapter } from "../lib/stagingAuthRuntimeAdapterTypes";

function adapter(): StagingAuthRuntimeAdapter {
  return {
    provider: "supabase_staging",

    getSession: async () => ({
      operation: "get_session",
      ok: true,
      status: "success",
      data: {
        status: "authenticated",
        expiresAt: null,
        tokenExposed: false,
        cookieUsed: true,
        realSession: true,
        identity: {
          userId: "safe-user-id",
          emailMasked: "a***@***.invalid",
          role: "admin",
          organizationId: "safe-organization-id",
          source: "supabase_staging",
          authenticated: true,
          realUser: true,
        },
      },
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    getUser: async () => ({
      operation: "get_user",
      ok: true,
      status: "success",
      data: {
        userId: "safe-user-id",
        emailMasked: "a***@***.invalid",
        role: "admin",
        organizationId: "safe-organization-id",
        source: "supabase_staging",
        authenticated: true,
        realUser: true,
      },
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    getProfile: async () => ({
      operation: "get_profile",
      ok: true,
      status: "success",
      data: {
        userId: "safe-user-id",
        role: "admin",
        organizationId: "safe-organization-id",
      },
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    signIn: async () => ({
      operation: "sign_in",
      ok: true,
      status: "success",
      data: {
        status: "authenticated",
        expiresAt: null,
        tokenExposed: false,
        cookieUsed: true,
        realSession: true,
        identity: {
          userId: "safe-user-id",
          emailMasked: "a***@***.invalid",
          role: "admin",
          source: "supabase_staging",
          authenticated: true,
          realUser: true,
        },
      },
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    signOut: async () => ({
      operation: "sign_out",
      ok: true,
      status: "success",
      data: null,
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    requestPasswordReset: async () => ({
      operation: "request_password_reset",
      ok: true,
      status: "success",
      data: null,
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),

    acceptInvitation: async () => ({
      operation: "accept_invitation",
      ok: false,
      status: "blocked",
      data: null,
      blockerKeys: [
        "supabase_invitation_runtime_not_implemented",
      ],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: false,
      productionBlocked: true,
    }),

    refreshSession: async () => ({
      operation: "refresh_session",
      ok: true,
      status: "success",
      data: {
        status: "authenticated",
        expiresAt: null,
        tokenExposed: false,
        cookieUsed: true,
        realSession: true,
      },
      blockerKeys: [],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: true,
      productionBlocked: true,
    }),
  };
}

async function main() {
  const runtimeAdapter = adapter();

  const password = "do-not-return-password";
  const email = "admin.user@example.invalid";

  const signIn = await executeStagingAuthRuntimeAction(
    runtimeAdapter,
    {
      operation: "sign_in",
      email,
      password,
    },
  );

  assert.equal(signIn.ok, true);
  assert.equal(signIn.status, "success");
  assert.equal(signIn.role, "admin");
  assert.equal(signIn.authenticated, true);
  assert.equal(signIn.sessionStatus, "authenticated");
  assert.equal(signIn.realActionExecuted, true);
  assert.equal(signIn.emailMasked, "a***@***.invalid");

  const serialized = JSON.stringify(signIn);

  assert(!serialized.includes(password));
  assert(!serialized.includes(email));
  assert.doesNotMatch(
    serialized,
    /access_token|refresh_token|bearer/i,
  );

  const invalid = await executeStagingAuthRuntimeAction(
    runtimeAdapter,
    {
      operation: "sign_in",
      email: "invalid",
      password: "",
    },
  );

  assert.equal(invalid.ok, false);
  assert.equal(invalid.realActionExecuted, false);
  assert.equal(invalid.errorCode, "invalid_sign_in_input");

  const invitation =
    await executeStagingAuthRuntimeAction(
      runtimeAdapter,
      {
        operation: "accept_invitation",
        invitationToken: "discarded-token",
      },
    );

  assert.equal(invitation.status, "blocked");
  assert.equal(invitation.realActionExecuted, false);
  assert(
    !JSON.stringify(invitation).includes("discarded-token"),
  );

  const serverSource = readFileSync(
    "lib/stagingAuthRuntimeActionServiceServer.ts",
    "utf8",
  );

  assert.match(serverSource, /import "server-only"/);
  assert.match(
    serverSource,
    /buildCurrentStagingAuthRuntimeAdapter/,
  );

  const pureSource = readFileSync(
    "lib/stagingAuthRuntimeActionService.ts",
    "utf8",
  );

  assert.doesNotMatch(
    pureSource,
    /process\.env|cookies\s*\(|@supabase\/ssr|createServerClient/,
  );

  console.log(
    "stagingAuthRuntimeActionService.test.ts passed",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});