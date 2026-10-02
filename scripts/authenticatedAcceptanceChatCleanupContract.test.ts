import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const cleanupSql = readFileSync(
  path.join(root, "supabase/acceptance/002_acceptance_chat_cleanup.sql"),
  "utf8",
);
const provision = readFileSync(
  path.join(root, "scripts/authenticatedAcceptanceProvision.ts"),
  "utf8",
);

assert.match(cleanupSql, /classification = 'acceptance'/);
assert.match(cleanupSql, /acceptance_enabled = true/);
assert.match(
  cleanupSql,
  /drop function if exists private\.acceptance_chat_cleanup_allowed\(\);/,
);
assert.match(
  cleanupSql,
  /revoke all on function private\.acceptance_chat_cleanup_allowed\(uuid, uuid, uuid\)\s+from public, anon, authenticated;/,
);
assert.match(
  cleanupSql,
  /harness_version =\s*'production-trust-authenticated-acceptance-v2'/,
);
assert.match(
  cleanupSql,
  /revoke all on function public\.cleanup_acceptance_chat_run\(text\)\s+from public, anon, authenticated;/,
);
assert.match(
  cleanupSql,
  /grant execute on function public\.cleanup_acceptance_chat_run\(text\)\s+to service_role;/,
);
assert.match(
  cleanupSql,
  /conversation\.created_by_profile_id = any\(v_profile_ids\)/,
);
assert.match(
  cleanupSql,
  /conversation\.recipient_profile_id is null[\s\S]*conversation\.recipient_profile_id = any\(v_profile_ids\)/,
);
assert.match(
  cleanupSql,
  /not \(participant\.user_profile_id = any\(v_profile_ids\)\)/,
);
assert.match(
  cleanupSql,
  /fixture\.owner_run_id = p_run_id[\s\S]*fixture\.active = true/,
);
const residuePreflight = cleanupSql.indexOf(
  "acceptance_chat_cleanup_external_reference_detected",
);
const firstDelete = cleanupSql.indexOf(
  "delete from public.chat_message_receipt_events",
);
assert.ok(residuePreflight > 0 && residuePreflight < firstDelete);
for (const reference of [
  "conversation.recipient_profile_id = any(v_profile_ids)",
  "conversation.candidate_id = any(v_candidate_ids)",
  "participant.user_profile_id = any(v_profile_ids)",
  "message.sender_profile_id = any(v_profile_ids)",
  "event.actor_profile_id = any(v_profile_ids)",
]) {
  assert.ok(
    cleanupSql.includes(reference),
    `missing cleanup preflight: ${reference}`,
  );
}
for (const scopedTriggerCall of [
  /private\.acceptance_chat_cleanup_allowed\(\s*null, old\.user_profile_id, old\.candidate_id\s*\)/,
  /private\.acceptance_chat_cleanup_allowed\(\s*old\.conversation_id, null, null\s*\)/,
]) {
  assert.match(cleanupSql, scopedTriggerCall);
}
assert.doesNotMatch(
  cleanupSql,
  /if\s+tg_op = 'DELETE' and private\.acceptance_chat_cleanup_allowed\(\)/,
  "a session GUC alone must never unlock append-only row deletion",
);
assert.match(
  cleanupSql,
  /creator\.entity_id = conversation\.created_by_profile_id::text/,
);
assert.match(
  cleanupSql,
  /recipient\.entity_id = conversation\.recipient_profile_id::text/,
);
assert.match(
  cleanupSql,
  /member\.entity_id = participant\.user_profile_id::text/,
);
assert.match(
  cleanupSql,
  /delete from public\.chat_message_receipt_events[\s\S]*delete from public\.chat_message_receipts[\s\S]*delete from public\.chat_message_events[\s\S]*delete from public\.chat_messages[\s\S]*delete from public\.chat_conversation_participants[\s\S]*delete from public\.chat_conversations/,
);
assert.match(
  cleanupSql,
  /delete from public\.candidate_chat_contact_consent_events[\s\S]*delete from public\.candidate_chat_contact_consents/,
);

const cleanupCall = provision.indexOf('"cleanup_acceptance_chat_run"');
const accountCleanup = provision.indexOf(
  '.from("candidate_accounts")',
  cleanupCall,
);
const profileCleanup = provision.indexOf('.from("user_profiles")', cleanupCall);
assert.ok(cleanupCall >= 0, "provision cleanup must call the chat cleanup RPC");
assert.ok(
  accountCleanup > cleanupCall,
  "chat cleanup must run before candidate account cleanup",
);
assert.ok(
  profileCleanup > cleanupCall,
  "chat cleanup must run before profile cleanup",
);

console.log("Authenticated acceptance chat cleanup contract tests passed.");
