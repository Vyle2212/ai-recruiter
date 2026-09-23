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
const serverClient = fs.readFileSync(
  path.join(root, "lib/supabase.ts"),
  "utf8",
);
const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");

for (const table of [
  "candidates",
  "candidate_search_index",
  "candidates_backup",
  "candidate_emails",
  "emails",
  "recruiter_notes",
]) {
  assert.match(migration, new RegExp(`'${table}'`));
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
assert.match(serverClient, /import "server-only"/);
assert.match(serverClient, /createLazySupabaseServiceClient/);
assert.doesNotMatch(serverClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(proxy, /recruiterApiPolicyForRequest/);
assert.match(proxy, /"\/api\/:path\*"/);

console.log("Production private-data RLS cutover regression passed.");
