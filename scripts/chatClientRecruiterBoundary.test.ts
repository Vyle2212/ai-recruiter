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
  const { POST } = await import("../app/api/chat/client-recruiter-conversations/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  try {
    const request = new Request("http://localhost/api/chat/client-recruiter-conversations", {
      method: "POST", body: "invalid",
    });
    Object.defineProperty(request, "text", {
      value: () => { throw new Error("disabled chat must not read the body"); },
    });
    assert.equal((await POST(request)).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }
  const route = fs.readFileSync("app/api/chat/client-recruiter-conversations/route.ts", "utf8");
  const auth = fs.readFileSync("lib/chatClientRecruiterAuthorization.ts", "utf8");
  const dispatch = fs.readFileSync("lib/chatRequestAuthorization.ts", "utf8");
  const sql = fs.readFileSync("supabase/manual/202609280002_chat_conversation_store.sql", "utf8");
  assert.match(route, /auth\.auth\.getUser\(\)/);
  assert.match(route, /same_origin_required/);
  assert.match(route, /create_client_recruiter_chat_conversation/);
  assert.match(auth, /client_recruiter_assignments/);
  assert.match(auth, /from\("organizations"\)/);
  assert.match(auth, /organizationActive:/);
  assert.match(auth, /anyActiveSubscription/);
  assert.match(auth, /\.eq\("feature", "recruiter_support"\)/);
  assert.match(auth, /client_job_ownership/);
  assert.match(dispatch, /authorizeClientRecruiterMessage\(conversationId\)/);
  assert.match(sql, /create function public\.create_client_recruiter_chat_conversation\([\s\S]*security invoker/);
  assert.match(sql, /Client recruiter chat permission changed/);
  assert.match(sql, /join public\.organizations org[\s\S]*org\.organization_type = 'client'[\s\S]*org\.status = 'active'/);
  assert.match(sql, /entitlement\.feature = 'recruiter_support'/);
  assert.match(sql, /grant execute on function public\.create_client_recruiter_chat_conversation\(uuid, uuid, uuid\)[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /create_client_recruiter_chat_conversation[\s\S]*security definer/);
  console.log("Client recruiter chat boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
