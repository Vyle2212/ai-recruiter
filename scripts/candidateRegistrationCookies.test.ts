import assert from "node:assert/strict";
import { candidateRegistrationCookies } from "../lib/candidateRegistrationCookies";

for (const outcome of [
  { status: 503, body: { status: "verification_pending" } },
  { status: 202, body: { status: "other" } },
  { status: 429, body: {} },
]) {
  const adapter = candidateRegistrationCookies();
  assert.deepEqual(adapter.getAll(), []);
  adapter.setAll([
    { name: "sb-synthetic-auth-token", value: "synthetic" },
    { name: "sb-synthetic-auth-token-code-verifier", value: "verifier" },
  ]);
  const writes: unknown[] = [];
  adapter.commit(outcome, (value) => writes.push(value));
  assert.deepEqual(writes, []);
  assert.deepEqual(adapter.getAll(), []);
}
const adapter = candidateRegistrationCookies();
adapter.setAll([
  { name: "sb-synthetic-auth-token-code-verifier", value: "old" },
]);
adapter.setAll([
  {
    name: "sb-synthetic-auth-token-code-verifier",
    value: "new",
    options: { httpOnly: true },
  },
  { name: "sb-synthetic-auth-token", value: "synthetic" },
]);
const writes: unknown[] = [];
adapter.commit(
  { status: 202, body: { status: "verification_pending" } },
  (value) => writes.push(value),
);
assert.deepEqual(writes, [
  {
    name: "sb-synthetic-auth-token-code-verifier",
    value: "new",
    options: { httpOnly: true },
  },
]);
adapter.commit({ status: 202, body: { status: "verification_pending" } }, () =>
  assert.fail("Cookie buffer must commit only once"),
);
assert.equal(writes.length, 1);
console.log("Candidate registration cookie isolation PASS (synthetic only)");
