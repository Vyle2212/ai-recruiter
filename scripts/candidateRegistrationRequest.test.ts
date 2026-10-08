import assert from "node:assert/strict";
import {
  parseCandidateRegistrationInput,
  candidateRegistrationCallback,
} from "../lib/candidateRegistrationRequest";

const valid = {
  email: " fixture@example.invalid ",
  password: "synthetic-password",
  fullName: " Synthetic Candidate ",
  captchaToken: "synthetic-captcha",
};
assert.deepEqual(parseCandidateRegistrationInput(valid), {
  ...valid,
  email: "fixture@example.invalid",
  fullName: "Synthetic Candidate",
});
for (const key of [
  "role",
  "candidate_id",
  "organization_id",
  "user_profile_id",
  "redirectTo",
  "app_metadata",
  "user_metadata",
]) {
  assert.equal(
    parseCandidateRegistrationInput({ ...valid, [key]: "admin" }),
    null,
  );
}
for (const key of Object.keys(valid)) {
  const missing = { ...valid } as Record<string, unknown>;
  delete missing[key];
  assert.equal(parseCandidateRegistrationInput(missing), null);
  assert.equal(parseCandidateRegistrationInput({ ...valid, [key]: {} }), null);
}
for (const value of [
  null,
  [],
  "input",
  { ...valid, password: "short" },
  { ...valid, fullName: "\n" },
  { ...valid, fullName: "x\u0000y" },
  { ...valid, captchaToken: " " },
  { ...valid, email: "a@b" },
])
  assert.equal(parseCandidateRegistrationInput(value), null);
assert.equal(
  candidateRegistrationCallback("https://acceptance.example.invalid"),
  "https://acceptance.example.invalid/auth/candidate/callback",
);
const credentialOrigin = new URL("https://example.invalid");
credentialOrigin.username = "synthetic-user";
credentialOrigin.password = "synthetic-pass";
for (const origin of [
  "http://example.invalid",
  credentialOrigin.href,
  "https://example.invalid/redirect",
  "https://example.invalid?next=evil",
  "https://example.invalid#token",
  "https://example.invalid:8443",
  "invalid",
])
  assert.equal(candidateRegistrationCallback(origin), null);
console.log(
  "Candidate registration input and callback policy PASS (synthetic, no Auth calls)",
);
