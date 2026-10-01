import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { anyActiveSubscription } from "../lib/chatSubscriptionState";

const now = Date.parse("2026-09-28T02:00:00Z");
const plan = { status: "active", plan_code: "starter", valid_from: "2026-09-01T00:00:00Z", valid_until: null };
assert.equal(anyActiveSubscription([plan], now), true);
assert.equal(anyActiveSubscription([{ ...plan, valid_until: "2026-09-27T00:00:00Z" }], now), false);
assert.equal(anyActiveSubscription([{ ...plan, status: "revoked" }], now), false);
assert.equal(anyActiveSubscription([{ ...plan, valid_from: "2026-10-01T00:00:00Z" }], now), false);
assert.equal(anyActiveSubscription([{ ...plan, plan_code: "" }], now), false);
assert.equal(anyActiveSubscription([], now), false);

const loader = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const original = loader._load;
loader._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return original.call(this, request, parent, isMain);
};

async function main() {
  const { GET, POST } = await import("../app/api/chat/conversations/[conversationId]/messages/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  const context = { params: Promise.resolve({ conversationId: crypto.randomUUID() }) };
  try {
    const read = await GET(new Request("http://localhost/api/chat"), context);
    assert.equal(read.status, 404);
    const write = await POST(new Request("http://localhost/api/chat", {
      method: "POST", body: "not-json",
    }), context);
    assert.equal(write.status, 404, "disabled chat must not parse or write");
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }

  const source = fs.readFileSync("lib/chatMessageApiAuthorization.ts", "utf8");
  assert.match(source, /auth\.auth\.getUser\(\)/);
  assert.match(source, /candidate_chat_contact_consents/);
  assert.match(source, /auth\.admin\.getUserById/);
  assert.match(source, /client_feature_entitlements/);
  assert.doesNotMatch(source, /\.eq\("feature", "candidate_chat"\)/);
  assert.match(source, /\.eq\("organization_id", client\.organization_id\)/);
  assert.match(source, /client_candidate_access/);
  assert.match(source, /client_job_ownership/);
  assert.match(source, /authorizeChatConversation\(/);
  const dispatcher = fs.readFileSync("lib/chatRequestAuthorization.ts", "utf8");
  assert.match(
    dispatcher,
    /\.from\("chat_conversations"\)[\s\S]*\.select\("channel_kind"\)\.eq\("id", conversationId\)\.maybeSingle\(\)/,
    "the authenticated dispatcher must resolve only the path conversation",
  );
  for (const [channelKind, authorizer] of [
    ["client_candidate", "authorizeClientCandidateMessage"],
    ["recruiter_admin", "authorizeRecruiterAdminMessage"],
    ["client_recruiter", "authorizeClientRecruiterMessage"],
    ["recruiter_candidate", "authorizeRecruiterCandidateMessage"],
  ] as const) {
    assert.match(
      dispatcher,
      new RegExp(
        `data\\?\\.channel_kind === "${channelKind}"[\\s\\S]{0,160}return ${authorizer}\\(conversationId\\)`,
      ),
      `${channelKind} messages must re-run their channel-specific authorization`,
    );
  }
  assert.doesNotMatch(
    dispatcher,
    /request\.(?:json|text)\(|body\.(?:profileId|candidateId|clientId|organizationId)/,
    "actor and scope may not come from the message request body",
  );
  const route = fs.readFileSync("app/api/chat/conversations/[conversationId]/messages/route.ts", "utf8");
  assert.match(route, /authorizeChatRequest\(conversationId\)/);
  assert.match(route, /CHAT_ENABLED !== "true"/);
  assert.match(route, /same_origin_required/);
  assert.match(route, /message_type: "user"/);
  const proxy = fs.readFileSync("proxy.ts", "utf8");
  assert.match(proxy, /updateChatApiSession\(request\)/);
  assert.match(proxy, /chatApi && process\.env\.CHAT_ENABLED !== "true"/);
  console.log("Chat message API boundary passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
