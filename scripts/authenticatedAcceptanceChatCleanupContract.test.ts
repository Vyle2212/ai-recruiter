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
  /not \(participant\.user_profile_id = any\(v_profile_ids\)\)/,
);
assert.match(
  cleanupSql,
  /fixture\.owner_run_id = p_run_id[\s\S]*fixture\.active = true/,
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
