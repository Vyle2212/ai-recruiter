import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSupabaseStagingRuntimeAdapter } from "../lib/stagingAuthSupabaseRuntimeAdapter";

async function main() {
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
        result.tokenReturned === false,
    ),
  );

  const serialized = JSON.stringify(results);

  assert(!serialized.includes("discarded@example.invalid"));
  assert(!serialized.includes("discarded-password"));
  assert(!serialized.includes("discarded-token"));

  assert.throws(
    () =>
      createSupabaseStagingRuntimeAdapter({
        explicitlyEnabled: true,
      }),
    /supabase_staging_runtime_provider_not_implemented/,
  );

  const providerSource = readFileSync(
    "lib/stagingAuthSupabaseRuntimeAdapter.ts",
    "utf8",
  );

  assert.doesNotMatch(
    providerSource,
    /createServerClient|createClient\s*\(|\.auth\.|cookies\s*\(|process\.env/,
  );

  console.log(
    "stagingAuthSupabaseRuntimeAdapter.test.ts passed",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});