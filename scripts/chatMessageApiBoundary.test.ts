import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { anyActiveSubscription } from "../lib/chatSubscriptionState";
import { prepareChatMessageRetry } from "../lib/chatMessageRetry";

let allocatedIds = 0;
const newId = () => `synthetic-${++allocatedIds}`;
const firstAttempt = prepareChatMessageRetry(null, "conversation-a", "hello", newId);
const lostResponseRetry = prepareChatMessageRetry(firstAttempt, "conversation-a", "hello", newId);
assert.equal(lostResponseRetry.clientMessageId, firstAttempt.clientMessageId);
assert.equal(allocatedIds, 1, "retry must not allocate another message ID");
assert.notEqual(prepareChatMessageRetry(firstAttempt, "conversation-a", "edited", newId).clientMessageId, firstAttempt.clientMessageId);
assert.notEqual(prepareChatMessageRetry(firstAttempt, "conversation-b", "hello", newId).clientMessageId, firstAttempt.clientMessageId);
assert.notEqual(prepareChatMessageRetry(null, "conversation-a", "hello", newId).clientMessageId, firstAttempt.clientMessageId);

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
const conversationId = "00000000-0000-4000-8000-000000000001";
let actorId = "synthetic-actor-a";
let authorized = true;
let authorizationChecks = 0;
let databaseReads = 0;
let storedMessage: Record<string, unknown> | null = null;
let readUnavailable = false;
const mockDatabase = {
  from(table: string) {
    assert.equal(table, "chat_messages");
    const filters: Record<string, unknown> = {};
    const query = {
      insert(row: Record<string, unknown>) {
        return { select: () => ({ single: async () => {
          if (storedMessage) return { data: null, error: { code: "23505" } };
          storedMessage = { id: "synthetic-message", ...row };
          return { data: storedMessage, error: null };
        } }) };
      },
      select() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      async maybeSingle() {
        databaseReads++;
        if (readUnavailable) return { data: null, error: { code: "unavailable" } };
        assert.deepEqual(Object.keys(filters).sort(), ["client_message_id", "conversation_id", "sender_profile_id"]);
        const match = storedMessage && Object.entries(filters).every(([key, value]) => storedMessage?.[key] === value);
        return { data: match ? storedMessage : null, error: null };
      },
    };
    return query;
  },
};
loader._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/chatRequestAuthorization") return {
    authorizeChatRequest: async () => {
      authorizationChecks++;
      return authorized
        ? { allowed: true, conversationId, profileId: actorId }
        : { allowed: false, status: 403, code: "access_revoked" };
    },
  };
  if (request === "@/lib/runtimeClients") return { createLazySupabaseServiceClient: () => mockDatabase };
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
    process.env.CHAT_ENABLED = "true";
    const retryContext = { params: Promise.resolve({ conversationId }) };
    const messageId = "00000000-0000-4000-8000-000000000002";
    const requestMessage = (text: string) => {
      const body = JSON.stringify({ clientMessageId: messageId, text });
      return new Request("https://acceptance.example/api/chat", {
        method: "POST", body,
        headers: { origin: "https://acceptance.example", "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) },
      });
    };
    assert.equal((await POST(requestMessage("hello"), retryContext)).status, 201);
    const retried = await POST(requestMessage("hello"), retryContext);
    assert.equal(retried.status, 200, "lost response retry acknowledges the existing message");
    assert.equal((await retried.json()).message.id, "synthetic-message");
    assert.equal(retried.headers.get("cache-control"), "private, no-store");
    assert.equal((await POST(requestMessage("changed"), retryContext)).status, 409);
    actorId = "synthetic-actor-b";
    assert.equal((await POST(requestMessage("hello"), retryContext)).status, 409, "another actor's message is never disclosed");
    actorId = "synthetic-actor-a";
    readUnavailable = true;
    assert.equal((await POST(requestMessage("hello"), retryContext)).status, 503);
    authorized = false;
    const readsBeforeDenial = databaseReads;
    assert.equal((await POST(requestMessage("hello"), retryContext)).status, 403);
    assert.equal(databaseReads, readsBeforeDenial, "revoked access cannot reach duplicate readback");
    assert.equal(authorizationChecks, 6, "every retry rechecks current authorization");
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
