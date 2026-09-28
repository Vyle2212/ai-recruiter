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
  const { GET, POST } = await import("../app/api/candidate/chat-consent/route");
  const previous = process.env.CHAT_ENABLED;
  delete process.env.CHAT_ENABLED;
  try {
    const get = await GET();
    assert.equal(get.status, 404, "chat consent is unavailable while chat is off");
    const request = new Request("http://localhost/api/candidate/chat-consent", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ consent: true }),
    });
    Object.defineProperty(request, "text", {
      value: () => { throw new Error("disabled chat must not parse or write data"); },
    });
    assert.equal((await POST(request)).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_ENABLED;
    else process.env.CHAT_ENABLED = previous;
  }

  const sql = fs.readFileSync(
    "supabase/manual/202609280001_candidate_chat_contact_consent.sql",
    "utf8",
  );
  assert.match(sql, /foreign key \(user_profile_id, candidate_id\)/);
  assert.match(sql, /candidate_chat_contact_consent_events_immutable/);
  assert.match(sql, /alter table public\.candidate_chat_contact_consents force row level security/);
  assert.match(sql, /alter table public\.candidate_chat_contact_consent_events force row level security/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant .* to (?:anon|authenticated)/i);
  console.log("Candidate chat contact consent boundary passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
