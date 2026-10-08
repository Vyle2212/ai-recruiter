import assert from "node:assert/strict";
import {
  candidateConfirmationCode,
  verifyCandidateConfirmation,
} from "../lib/candidateRegistrationCallback";

async function main() {
  const code = "synthetic_confirmation_code";
  const base = "https://acceptance.example.invalid/auth/candidate/callback";
  assert.equal(
    candidateConfirmationCode(new URL(`${base}?code=${code}`)),
    code,
  );
  for (const suffix of [
    "",
    `?code=${code}&code=${code}`,
    `?code=${code}&next=https://other.example.invalid`,
    `?code=${code}&role=admin`,
    `?code=${code}#token`,
    "?code=short",
  ]) {
    assert.equal(candidateConfirmationCode(new URL(base + suffix)), null);
  }
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email_confirmed_at: "2026-10-08T00:00:00Z",
  };
  let reads = 0;
  const auth = {
    exchangeCodeForSession: async () => ({ error: null }),
    getUser: async () => {
      reads++;
      return { data: { user }, error: null };
    },
  };
  assert.deepEqual(await verifyCandidateConfirmation(code, auth), {
    verified: true,
    userId: user.id,
  });
  assert.equal(reads, 1);
  for (const invalid of [
    null,
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
    { ...user, id: "forged" },
    { ...user, email_confirmed_at: "invalid" },
  ]) {
    assert.deepEqual(
      await verifyCandidateConfirmation(code, {
        ...auth,
        getUser: async () => ({ data: { user: invalid }, error: null }),
      }),
      { verified: false },
    );
  }
  assert.deepEqual(
    await verifyCandidateConfirmation(code, {
      ...auth,
      exchangeCodeForSession: async () => ({ error: "expired" }),
    }),
    { verified: false },
  );
  assert.equal(reads, 1);
  assert.deepEqual(
    await verifyCandidateConfirmation(code, {
      ...auth,
      getUser: async () => {
        throw new Error("private provider detail");
      },
    }),
    { verified: false },
  );
  console.log("Candidate callback boundary PASS (synthetic, no Auth calls)");
}
void main();
