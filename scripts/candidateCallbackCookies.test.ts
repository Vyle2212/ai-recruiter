import assert from "node:assert/strict";
import { candidateCallbackCookies } from "../lib/candidateCallbackCookies";
for (const result of [
  "invalid",
  "review_required",
  "temporarily_unavailable",
  "ready",
]) {
  const buffer = candidateCallbackCookies([
    { name: "sb-auth-token", value: "old-session" },
    { name: "sb-auth-token-code-verifier", value: "verifier" },
  ]);
  assert.deepEqual(buffer.getAll(), [
    { name: "sb-auth-token-code-verifier", value: "verifier" },
  ]);
  buffer.setAll([
    {
      name: "sb-auth-token",
      value: "new-session",
      options: { httpOnly: true },
    },
  ]);
  assert.equal(
    buffer.getAll().find((cookie) => cookie.name === "sb-auth-token")?.value,
    "new-session",
  );
  const written: unknown[] = [];
  buffer.commit(result, (cookie) => written.push(cookie));
  assert.equal(written.length, result === "ready" ? 1 : 0);
  buffer.commit("ready", (cookie) => written.push(cookie));
  assert.equal(written.length, result === "ready" ? 1 : 0);
}
console.log("Candidate callback cookie isolation PASS");
