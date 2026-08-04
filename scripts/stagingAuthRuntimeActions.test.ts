import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "app/auth/runtime-actions.ts",
  "utf8",
);

assert.match(source, /"use server"/);
assert.match(
  source,
  /executeCurrentStagingAuthRuntimeAction/,
);

for (const operation of [
  "sign_in",
  "sign_out",
  "request_password_reset",
  "accept_invitation",
  "get_session",
  "get_user",
  "get_profile",
  "refresh_session",
]) {
  assert.match(source, new RegExp(`operation:\\s*"${operation}"`));
}

assert.doesNotMatch(
  source,
  /previewStaging|buildStagingAuthUiActionState|StagingAuthUiActionState/,
);

assert.doesNotMatch(
  source,
  /console\.|process\.env|cookies\s*\(|createServerClient|@supabase\/ssr/,
);

assert.doesNotMatch(
  source,
  /password\s*:\s*["'][^"']+["']|invitationToken\s*:\s*["'][^"']+["']/,
);

const previewSource = readFileSync(
  "app/auth/staging-actions.ts",
  "utf8",
);

assert.doesNotMatch(
  previewSource,
  /stagingRuntimeSignInAction|executeCurrentStagingAuthRuntimeAction/,
);

console.log("stagingAuthRuntimeActions.test.ts passed");