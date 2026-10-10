import assert from "node:assert/strict";
import { recruiterSearchProfilePrefetch } from "../lib/recruiterSearchProfilePrefetch";
import { authorizeRecruiterSearchAccess } from "../lib/recruiterSearchAuthorizationCore";

async function main() {
  const profile = (id: string) => ({ id: "profile", auth_user_id: id, role: "recruiter", status: "active" });
  let finishUser!: (value: { user: { id: string } | null }) => void;
  const reads: string[] = [];
  const adapter = recruiterSearchProfilePrefetch({
    getUser: () => new Promise((resolve) => { finishUser = resolve; }),
    getProfile: async (id) => { reads.push(id); return { profile: profile(id) }; },
  }, async () => "verified-hint");
  const pendingUser = adapter.getUser();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(reads, ["verified-hint"], "profile read must start before fresh Auth completes");
  finishUser({ user: { id: "actual-user" } });
  await pendingUser;
  assert.equal((await adapter.getProfile("actual-user")).profile?.auth_user_id, "actual-user");
  assert.deepEqual(reads, ["verified-hint", "actual-user"], "mismatched claim must never supply another user's profile");

  for (const user of [null, { id: "revoked" }]) {
    const scoped = recruiterSearchProfilePrefetch({
      getUser: async () => ({ user, error: user ? "revoked_session" : null }),
      getProfile: async (id) => ({ profile: profile(id) }),
    }, async () => "revoked");
    const result = await authorizeRecruiterSearchAccess({ adapter: scoped, permission: "search:read", route: "/test", log: () => {} });
    assert.equal(result.allowed, false, "fresh Auth denial overrides a successful prefetched profile");
  }
  for (const hint of [async () => null, async (): Promise<string> => { throw new Error("claims unavailable"); }, (): Promise<string> => { throw new Error("synchronous claims failure"); }]) {
    const fallback = recruiterSearchProfilePrefetch({
      getUser: async () => ({ user: { id: "actual-user" } }),
      getProfile: async (id) => ({ profile: profile(id) }),
    }, hint);
    const result = await authorizeRecruiterSearchAccess({ adapter: fallback, permission: "search:read", route: "/test", log: () => {} });
    assert.equal(result.allowed, true, "claims failure falls back to the original fresh Auth path");
  }
  const failClosed = recruiterSearchProfilePrefetch({
    getUser: async () => ({ user: { id: "actual-user" } }),
    getProfile: async () => { throw new Error("profile unavailable"); },
  }, async () => "actual-user");
  const denied = await authorizeRecruiterSearchAccess({ adapter: failClosed, permission: "search:read", route: "/test", log: () => {} });
  assert.equal(denied.allowed, false);
  let finishHint!: (subject: string) => void;
  const lateReads: string[] = [];
  const slowHint = recruiterSearchProfilePrefetch({
    getUser: async () => ({ user: { id: "actual-user" } }),
    getProfile: async (id) => { lateReads.push(id); return { profile: profile(id) }; },
  }, () => new Promise((resolve) => { finishHint = resolve; }));
  let authorizationFinished = false;
  const slowAuthorization = authorizeRecruiterSearchAccess({ adapter: slowHint, permission: "search:read", route: "/test", log: () => {} })
    .then((result) => { authorizationFinished = true; return result; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(authorizationFinished, true, "unresolved optional claims must not block fresh authorization");
  assert.equal((await slowAuthorization).allowed, true);
  assert.deepEqual(lateReads, ["actual-user"]);
  finishHint("other-user");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(lateReads, ["actual-user"], "late claims must not trigger an unused cross-identity read");

  const revokedSlowHint = recruiterSearchProfilePrefetch({
    getUser: async () => ({ user: null, error: "revoked_session" }),
    getProfile: async () => { throw new Error("denied identity must not read profiles"); },
  }, () => new Promise(() => {}));
  let deniedFinished = false;
  const revokedAuthorization = authorizeRecruiterSearchAccess({ adapter: revokedSlowHint, permission: "search:read", route: "/test", log: () => {} })
    .then((result) => { deniedFinished = true; return result; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(deniedFinished, true, "revoked fresh Auth must deny without waiting for claims");
  assert.equal((await revokedAuthorization).allowed, false);
  console.log("Search profile prefetch overlap, identity binding, revocation and fallback passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
