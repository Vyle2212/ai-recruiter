import assert from "node:assert/strict";

import {
  acceptanceCandidateRegistrationIntentPath,
  acceptanceRegistrationIntentOwnsAuthUser,
  bindAcceptanceCandidateRegistrationAuthUser,
  createAcceptanceCandidateRegistrationIntent,
  parseAcceptanceCandidateRegistrationIntent,
  serializeAcceptanceCandidateRegistrationIntent,
} from "../lib/acceptanceCandidateRegistrationIntent";

const runHash = "0123456789abcdef";
const captureEmail = "capture@example.invalid";
const authUserId = "10000000-0000-4000-8000-000000000001";
const intent = createAcceptanceCandidateRegistrationIntent(
  runHash,
  captureEmail,
);

assert.deepEqual(intent, {
  schemaVersion: 1,
  runHash,
  email: "capture+ptf1c2-0123456789abcdef@example.invalid",
  fullName: "PTF public signup 0123456789abcdef",
});
assert.equal(
  acceptanceCandidateRegistrationIntentPath("/tmp/acceptance.json"),
  "/tmp/acceptance.json.candidate-registration-intent.json",
);
assert.throws(
  () => acceptanceCandidateRegistrationIntentPath(""),
  /intent_path_invalid/,
);

const bound = bindAcceptanceCandidateRegistrationAuthUser(intent, authUserId);
assert.equal(bound.authUserId, authUserId);
assert.deepEqual(
  parseAcceptanceCandidateRegistrationIntent(
    serializeAcceptanceCandidateRegistrationIntent(bound),
    runHash,
    captureEmail,
  ),
  bound,
);

const authUser = {
  id: authUserId,
  email: intent.email,
  user_metadata: { registration_full_name: intent.fullName },
};
assert.equal(acceptanceRegistrationIntentOwnsAuthUser(bound, authUser), true);
assert.equal(
  acceptanceRegistrationIntentOwnsAuthUser(bound, {
    ...authUser,
    id: "20000000-0000-4000-8000-000000000001",
  }),
  false,
);
assert.equal(
  acceptanceRegistrationIntentOwnsAuthUser(bound, {
    ...authUser,
    email: "capture+ptf1c2-ffffffffffffffff@example.invalid",
  }),
  false,
);
assert.equal(
  acceptanceRegistrationIntentOwnsAuthUser(bound, {
    ...authUser,
    user_metadata: { registration_full_name: "Editable mismatch" },
  }),
  false,
);

for (const tampered of [
  { ...intent, runHash: "ffffffffffffffff" },
  { ...intent, email: "other@example.invalid" },
  { ...intent, fullName: "Different" },
  { ...intent, unexpected: true },
]) {
  assert.throws(
    () =>
      parseAcceptanceCandidateRegistrationIntent(
        JSON.stringify(tampered),
        runHash,
        captureEmail,
      ),
    /intent_(?:invalid|mismatch)/,
  );
}
assert.throws(
  () =>
    parseAcceptanceCandidateRegistrationIntent(
      JSON.stringify(intent),
      runHash,
      "other@example.invalid",
    ),
  /intent_mismatch/,
);
assert.throws(
  () => bindAcceptanceCandidateRegistrationAuthUser(bound, "not-a-uuid"),
  /auth_user_invalid/,
);
assert.throws(
  () =>
    bindAcceptanceCandidateRegistrationAuthUser(
      bound,
      "20000000-0000-4000-8000-000000000001",
    ),
  /auth_user_mismatch/,
);

console.log(
  "Acceptance candidate registration intent ledger tests passed (synthetic only)",
);
