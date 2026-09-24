import assert from "node:assert/strict";
import fs from "node:fs";

const foundation = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240011_production_auth_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const bootstrap = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240012_production_initial_owner_bootstrap.sql",
    import.meta.url,
  ),
  "utf8",
);
const readback = fs.readFileSync(
  new URL(
    "../supabase/manual/202609240013_production_auth_foundation_readback.sql",
    import.meta.url,
  ),
  "utf8",
);

assert.match(foundation, /MANUAL, REVIEWED-RUN ONLY/);
assert.match(foundation, /to_regclass\('public\.candidates'\)/);
assert.match(foundation, /status = 'pending_claim' and candidate_id is null/);
assert.match(
  foundation,
  /status in \('active','inactive','suspended','disabled'\) and candidate_id is not null/,
);
assert.match(
  foundation,
  /Null only while a verified candidate is pending_claim/,
);
assert.match(foundation, /unique \(auth_user_id\)/);
assert.match(foundation, /unique \(user_profile_id\)/);
assert.match(foundation, /unique \(candidate_id\)/);
assert.match(foundation, /enable row level security/gi);
assert.match(foundation, /force row level security/gi);
assert.match(
  foundation,
  /revoke all on schema private from public, anon, authenticated/,
);
assert.match(
  foundation,
  /revoke all on table public\.organizations, public\.user_profiles, public\.candidate_accounts\s+from public, anon, authenticated/,
);
assert.match(
  foundation,
  /grant select on table public\.user_profiles to authenticated/,
);
assert.doesNotMatch(
  foundation,
  /grant\s+(?:insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i,
);
assert.match(foundation, /\(select auth\.uid\(\)\) = auth_user_id/);
assert.equal(
  (foundation.match(/create policy/gi) || []).length,
  1,
  "only self-profile SELECT may be exposed to authenticated users",
);

assert.match(bootstrap, /__PRODUCTION_BOOTSTRAP_CONFIG_B64__/);
assert.match(bootstrap, /project_ref/);
assert.match(bootstrap, /u\.email_confirmed_at is not null/);
assert.match(bootstrap, /v_verified_email <> v_admin_email/);
assert.match(bootstrap, /role,status,organization_id,client_id,candidate_id/);
assert.match(bootstrap, /'admin','active'/);
assert.doesNotMatch(
  bootstrap,
  /\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/i,
);
assert.doesNotMatch(bootstrap, /service_role|password\s*=|https?:\/\//i);

assert.match(readback, /repeatable read read only/);
assert.match(readback, /relrowsecurity and c\.relforcerowsecurity/);
assert.match(readback, /has_table_privilege\('anon'/);
assert.match(
  readback,
  /has_schema_privilege\('authenticated','private','usage'\)/,
);
assert.match(readback, /u\.email_confirmed_at is not null/);
assert.match(readback, /candidate_ownership_mismatch/);
assert.match(readback, /claim_exposed_before_acceptance/);
assert.doesNotMatch(
  readback,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);

console.log("productionAuthFoundation.test.ts passed");
