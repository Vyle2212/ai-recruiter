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
  const { POST } = await import("../app/api/chat/recruiter-candidate-conversations/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  try {
    assert.equal((await POST(new Request("http://localhost/api/chat/recruiter-candidate-conversations", {
      method: "POST", body: "invalid",
    }))).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }
  const route = fs.readFileSync("app/api/chat/recruiter-candidate-conversations/route.ts", "utf8");
  const auth = fs.readFileSync("lib/chatRecruiterCandidateAuthorization.ts", "utf8");
  const dispatch = fs.readFileSync("lib/chatRequestAuthorization.ts", "utf8");
  const sql = fs.readFileSync("supabase/manual/202609280002_chat_conversation_store.sql", "utf8");
  assert.match(route, /auth\.auth\.getUser\(\)/);
  assert.match(route, /same_origin_required/);
  assert.match(route, /create_recruiter_candidate_chat_conversation/);
  assert.match(auth, /candidate_chat_contact_consents/);
  assert.match(auth, /getUserById\(candidate\.auth_user_id\)/);
  assert.match(auth, /client_candidate_shares/);
  assert.match(auth, /client_recruiter_assignments/);
  assert.match(auth, /client_candidate_access/);
  assert.match(auth, /\.eq\("feature", "recruiter_support"\)/);
  assert.match(dispatch, /authorizeRecruiterCandidateMessage\(conversationId\)/);
  assert.match(sql, /create function public\.create_recruiter_candidate_chat_conversation\([\s\S]*security invoker/);
  assert.match(sql, /Recruiter candidate chat permission changed/);
  assert.match(sql, /candidate_auth\.email_confirmed_at is not null/);
  assert.match(sql, /grant execute on function public\.create_recruiter_candidate_chat_conversation\(uuid, uuid, uuid\)[\s\S]*to service_role/);
  console.log("Recruiter candidate chat boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
