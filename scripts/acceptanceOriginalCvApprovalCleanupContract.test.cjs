const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync(
  "supabase/acceptance/004_acceptance_original_cv_approval_cleanup.sql",
  "utf8",
);
assert.match(sql, /project_ref = 'iujucosewivndjpcjbuz'/);
assert.match(sql, /classification = 'acceptance' and acceptance_enabled/);
assert.match(sql, /security invoker/g);
assert.doesNotMatch(sql, /security definer/i);
assert.match(sql, /tg_op = 'DELETE'/);
assert.match(sql, /fixture\.candidate_id = p_candidate_id and fixture\.active/);
assert.match(
  sql,
  /profile\.role = 'client' and profile\.client_id = p_client_id/,
);
assert.match(sql, /for update/);
assert.match(
  sql,
  /acceptance_original_cv_approval_cleanup_access_audit_present/,
);
assert.match(sql, /delete from public\.recruiter_original_cv_requests/);
assert.match(sql, /delete from public\.recruiter_original_cv_grant_events/);
assert.match(sql, /delete from public\.recruiter_original_cv_grants/);
assert.ok(
  sql.indexOf("delete from public.recruiter_original_cv_grant_events") <
    sql.indexOf("delete from public.recruiter_original_cv_grants"),
  "immutable events must be removed before their restricted parent grant",
);
for (const reason of [
  "run_invalid",
  "run_not_active",
  "fixture_scope_missing",
  "external_reference_detected",
  "residue_detected",
]) {
  assert.ok(sql.includes(`acceptance_original_cv_approval_cleanup_${reason}`));
}
assert.match(
  sql,
  /grant delete on public\.recruiter_original_cv_requests,[\s\S]*to service_role/,
);
assert.doesNotMatch(sql, /delete from public\.(candidates|user_profiles)/);
console.log(
  "Acceptance original CV approval cleanup scope and immutable boundary contracts passed.",
);
