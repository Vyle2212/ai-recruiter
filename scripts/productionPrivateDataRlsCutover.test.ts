import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const snapshot = fs.readFileSync(
  path.join(
    root,
    "supabase/manual/202609230000_production_private_data_rls_snapshot.sql",
  ),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/manual/202609230001_production_private_data_rls_cutover.sql",
  ),
  "utf8",
);
const readback = fs.readFileSync(
  path.join(
    root,
    "supabase/manual/202609230002_production_private_data_rls_readback.sql",
  ),
  "utf8",
);
const serverClient = fs.readFileSync(
  path.join(root, "lib/supabase.ts"),
  "utf8",
);
const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");

for (const evidenceField of [
  "pg_policies",
  "relrowsecurity",
  "relforcerowsecurity",
  "relacl",
  "proacl",
  "proconfig",
  "prosecdef",
  "jsonb_build_object",
]) {
  assert.match(snapshot, new RegExp(evidenceField, "i"));
}
assert.match(snapshot, /production_private_data_authorization_snapshot_v1/);
assert.match(snapshot, /captured_at/);
assert.match(snapshot, /effective_privileges/);
assert.match(snapshot, /not a data backup/i);
assert.match(
  snapshot,
  /begin transaction isolation level repeatable read read only/i,
);
assert.match(snapshot, /commit;/i);
assert.doesNotMatch(
  snapshot,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);
assert.match(
  migration,
  /202609230000_production_private_data_rls_snapshot\.sql/i,
);
assert.match(migration, /not a substitute for the data backup/i);

const targetTables = [
  "jobs",
  "candidates",
  "saved_matches",
  "saved_candidates",
  "recruiter_notes",
  "shortlisted",
  "candidate_emails",
  "emails",
  "matches",
  "rejected",
  "interviewed",
  "hired",
  "candidates_backup",
  "talent_pools",
  "talent_pool_candidates",
  "shortlists",
  "shortlist_candidates",
  "consulting_firms_backup",
  "sap_module_aliases",
  "consulting_aliases",
  "taxonomy_review_queue",
  "candidate_search_index",
  "salary_market_snapshot",
  "sap_modules",
  "consulting_firms",
] as const;
const targetViews = [
  "candidate_audit_view",
  "candidate_quality_audit",
] as const;
const targetRpcs = [
  "match_candidates",
  "match_job_candidates",
  "sap_detect_modules_from_text",
  "search_candidate_index",
  "search_candidate_index_v2",
  "search_candidate_index_vector",
  "apply_reviewed_employment_promotion_batch",
] as const;

for (const table of targetTables) {
  assert.match(snapshot, new RegExp(`'${table}'`));
  assert.match(migration, new RegExp(`'${table}'`));
  assert.match(readback, new RegExp(`'${table}'`));
}
assert.match(migration, /enable row level security/i);
assert.match(migration, /force row level security/i);
assert.match(
  migration,
  /revoke all on table public\.%I from public, anon, authenticated/i,
);
assert.doesNotMatch(migration, /grant\s+[^;]*\b(?:anon|authenticated)\b/i);
assert.match(
  migration,
  /grant select, insert, update, delete[^;]*service_role/i,
);
for (const view of targetViews) {
  assert.match(snapshot, new RegExp(`'${view}'`));
  assert.match(readback, new RegExp(`'${view}'`));
  assert.match(
    migration,
    new RegExp(
      `alter view public\\.${view} set \\(security_invoker = true\\)`,
      "i",
    ),
  );
  assert.match(
    migration,
    new RegExp(
      `revoke all on table public\\.${view} from public, anon, authenticated`,
      "i",
    ),
  );
  assert.match(
    migration,
    new RegExp(`grant select on table public\\.${view} to service_role`, "i"),
  );
}
for (const rpc of targetRpcs) {
  assert.match(snapshot, new RegExp(`public\\.${rpc}\\(`, "i"));
  assert.match(readback, new RegExp(`public\\.${rpc}\\(`, "i"));
  assert.match(migration, new RegExp(`alter function public\\.${rpc}\\(`, "i"));
  assert.match(
    migration,
    new RegExp(
      `revoke all on function public\\.${rpc}\\([^;]+from public, anon, authenticated`,
      "i",
    ),
  );
  assert.match(
    migration,
    new RegExp(
      `grant execute on function public\\.${rpc}\\([^;]+to service_role`,
      "i",
    ),
  );
}
assert.equal(
  (migration.match(/set search_path = pg_catalog, public/gi) || []).length,
  7,
);
assert.match(readback, /private_database_surface_readback_passed/);
assert.doesNotMatch(
  readback,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);
assert.match(serverClient, /import "server-only"/);
assert.match(serverClient, /createLazySupabaseServiceClient/);
assert.doesNotMatch(serverClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(proxy, /recruiterApiPolicyForRequest/);
assert.match(proxy, /"\/api\/:path\*"/);

console.log("Production private-data RLS cutover regression passed.");
