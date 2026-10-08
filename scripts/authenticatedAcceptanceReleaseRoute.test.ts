import assert from "node:assert/strict";

async function main() {
  const previous = {
    chat: process.env.CHAT_ENABLED,
    mode: process.env.ACCEPTANCE_TEST_MODE,
    environment: process.env.APP_ENV,
    sha: process.env.ACCEPTANCE_DEPLOYED_SHA,
    id: process.env.ACCEPTANCE_ENVIRONMENT_ID,
    project: process.env.ACCEPTANCE_SUPABASE_PROJECT_REF,
    candidateUpload: process.env.CANDIDATE_CV_UPLOAD_ENABLED,
    candidateConfirmation: process.env.CANDIDATE_PROFILE_CONFIRMATION_ENABLED,
    registration: process.env.CANDIDATE_REGISTRATION_ENABLED,
    registrationOrigin: process.env.CANDIDATE_REGISTRATION_ORIGIN,
    registrationProject:
      process.env.CANDIDATE_REGISTRATION_SUPABASE_PROJECT_REF,
    turnstile: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const route = await import("../app/api/acceptance/release/route");
  delete process.env.ACCEPTANCE_TEST_MODE;
  process.env.APP_ENV = "test";
  assert.equal((await route.GET()).status, 404);
  process.env.ACCEPTANCE_TEST_MODE = "true";
  process.env.APP_ENV = "acceptance";
  delete process.env.ACCEPTANCE_DEPLOYED_SHA;
  assert.equal((await route.GET()).status, 503);
  process.env.ACCEPTANCE_DEPLOYED_SHA =
    "78cd22bd706e7b11ae2750fcee4fa057f1a3d8d1";
  process.env.ACCEPTANCE_ENVIRONMENT_ID = "synthetic-acceptance-environment";
  process.env.ACCEPTANCE_SUPABASE_PROJECT_REF = "synthetic-project-ref";
  process.env.CANDIDATE_CV_UPLOAD_ENABLED = "true";
  process.env.CANDIDATE_PROFILE_CONFIRMATION_ENABLED = "true";
  delete process.env.CANDIDATE_REGISTRATION_ENABLED;
  delete process.env.CHAT_ENABLED;
  assert.equal((await (await route.GET()).json()).chatEnabled, false);
  process.env.CHAT_ENABLED = "true";
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.commitSha, process.env.ACCEPTANCE_DEPLOYED_SHA);
  assert.equal(body.schemaVersion, "acceptance-release-evidence-v3");
  assert.equal(body.externalTalentEnabled, false);
  assert.equal(body.externalProviderConfigured, false);
  assert.equal(body.candidateCvUploadEnabled, true);
  assert.equal(body.candidateProfileConfirmationEnabled, true);
  assert.equal(body.chatEnabled, true);
  assert.equal(body.candidateRegistrationEnabled, false);
  assert.equal(body.candidateRegistrationAppConfigured, false);
  assert.equal(body.classification, "acceptance");
  assert.match(body.environmentHash, /^[a-f0-9]{16}$/);
  assert.match(body.projectRefHash, /^[a-f0-9]{16}$/);
  process.env.CANDIDATE_REGISTRATION_ENABLED = "true";
  process.env.CANDIDATE_REGISTRATION_ORIGIN = "https://acceptance.example.test";
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "synthetic_site_key";
  process.env.CANDIDATE_REGISTRATION_SUPABASE_PROJECT_REF =
    "abcdefghijklmnopqrst";
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    "https://abcdefghijklmnopqrst.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-public-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-key";
  const configured = await (await route.GET()).json();
  assert.equal(configured.candidateRegistrationEnabled, true);
  assert.equal(configured.candidateRegistrationAppConfigured, true);
  for (const [key, value] of Object.entries(previous)) {
    const envKey =
      key === "chat"
        ? "CHAT_ENABLED"
        : key === "mode"
          ? "ACCEPTANCE_TEST_MODE"
          : key === "environment"
            ? "APP_ENV"
            : key === "sha"
              ? "ACCEPTANCE_DEPLOYED_SHA"
              : key === "id"
                ? "ACCEPTANCE_ENVIRONMENT_ID"
                : key === "project"
                  ? "ACCEPTANCE_SUPABASE_PROJECT_REF"
                  : key === "candidateUpload"
                    ? "CANDIDATE_CV_UPLOAD_ENABLED"
                    : key === "candidateConfirmation"
                      ? "CANDIDATE_PROFILE_CONFIRMATION_ENABLED"
                      : key === "registration"
                        ? "CANDIDATE_REGISTRATION_ENABLED"
                        : key === "registrationOrigin"
                          ? "CANDIDATE_REGISTRATION_ORIGIN"
                          : key === "registrationProject"
                            ? "CANDIDATE_REGISTRATION_SUPABASE_PROJECT_REF"
                            : key === "turnstile"
                              ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
                              : key === "publicUrl"
                                ? "NEXT_PUBLIC_SUPABASE_URL"
                                : key === "anonKey"
                                  ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
                                  : "SUPABASE_SERVICE_ROLE_KEY";
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
  }
  console.log("Authenticated acceptance release identity route tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
