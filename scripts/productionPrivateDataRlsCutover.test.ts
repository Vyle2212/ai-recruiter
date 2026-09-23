import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
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

const protectedTables = [
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
];
for (const table of protectedTables) {
  assert.match(migration, new RegExp(`'${table}'`));
  assert.match(readback, new RegExp(`'${table}'`));
}
assert.equal(protectedTables.length, 25);
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
assert.match(readback, /not row_security or not force_row_security/i);
assert.match(readback, /select 1 from pg_policies/i);
assert.match(readback, /array\['anon', 'authenticated'\]/i);
assert.match(
  readback,
  /array\['SELECT', 'INSERT', 'UPDATE', 'DELETE'\]/,
);
assert.match(readback, /has_table_privilege\('service_role'/i);
assert.match(readback, /raise exception 'RLS readback failed:/i);

for (const view of ["candidate_audit_view", "candidate_quality_audit"]) {
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
  assert.match(readback, new RegExp(`'${view}'`));
}
assert.match(readback, /security_invoker=true/i);
assert.match(readback, /View readback failed:/);

for (const rpc of [
  "match_candidates",
  "match_job_candidates",
  "sap_detect_modules_from_text",
  "search_candidate_index",
  "search_candidate_index_v2",
  "search_candidate_index_vector",
]) {
  assert.match(
    migration,
    new RegExp(`alter function public\\.${rpc}\\(`, "i"),
  );
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
  assert.match(readback, new RegExp(`public\\.${rpc}\\(`, "i"));
}
assert.equal(
  (migration.match(/set search_path = pg_catalog, public/gi) || []).length,
  6,
);
assert.match(readback, /search_path=pg_catalog, public/i);
assert.match(readback, /has_function_privilege\('service_role'/i);
assert.match(readback, /function_security_definer/i);
assert.match(readback, /RPC readback failed:/);
assert.match(readback, /private_database_surface_readback_passed/);
assert.doesNotMatch(
  readback,
  /^\s*(?:alter|grant|revoke|drop|create|insert|update|delete)\b/im,
);

assert.match(serverClient, /import "server-only"/);
assert.match(serverClient, /createLazySupabaseServiceClient/);
assert.doesNotMatch(serverClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(proxy, /recruiterApiPolicyForRequest/);
assert.match(proxy, /"\/api\/:path\*"/);

console.log("Production private-data RLS cutover regression passed.");
