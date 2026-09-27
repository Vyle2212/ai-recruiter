import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patch = readFileSync(
  "supabase/manual/202609270002_acceptance_auth_private_policy_helpers.sql",
  "utf8",
);
const readback = readFileSync(
  "supabase/manual/202609270003_acceptance_auth_private_policy_helpers_readback.sql",
  "utf8",
);

assert.match(patch, /^-- ACCEPTANCE ONLY/m);
assert.match(patch, /v_helper_policies <> 30/);
assert.equal((patch.match(/^alter policy /gm) || []).length, 30);
assert.doesNotMatch(patch, /candidate_security_fixture/);
assert.match(patch, /v_private_policy_refs <> 30/);
assert.match(patch, /v_private_using_refs <> 25/);
assert.match(patch, /v_private_check_refs <> 14/);
assert.match(patch, /alter default privileges for role postgres\s+revoke execute on functions from public;/);
assert.match(patch, /v_global_public_default_execute <> 0/);
assert.match(patch, /acceptance_rls_event_trigger_contract_changed/);
assert.match(patch, /revoke all on function public\.rls_auto_enable\(\)/);
assert.ok(patch.indexOf("do $postcondition$") < patch.lastIndexOf("commit;"));

for (const name of [
  "profile_id", "role", "organization_id", "client_id", "candidate_id", "is_admin",
]) {
  assert.match(patch, new RegExp(`create function private\\.current_user_${name}\\(\\)`));
  assert.match(patch, new RegExp(`revoke all on function public\\.current_user_${name}\\(\\)`));
}
assert.match(readback, /set transaction read only;/);
assert.match(readback, /v_private_policy_refs <> 30/);
assert.match(readback, /v_private_using_refs <> 25/);
assert.match(readback, /v_private_check_refs <> 14/);
assert.match(readback, /v_global_public_default_execute <> 0/);
assert.match(readback, /acceptance_rls_event_trigger_readback_failed/);
assert.match(readback, /rollback;/);
assert.doesNotMatch(readback, /^\s*(create|alter|drop|grant|revoke|insert|update|delete)\b/im);

console.log("acceptanceAuthPrivatePolicyHelpers.test.ts passed");
