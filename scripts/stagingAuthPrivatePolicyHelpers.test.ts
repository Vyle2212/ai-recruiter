import assert from "node:assert/strict";
import fs from "node:fs";

const patchPath =
  "supabase/manual/202609270000_staging_auth_private_policy_helpers.sql";
const readbackPath =
  "supabase/manual/202609270001_staging_auth_private_policy_helpers_readback.sql";
const patch = fs.readFileSync(patchPath, "utf8");
const readback = fs.readFileSync(readbackPath, "utf8");
const patchCode = patch
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const helperNames = [
  "current_user_profile_id",
  "current_user_role",
  "current_user_organization_id",
  "current_user_client_id",
  "current_user_candidate_id",
  "current_user_is_admin",
];

assert.match(patch, /^begin;/m);
assert.match(patch, /pg_advisory_xact_lock\(731942609270000\)/);
assert.match(patch, /v_helper_policies <> 31/);
assert.match(patch, /to_regnamespace\('private'\) is not null/);
assert.match(patch, /create schema private;/);
assert.match(patch, /revoke all on schema private from public;/);
assert.match(patch, /grant usage on schema private to authenticated;/);
assert.match(
  patch,
  /alter default privileges for role postgres in schema private\s+revoke execute on functions from public, anon, authenticated, service_role;/,
);

for (const helper of helperNames) {
  assert.match(
    patch,
    new RegExp(
      `create function private\\.${helper}\\(\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = pg_catalog`,
    ),
  );
  assert.match(
    patch,
    new RegExp(`alter function public\\.${helper}\\(\\) security invoker;`),
  );
  assert.match(
    patch,
    new RegExp(
      `revoke all on function public\\.${helper}\\(\\) from public, anon, authenticated, service_role;`,
    ),
  );
}

assert.equal((patch.match(/^alter policy /gm) || []).length, 31);
assert.match(patch, /do \$postcondition\$/);
assert.match(
  patch,
  /staging_private_helpers_default_privilege_postcondition_failed/,
);
assert.ok(
  patch.indexOf("do $postcondition$") < patch.lastIndexOf("commit;"),
  "postconditions must pass before the migration commits",
);
assert.match(
  patch,
  /alter policy candidate_security_fixture_candidate_reads_own_record/,
);
assert.match(
  patch,
  /create or replace function public\.guard_user_profile_protected_columns\(\)[\s\S]*private\.current_user_profile_id\(\)[\s\S]*private\.current_user_is_admin\(\)/,
);
assert.doesNotMatch(
  patchCode,
  /\b(?:insert\s+into|update|delete\s+from|truncate)\b/i,
);
assert.doesNotMatch(patchCode, /\b(?:production|prod)\./i);

assert.match(readback, /set transaction read only;/);
assert.match(readback, /v_private_helpers <> 6/);
assert.match(
  readback,
  /aclexplode\(coalesce\(n\.nspacl, acldefault\('n', n\.nspowner\)\)\)/,
);
assert.doesNotMatch(readback, /has_schema_privilege\('public'/);
assert.match(
  readback,
  /v_public_definers <> 0 or v_public_authenticated_execute <> 0/,
);
assert.match(readback, /v_private_policy_refs <> 31/);
assert.match(readback, /v_private_using_refs <> 26/);
assert.match(readback, /v_private_check_refs <> 14/);
assert.match(
  readback,
  /staging_private_helpers_default_privilege_readback_failed/,
);
assert.match(
  readback,
  /pg_get_functiondef\('public\.guard_user_profile_protected_columns\(\)'::regprocedure\)/,
);
assert.match(readback, /rollback;/);
assert.doesNotMatch(
  readback,
  /^\s*(create|alter|drop|truncate|insert|update|delete|grant|revoke)\b/im,
);

console.log("stagingAuthPrivatePolicyHelpers.test.ts passed");
