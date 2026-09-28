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
assert.match(sql, /chat_conversation_scope_immutable/);
assert.match(sql, /from public, anon, authenticated/);
assert.doesNotMatch(sql, /grant .* to (?:anon|authenticated)/i);
assert.doesNotMatch(sql, /security definer/i);
assert.doesNotMatch(sql, /alter publication|supabase_realtime/i);

console.log("Chat conversation store contract passed.");
