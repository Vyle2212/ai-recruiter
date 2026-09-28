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
  const { POST } = await import("../app/api/chat/conversations/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  try {
    const request = new Request("http://localhost/api/chat/conversations", {
      method: "POST", body: "invalid",
    });
    Object.defineProperty(request, "text", {
      value: () => { throw new Error("disabled chat must not read request body"); },
    });
    assert.equal((await POST(request)).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }
  const route = fs.readFileSync("app/api/chat/conversations/route.ts", "utf8");
  for (const marker of [
    "auth.auth.getUser()", "candidate_accounts", "candidate_chat_contact_consents",
    "client_memberships", "client_candidate_access", "client_job_ownership",
    "client_feature_entitlements", "auth.admin.getUserById",
    "authorizeChatConversation({", "create_client_candidate_chat_conversation",
  ]) assert.ok(route.includes(marker), `${marker} required at conversation creation`);
  assert.ok(!route.includes(".from(\"chat_conversations\").insert("),
    "creation must use atomic database RPC");
  console.log("Chat conversation creation boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
