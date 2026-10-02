import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "supabase/manual/202609280002_chat_conversation_store.sql",
  "utf8",
);

for (const table of [
  "chat_conversations",
  "chat_conversation_participants",
  "chat_messages",
  "chat_message_events",
  "chat_message_receipts",
  "chat_message_receipt_events",
]) {
  assert.match(sql, new RegExp(`create table public\\.${table}`));
  assert.match(
    sql,
    new RegExp(`alter table public\\.${table} enable row level security`),
  );
  assert.match(
    sql,
    new RegExp(`alter table public\\.${table} force row level security`),
  );
}
for (const kind of [
  "client_candidate",
  "recruiter_candidate",
  "client_recruiter",
  "recruiter_admin",
])
  assert.match(sql, new RegExp(`'${kind}'`));

assert.match(sql, /foreign key \(conversation_id, sender_profile_id\)/);
assert.match(sql, /foreign key \(message_id, conversation_id\)/);
assert.match(sql, /references public\.chat_messages\(id, conversation_id\)/);
assert.match(sql, /unique \(conversation_id, sender_profile_id, client_message_id\)/);
assert.match(sql, /char_length\(body\) <= 8000/);
assert.match(
  sql,
  /create function public\.enforce_chat_message_active_scope\(\)[\s\S]*c\.status = 'active'[\s\S]*p\.status = 'active'/,
);
assert.match(
  sql,
  /before insert on public\.chat_messages[\s\S]*enforce_chat_message_active_scope/,
);
assert.match(sql, /chat_messages_immutable/);
assert.match(sql, /chat_message_events_immutable/);
assert.match(sql, /chat_receipt_events_immutable/);
assert.match(sql, /chat_receipt_read_audit/);
assert.match(sql, /insert into public\.chat_message_receipts[\s\S]*p\.user_profile_id <> new\.sender_profile_id/);
assert.match(sql, /foreign key \(message_id, conversation_id, user_profile_id\)/);
assert.match(sql, /chat_conversation_scope_immutable/);
assert.match(sql, /create unique index chat_client_candidate_active_without_job_key/);
assert.match(sql, /create unique index chat_client_candidate_active_with_job_key/);
assert.match(
  sql,
  /create function public\.create_client_candidate_chat_conversation\([\s\S]*security invoker[\s\S]*set search_path = ''/,
);
for (const requirement of [
  "client_memberships",
  "client_feature_entitlements",
  "client_candidate_access",
  "client_job_ownership",
  "candidate_accounts",
  "candidate_chat_contact_consents",
  "auth.users",
]) assert.match(sql, new RegExp(requirement.replace(".", "\\.")));
assert.doesNotMatch(sql, /entitlement\.feature = 'candidate_chat'/);
assert.match(sql, /auth_user\.email_confirmed_at is not null/);
assert.match(sql, /candidate_auth\.email_confirmed_at is not null/);
assert.match(sql, /membership\.organization_id = c\.organization_id/);
assert.match(sql, /client_participant\.role_snapshot = 'client'/);
assert.match(sql, /candidate_participant\.role_snapshot = 'candidate'/);
assert.match(sql, /on conflict do nothing/);
assert.match(
  sql,
  /insert into public\.chat_conversations[\s\S]*insert into public\.chat_conversation_participants/,
  "conversation and both participants must be inserted in the same RPC transaction",
);
assert.match(
  sql,
  /raise exception using errcode = 'P0001', message = 'chat_conversation_inconsistent'/,
  "an existing partial conversation must fail closed instead of being repaired implicitly",
);
assert.match(
  sql,
  /grant execute on function public\.create_client_candidate_chat_conversation\(uuid, uuid, uuid\)[\s\S]*to service_role/,
);
assert.match(sql, /unique index chat_recruiter_admin_active_pair_key/);
assert.match(sql, /unique index chat_recruiter_candidate_active_client_key/);
assert.match(sql, /create function public\.create_recruiter_candidate_chat_conversation\(/);
assert.match(sql, /grant execute on function public\.create_recruiter_candidate_chat_conversation\(uuid, uuid, uuid\)[\s\S]*to service_role/);
assert.match(sql, /unique index chat_client_recruiter_active_without_job_key/);
assert.match(sql, /unique index chat_client_recruiter_active_with_job_key/);
assert.match(sql, /create function public\.create_client_recruiter_chat_conversation\(/);
assert.match(sql, /grant execute on function public\.create_client_recruiter_chat_conversation\(uuid, uuid, uuid\)[\s\S]*to service_role/);
assert.match(sql, /create function public\.create_recruiter_admin_chat_conversation\(/);
assert.match(sql, /grant execute on function public\.create_recruiter_admin_chat_conversation\(uuid, uuid\)[\s\S]*to service_role/);
assert.match(sql, /from public, anon, authenticated/);
assert.doesNotMatch(sql, /grant .* to (?:anon|authenticated)/i);
assert.doesNotMatch(sql, /security definer/i);
assert.doesNotMatch(sql, /alter publication|supabase_realtime/i);

console.log("Chat conversation store contract passed.");
