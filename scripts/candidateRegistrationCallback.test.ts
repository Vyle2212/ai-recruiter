import assert from "node:assert/strict";
import {
  candidateConfirmationCode,
  provisionCandidateRegistration,
  verifyCandidateConfirmation,
  readVerifiedCandidateRegistrationIdentity,
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
    email: "Candidate@Example.invalid",
    email_confirmed_at: "2026-10-08T00:00:00Z",
    user_metadata: { registration_full_name: "Synthetic Candidate" },
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
    email: "candidate@example.invalid",
    fullName: "Synthetic Candidate",
  });
  assert.equal(reads, 1);
  for (const invalid of [
    null,
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
    { ...user, id: "forged" },
    { ...user, email: "invalid" },
    { ...user, user_metadata: { registration_full_name: "" } },
    { ...user, user_metadata: { registration_full_name: "bad\nname" } },
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
  const identity = {
    userId: user.id,
    email: "candidate@example.invalid",
    fullName: "Synthetic Candidate",
  };
  assert.deepEqual(
    await readVerifiedCandidateRegistrationIdentity(auth.getUser),
    { verified: true, ...identity },
  );
  for (const invalidUser of [
    { ...user, email_confirmed_at: null },
    { ...user, user_metadata: {} },
    { ...user, is_anonymous: true },
  ]) {
    assert.deepEqual(
      await readVerifiedCandidateRegistrationIdentity(async () => ({
        data: { user: invalidUser },
        error: null,
      })),
      { verified: false },
    );
  }
  let captured: unknown;
  assert.equal(
    await provisionCandidateRegistration(identity, async (args) => {
      captured = args;
      return { data: { status: "created" }, error: null };
    }),
    "ready",
  );
  assert.deepEqual(captured, {
    p_auth_user_id: identity.userId,
    p_email: identity.email,
    p_full_name: identity.fullName,
  });
  for (const status of ["already_owned", "created"])
    assert.equal(
      await provisionCandidateRegistration(identity, async () => ({
        data: { status },
        error: null,
      })),
      "ready",
    );
  assert.equal(
    await provisionCandidateRegistration(identity, async () => ({
      data: { status: "identity_review_required" },
      error: null,
    })),
    "review_required",
  );
  for (const result of [
    { data: { status: "retry_required" }, error: null },
    { data: { status: "forged" }, error: null },
    { data: null, error: "private" },
  ])
    assert.equal(
      await provisionCandidateRegistration(identity, async () => result),
      "temporarily_unavailable",
    );
  assert.equal(reads, 2);
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
