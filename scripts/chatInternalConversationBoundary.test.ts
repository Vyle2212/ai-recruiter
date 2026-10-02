import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";

const loader = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const original = loader._load;
loader._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return original.call(this, request, parent, isMain);
};

async function main() {
  const { POST } = await import("../app/api/chat/internal-conversations/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  try {
    assert.equal((await POST(new Request("http://localhost/api/chat/internal-conversations", {
      method: "POST", body: "invalid",
    }))).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }
  const api = fs.readFileSync("app/api/chat/internal-conversations/route.ts", "utf8");
  const dispatch = fs.readFileSync("lib/chatRequestAuthorization.ts", "utf8");
  const auth = fs.readFileSync("lib/chatInternalAuthorization.ts", "utf8");
  const sql = fs.readFileSync("supabase/manual/202609280002_chat_conversation_store.sql", "utf8");
  assert.match(api, /auth\.auth\.getUser\(\)/);
  assert.match(api, /organization_type.*internal/);
  assert.match(api, /create_recruiter_admin_chat_conversation/);
  assert.match(api, /same_origin_required/);
  assert.match(dispatch, /authorizeRecruiterAdminMessage\(conversationId\)/);
  assert.match(auth, /auth\.auth\.getUser\(\)/);
  assert.match(auth, /members\.length !== 2/);
  assert.match(auth, /orgResult\.data\.status !== "active"/);
  assert.match(sql, /create function public\.create_recruiter_admin_chat_conversation\([\s\S]*security invoker/);
  assert.match(sql, /create function public\.enforce_chat_message_active_scope\([\s\S]*Recruiter admin chat permission changed/);
  assert.match(sql, /org\.organization_type = 'internal' and org\.status = 'active'[\s\S]*recruiter_participant\.role_snapshot = recruiter\.role/);
  assert.match(sql, /admin_participant\.role_snapshot = 'admin'[\s\S]*count\(\*\) from public\.chat_conversation_participants participant/);
  console.log("Internal chat boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
