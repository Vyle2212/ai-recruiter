import assert from "node:assert/strict";
import { candidateRegistrationOwnership as decide } from "../lib/candidateRegistrationOwnership";

const empty = {
  profiles: [],
  accounts: [],
  candidateIds: [],
  readError: false,
};
assert.equal(decide("synthetic-user", empty), "create_new");
assert.equal(decide("", empty), "review_required");
assert.equal(
  decide("synthetic-user", { ...empty, readError: true }),
  "review_required",
);
// An existing/imported candidate identifier cannot become ownership evidence.
assert.equal(
  decide("synthetic-user", { ...empty, candidateIds: ["imported-record"] }),
  "review_required",
);
const profile = {
  id: "synthetic-profile",
  auth_user_id: "synthetic-user",
  role: "candidate",
  status: "active",
  candidate_id: "synthetic-candidate",
};
const account = {
  user_profile_id: profile.id,
  candidate_id: profile.candidate_id,
  status: "active",
};
const owned = {
  profiles: [profile],
  accounts: [account],
  candidateIds: [profile.candidate_id],
  readError: false,
};
assert.equal(decide("synthetic-user", owned), "already_owned");
for (const patch of [
  { role: "admin" },
  { status: "inactive" },
  { auth_user_id: "other-user" },
  { candidate_id: null },
])
  assert.equal(
    decide("synthetic-user", {
      ...owned,
      profiles: [{ ...profile, ...patch }],
    }),
    "review_required",
  );
for (const patch of [
  { status: "inactive" },
  { user_profile_id: "other-profile" },
  { candidate_id: "other-candidate" },
])
  assert.equal(
    decide("synthetic-user", {
      ...owned,
      accounts: [{ ...account, ...patch }],
    }),
    "review_required",
  );
assert.equal(
  decide("synthetic-user", { ...owned, profiles: [profile, profile] }),
  "review_required",
);
assert.equal(
  decide("synthetic-user", { ...owned, accounts: [] }),
  "review_required",
);
assert.equal(
  decide("synthetic-user", { ...owned, candidateIds: [] }),
  "review_required",
);
console.log(
  "Candidate registration ownership policy PASS (synthetic, no DB writes)",
);
