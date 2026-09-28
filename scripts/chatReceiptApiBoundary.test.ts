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
  const { GET, POST } = await import("../app/api/chat/conversations/[conversationId]/receipts/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  const context = { params: Promise.resolve({ conversationId: crypto.randomUUID() }) };
  try {
    assert.equal((await GET(new Request("http://localhost/api/chat"), context)).status, 404);
    assert.equal((await POST(new Request("http://localhost/api/chat", {
      method: "POST",
    }), context)).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }
  const source = fs.readFileSync(
    "app/api/chat/conversations/[conversationId]/receipts/route.ts", "utf8",
  );
  assert.match(source, /authorizeChatRequest\(conversationId\)/);
  assert.match(source, /\.eq\("user_profile_id", permission\.profileId\)/);
  assert.match(source, /\.eq\("conversation_id", permission\.conversationId\)/);
  assert.match(source, /\.is\("read_at", null\)/);
  assert.match(source, /\.limit\(50\)/);
  assert.match(source, /same_origin_required/);
  console.log("Chat receipt API boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
