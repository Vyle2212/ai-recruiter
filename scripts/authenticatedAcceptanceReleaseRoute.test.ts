import assert from "node:assert/strict";

async function main() {
  const previous = {
    mode: process.env.ACCEPTANCE_TEST_MODE,
    environment: process.env.APP_ENV,
    sha: process.env.ACCEPTANCE_DEPLOYED_SHA,
    id: process.env.ACCEPTANCE_ENVIRONMENT_ID,
    project: process.env.ACCEPTANCE_SUPABASE_PROJECT_REF,
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
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.commitSha, process.env.ACCEPTANCE_DEPLOYED_SHA);
  assert.equal(body.schemaVersion, "acceptance-release-evidence-v2");
  assert.equal(body.classification, "acceptance");
  assert.match(body.environmentHash, /^[a-f0-9]{16}$/);
  assert.match(body.projectRefHash, /^[a-f0-9]{16}$/);
  for (const [key, value] of Object.entries(previous)) {
    const envKey =
      key === "mode"
        ? "ACCEPTANCE_TEST_MODE"
        : key === "environment"
          ? "APP_ENV"
          : key === "sha"
            ? "ACCEPTANCE_DEPLOYED_SHA"
            : key === "id"
              ? "ACCEPTANCE_ENVIRONMENT_ID"
              : "ACCEPTANCE_SUPABASE_PROJECT_REF";
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
  }
  console.log("Authenticated acceptance release identity route tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
