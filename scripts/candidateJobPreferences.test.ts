import assert from "node:assert/strict";
import fs from "node:fs";
import {
  jobPreferenceIssues,
  canonicalJobPreferences,
} from "../lib/candidateJobPreferences";
import { candidateProjectStatuses } from "../lib/candidateProjectStatus";
const both = {
  employmentType: "Both",
  workingTypes: ["Hybrid", "Remote"],
  availability: "Available immediately",
  permanent: {
    status: "Provided",
    currency: "SGD",
    amount: "9000",
    maximum: "11000",
    basis: "gross_monthly",
    benefits: "Bonus",
  },
  contract: {
    status: "Provided",
    currency: "USD",
    amount: "600",
    basis: "gross_daily",
    negotiable: true,
  },
};
assert.deepEqual(jobPreferenceIssues(both), {});
assert.equal(canonicalJobPreferences(both).contract?.basis, "gross_daily");
assert.equal(canonicalJobPreferences(both).permanent?.basis, "gross_monthly");
assert.ok(
  jobPreferenceIssues({ ...both, contract: undefined })["contract.amount"],
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    contract: { ...both.contract, basis: "hourly" },
  })["contract.basis"],
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    permanent: { ...both.permanent, basis: "net_monthly" },
  })["permanent.basis"],
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    contract: { ...both.contract, maximum: "500" },
  })["contract.maximum"],
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    contract: { ...both.contract, status: "Made up" },
  }).contract,
);
for (const bad of [
  null,
  [],
  "bad json",
  { ...both, contract: { amount: 600 } },
  { ...both, workAuthorization: [null] },
  { ...both, availability: "Other", availabilityDetails: 12 },
  { ...both, workingTypes: "Remote" },
])
  assert.ok(Object.keys(jobPreferenceIssues(bad)).length);
assert.deepEqual(
  jobPreferenceIssues({
    ...both,
    currentSalary: { status: "Prefer not to disclose" },
  }),
  {},
);
const privateValues = canonicalJobPreferences({
  ...both,
  currentSalary: {
    status: "Prefer not to disclose",
    amount: "5000",
    currency: "SGD",
  },
  contract: { status: "Open to discussion", amount: "500", currency: "USD" },
  adminRole: "admin",
});
assert.equal(privateValues.currentSalary?.amount, undefined);
assert.equal(privateValues.contract?.amount, undefined);
assert.equal((privateValues as any).adminRole, undefined);
assert.equal(
  canonicalJobPreferences({ ...both, employmentType: "Permanent" }).contract,
  undefined,
);
assert.deepEqual(
  jobPreferenceIssues({
    ...both,
    workAuthorization: [
      { country: "Singapore", status: "EP", sponsorship: "Yes" },
    ],
  }),
  {},
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    workAuthorization: [
      { country: "Vietnam", status: "EP", sponsorship: "No" },
    ],
  })["visa.0"],
);
assert.ok(
  jobPreferenceIssues({
    ...both,
    availability: "Specific date",
    availabilityDate: "2026-02-30",
  }).availabilityDate,
);
assert.deepEqual(
  candidateProjectStatuses([
    { end: "Present" },
    { end: "Until Now" },
    { end: "2025-12" },
  ]),
  ["Current", "Current", ""],
);
assert.deepEqual(
  candidateProjectStatuses([{ end: "2024-06" }, { end: "2025-09" }, {}]),
  ["", "Latest", ""],
);
assert.deepEqual(
  candidateProjectStatuses([
    { end_date: "2025-09", current: true },
    { end_date: "2026-01" },
  ]),
  ["", "Latest"],
);
assert.deepEqual(
  candidateProjectStatuses([{ end_date: "Now" }, {}, { end_date: "2025-06" }]),
  ["Current", "", ""],
);
const sql = fs.readFileSync(
  "supabase/manual/candidate_job_preferences_confirmation.sql",
  "utf8",
);
assert.ok(sql.includes("prosecdef"));
assert.ok(sql.includes("confirmation_definition_changed_review_required"));
console.log(
  "Candidate job preferences and current/latest project tests passed.",
);
