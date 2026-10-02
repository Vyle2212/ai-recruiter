import assert from "node:assert/strict";
import { productionAuthConfigured } from "../lib/productionAuthConfiguration";

const valid = {
  VERCEL_ENV: "production",
  APP_ENV: "production",
  PRODUCTION_AUTH_ENABLED: "true",
  PRODUCTION_PRIVATE_DATA_RLS_CONFIRMED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://hcohaxcojpudauftbntx.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
  SUPABASE_URL: "https://hcohaxcojpudauftbntx.supabase.co",
  CANDIDATE_SUPABASE_URL: "https://hcohaxcojpudauftbntx.supabase.co",
};

assert.equal(productionAuthConfigured(valid), true);
for (const key of [
  "VERCEL_ENV",
  "PRODUCTION_AUTH_ENABLED",
  "PRODUCTION_PRIVATE_DATA_RLS_CONFIRMED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  assert.equal(
    productionAuthConfigured({ ...valid, [key]: undefined }),
    false,
    key,
  );
}
for (const VERCEL_ENV of ["preview", "development"]) {
  assert.equal(productionAuthConfigured({ ...valid, VERCEL_ENV }), false);
}
for (const APP_ENV of ["acceptance", "staging", "test"]) {
  assert.equal(productionAuthConfigured({ ...valid, APP_ENV }), false);
}
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "CANDIDATE_SUPABASE_URL",
]) {
  assert.equal(
    productionAuthConfigured({
      ...valid,
      [key]: "https://grppxoecxmltiqxelukf.supabase.co",
    }),
    false,
    key,
  );
}
assert.equal(
  productionAuthConfigured({ ...valid, PRODUCTION_AUTH_ENABLED: "false" }),
  false,
);
console.log("Production Auth project and environment isolation passed");
