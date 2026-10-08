import assert from "node:assert/strict";

import {
  acceptanceRegistrationAuthOwned,
  acceptanceRegistrationAuthIdentityOwned,
  acceptanceRegistrationCandidateOwned,
  acceptanceRegistrationEmail,
  acceptanceRegistrationEmailOwned,
  acceptanceRegistrationFullName,
  acceptanceRegistrationProfileOwned,
} from "../lib/acceptanceCandidateRegistrationOwnership";

const run = "0123456789abcdef";
const fullName = acceptanceRegistrationFullName(run);
const email = acceptanceRegistrationEmail("capture@example.invalid", run);

assert.equal(fullName, "PTF public signup 0123456789abcdef");
assert.equal(email, "capture+ptf1c2-0123456789abcdef@example.invalid");
assert.equal(acceptanceRegistrationEmailOwned(email.toUpperCase(), run), true);
assert.equal(
  acceptanceRegistrationEmailOwned(
    "capture+ptf1c2-0123456789abcdef-extra@example.invalid",
    run,
  ),
  false,
);
assert.throws(
  () => acceptanceRegistrationEmail("existing+tag@example.invalid", run),
  /capture_email_invalid/,
);
assert.throws(
  () => acceptanceRegistrationFullName("../wrong"),
  /run_hash_invalid/,
);

const authUserId = "10000000-0000-4000-8000-000000000001";
const candidateId = "20000000-0000-4000-8000-000000000001";
const auth = {
  email,
  email_confirmed_at: "2026-10-08T00:00:00.000Z",
  user_metadata: { registration_full_name: fullName },
};
assert.equal(acceptanceRegistrationAuthOwned(auth, run), true);
assert.equal(acceptanceRegistrationAuthIdentityOwned(auth, run), true);
assert.equal(
  acceptanceRegistrationAuthOwned(
    { ...auth, user_metadata: { registration_full_name: "Different" } },
    run,
  ),
  false,
);
assert.equal(
  acceptanceRegistrationAuthOwned({ ...auth, email_confirmed_at: null }, run),
  false,
);
assert.equal(
  acceptanceRegistrationAuthIdentityOwned(
    { ...auth, email_confirmed_at: null },
    run,
  ),
  true,
);

const profile = {
  auth_user_id: authUserId,
  email,
  full_name: fullName,
  role: "candidate",
  status: "active",
  candidate_id: candidateId,
};
assert.equal(
  acceptanceRegistrationProfileOwned(profile, run, [authUserId]),
  true,
);
assert.equal(
  acceptanceRegistrationProfileOwned(profile, run, [
    "30000000-0000-4000-8000-000000000001",
  ]),
  false,
);
assert.equal(
  acceptanceRegistrationProfileOwned({ ...profile, role: "admin" }, run, [
    authUserId,
  ]),
  false,
);

const candidate = {
  email,
  normalized_email: email,
  name: fullName,
  status: "New",
  profile_confirmation_status: "not_claimed",
  profile_source_state: { origin: "candidate_signup", field_sources: {} },
};
assert.equal(acceptanceRegistrationCandidateOwned(candidate, run), true);
assert.equal(
  acceptanceRegistrationCandidateOwned(
    { ...candidate, profile_source_state: { origin: "admin_upload" } },
    run,
  ),
  false,
);
assert.equal(
  acceptanceRegistrationCandidateOwned(
    { ...candidate, profile_confirmation_status: "candidate_confirmed" },
    run,
  ),
  false,
);

console.log("Acceptance candidate registration ownership tests passed.");
