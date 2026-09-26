import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/202609180001_candidate_security_fixture_rls.sql"),
  "utf8",
);

assert.match(migration, /create table public\.candidate_security_fixture/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /force row level security/i);
assert.match(migration, /revoke all on table public\.candidate_security_fixture from public, anon, authenticated/i);
assert.match(migration, /grant select on table public\.candidate_security_fixture to authenticated/i);
assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete)\b[^;]*candidate_security_fixture[^;]*\bauthenticated/i);
assert.match(migration, /current_user_role\(\) = 'candidate'/i);
assert.match(migration, /id = public\.current_user_candidate_id\(\)/i);
assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
assert.doesNotMatch(migration, /insert into public\.candidate_security_fixture/i);

console.log("Candidate security fixture RLS migration: PASS");
