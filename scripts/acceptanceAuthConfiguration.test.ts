import assert from "node:assert/strict";
import { acceptanceAuthConfigured } from "../lib/acceptanceAuthConfiguration";
import { proxy } from "../proxy";
import { NextRequest } from "next/server";

const ref = "abcdefghijklmnopqrst";
const valid = {
  APP_ENV: "acceptance",
  ACCEPTANCE_TEST_MODE: "true",
  ACCEPTANCE_AUTH_ENABLED: "true",
  ACCEPTANCE_ENVIRONMENT_ID: "isolated-test",
  ACCEPTANCE_SUPABASE_PROJECT_REF: ref,
  ACCEPTANCE_SUPABASE_PROJECT_REF_ALLOWLIST: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only",
};
async function main() {
  assert.equal(acceptanceAuthConfigured(valid), true);
  for (const key of Object.keys(valid))
    assert.equal(
      acceptanceAuthConfigured({ ...valid, [key]: undefined }),
      false,
      key,
    );
  for (const APP_ENV of ["production", "staging", "test"])
    assert.equal(acceptanceAuthConfigured({ ...valid, APP_ENV }), false);
  for (const blocked of ["hcohaxcojpudauftbntx", "grppxoecxmltiqxelukf"]) {
    assert.equal(
      acceptanceAuthConfigured({
        ...valid,
        ACCEPTANCE_SUPABASE_PROJECT_REF: blocked,
        ACCEPTANCE_SUPABASE_PROJECT_REF_ALLOWLIST: blocked,
        NEXT_PUBLIC_SUPABASE_URL: `https://${blocked}.supabase.co`,
      }),
      false,
    );
  }
  assert.equal(
    acceptanceAuthConfigured({
      ...valid,
      ACCEPTANCE_PRODUCTION_PROJECT_REF_DENYLIST: ref,
    }),
    false,
  );
  assert.equal(
    acceptanceAuthConfigured({ ...valid, PRODUCTION_AUTH_ENABLED: "true" }),
    false,
  );
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "CANDIDATE_SUPABASE_URL",
  ]) {
    assert.equal(
      acceptanceAuthConfigured({
        ...valid,
        [key]: "https://other.supabase.co",
      }),
      false,
    );
  }
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "acceptance";
  try {
    for (const route of [
      "/recruiter/talent-search/v2",
      "/admin",
      "/client",
      "/candidate",
      "/api/recruiter/search",
    ]) {
      const result = await proxy(
        new NextRequest(`https://example.test${route}`),
      );
      assert.equal(result.status, 503, route);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
    }
  } finally {
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
  }
  const saved = { ...process.env };
  Object.assign(process.env, valid);
  try {
    for (const route of [
      "/recruiter/talent-search/v2",
      "/admin",
      "/client",
      "/candidate",
    ]) {
      const result = await proxy(
        new NextRequest(`https://example.test${route}`),
      );
      assert.equal(result.status, 307);
      assert.equal(
        new URL(result.headers.get("location")!).pathname,
        "/auth/login",
      );
    }
  } finally {
    for (const key of Object.keys(valid)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  console.log(
    "Acceptance configuration and fail-closed portal/API checks passed",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
