import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "app/auth/staging/runtime/page.tsx",
  "utf8",
);

const formsSource = readFileSync(
  "app/auth/staging/runtime/StagingRuntimeAuthForms.tsx",
  "utf8",
);

const panelSource = readFileSync(
  "app/auth/staging/runtime/StagingRuntimeAuthResultPanel.tsx",
  "utf8",
);

assert.match(
  pageSource,
  /buildCurrentStagingAuthExecutionGate/,
);

assert.match(
  pageSource,
  /canUseSupabaseStagingRuntimeProvider/,
);

assert.match(pageSource, /notFound\(\)/);
assert.match(pageSource, /dynamic = "force-dynamic"/);
assert.match(pageSource, /runtime = "nodejs"/);

assert.doesNotMatch(
  pageSource,
  /StagingSignInPreviewForm|previewStagingSignInAction/,
);

assert.match(
  formsSource,
  /stagingRuntimeSignInAction/,
);

assert.match(
  formsSource,
  /stagingRuntimeSignOutAction/,
);

assert.match(
  formsSource,
  /stagingRuntimeSessionAction/,
);

assert.doesNotMatch(
  formsSource,
  /previewStaging|StagingAuthUiActionState/,
);

assert.doesNotMatch(
  formsSource + panelSource,
  /process\.env|createServerClient|@supabase\/ssr|cookies\s*\(/,
);

assert.doesNotMatch(
  panelSource,
  /passwordReturned:\s*true|tokenReturned:\s*true/,
);

const previewLoginSource = readFileSync(
  "app/auth/login/page.tsx",
  "utf8",
);

assert.match(
  previewLoginSource,
  /StagingSignInPreviewForm/,
);

assert.doesNotMatch(
  previewLoginSource,
  /StagingRuntimeSignInForm|stagingRuntimeSignInAction/,
);

console.log("stagingAuthRuntimeUi.test.ts passed");