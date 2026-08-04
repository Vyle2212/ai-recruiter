import assert from "node:assert/strict";
import { createDisabledStagingAuthAdapter } from "../lib/stagingAuthDisabledAdapter";
import { createAsyncRuntimeAdapter } from "../lib/stagingAuthRuntimeAdapter";

async function main() {
  const adapter = createAsyncRuntimeAdapter(
    createDisabledStagingAuthAdapter(),
  );

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
        !result.realActionExecuted &&
        !result.sensitiveInputReturned &&
        !result.tokenReturned,
    ),
  );

  const serialized = JSON.stringify(results);

  assert(!serialized.includes("discarded@example.invalid"));
  assert(!serialized.includes("discarded-password"));
  assert(!serialized.includes("discarded-token"));

  console.log("stagingAuthRuntimeAdapter.test.ts passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});