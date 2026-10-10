const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync('supabase/acceptance/003_acceptance_original_cv_cleanup.sql','utf8');
assert.match(sql, /project_ref = 'iujucosewivndjpcjbuz'/);
assert.match(sql, /classification = 'acceptance' and acceptance_enabled/);
assert.match(sql, /security invoker/g);
assert.doesNotMatch(sql, /security definer/i);
assert.match(sql, /tg_op = 'DELETE'/);
assert.match(sql, /fixture\.candidate_id = p_candidate_id and fixture\.active/);
assert.match(sql, /entity\.entity_type = 'user_profile' and entity\.entity_id = p_actor_id::text/);
assert.match(sql, /fixture\.environment_id = marker\.environment_id/);
assert.match(sql, /fixture\.project_ref = marker\.project_ref/);
assert.match(sql, /from public, anon, authenticated/g);
assert.match(sql, /for update/);
for (const reason of ['run_invalid','run_not_active','fixture_scope_missing','external_reference_detected','residue_detected']) {
  assert.ok(sql.includes('acceptance_original_cv_cleanup_'+reason));
}
assert.ok(sql.indexOf("raise exception 'acceptance_original_cv_cleanup_external_reference_detected'") < sql.indexOf('delete from public.recruiter_original_cv_access_events'));
assert.match(sql, /audit\.candidate_id in/);
assert.doesNotMatch(sql, /delete from public\.(candidates|user_profiles|recruiter_original_cv_grants|recruiter_original_cv_requests)/);
console.log('Acceptance original CV cleanup scope and immutable boundary contracts passed.');
