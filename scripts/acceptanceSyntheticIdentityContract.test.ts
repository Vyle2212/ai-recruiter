import assert from "node:assert/strict";

import { ACCEPTANCE_IDENTITY_CASES } from "../lib/acceptanceSyntheticIdentityContract";

assert.deepEqual(
  ACCEPTANCE_IDENTITY_CASES.map((item) => item.key),
  [
    "recruiter",
    "recruiter_manager",
    "admin",
    "client",
    "candidate",
    "inactive_recruiter",
    "missing_profile",
  ],
);
assert.equal(
  ACCEPTANCE_IDENTITY_CASES.filter((item) => item.status === "active").length,
  5,
);
assert.equal(
  ACCEPTANCE_IDENTITY_CASES.find((item) => item.key === "inactive_recruiter")
    ?.status,
  "inactive",
);
assert.equal(
  ACCEPTANCE_IDENTITY_CASES.find((item) => item.key === "missing_profile")
    ?.profile,
  false,
);

console.log("Synthetic acceptance identity contract tests passed.");
