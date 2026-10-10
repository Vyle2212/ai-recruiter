import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "supabase/acceptance/007_acceptance_candidate_registration_provision.sql",
  "utf8",
);

assert.match(sql, /^-- MANUAL REVIEW ONLY\./);
assert.match(sql, /project_ref = 'iujucosewivndjpcjbuz'/);
assert.match(sql, /classification = 'acceptance' and acceptance_enabled/);
assert.match(
  sql,
  /has_table_privilege\('service_role', 'auth\.users', 'SELECT'\)/,
);
assert.match(sql, /identity_sync_changed/);
assert.match(sql, /already_installed/);
assert.match(sql, /security invoker/gi);
assert.doesNotMatch(sql, /security definer/i);
assert.doesNotMatch(sql, /raw_user_meta_data/i);
assert.doesNotMatch(sql, /grant\s+select[^;]+auth\.users/i);

assert.match(sql, /add column normalized_email text;/);
assert.match(sql, /after insert or update of email, email_confirmed_at/);
assert.match(sql, /identity_row\.email_verified/);
assert.match(sql, /identity_row\.normalized_email = v_normalized_email/);
assert.match(sql, /current_user <> 'service_role'/);

const profileCollision = sql.indexOf(
  "where lower(btrim(profile.email)) = v_normalized_email",
);
const candidateCollision = sql.indexOf("if candidate_match_count > 0 then");
const candidateInsert = sql.indexOf("insert into public.candidates");
assert.ok(profileCollision > 0 && profileCollision < candidateInsert);
assert.ok(
  candidateCollision > profileCollision && candidateCollision < candidateInsert,
);
assert.match(sql, /'not_claimed'/);
assert.doesNotMatch(sql, /candidate_self_registration|claimed_incomplete/);
assert.match(sql, /candidate_registration_readback_failed/);
assert.match(sql, /when unique_violation then[\s\S]+retry_required/);

assert.match(
  sql,
  /revoke all on function public\.provision_verified_candidate_registration\(uuid,text,text\)[\s\S]+from public, anon, authenticated;/,
);
assert.match(
  sql,
  /grant execute on function public\.provision_verified_candidate_registration\(uuid,text,text\)[\s\S]+to service_role;/,
);

console.log(
  "Candidate registration provisioning contract PASS (review-only SQL, no DB writes)",
);
