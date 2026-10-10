import assert from "node:assert/strict";

import {
  candidateExpectedCompensationDisplay,
  candidateMatchesCommercialFilters,
  normalizeCandidateCommercialPreferences,
} from "../lib/candidateCommercialPreferences";

const both = normalizeCandidateCommercialPreferences({
  employment_preference: "Contract / Perm",
  salary_currency: "sgd",
  current_salary_numeric: "7,500",
  expected_salary_numeric: "8,500",
  expected_permanent_monthly: "9,000",
  expected_contract_monthly: 11_000,
  permanent_benefits: "Annual bonus and medical",
  contract_benefits: "Agency insurance",
  noticePeriod: "6 weeks",
  work_authorization: "EP holder",
  availability_timeline: "Available after notice",
});

assert.equal(both.employmentPreference, "Both");
assert.equal(both.currentMonthlySalary, 7_500);
assert.equal(both.expectedPermanentMonthly, 9_000);
assert.equal(both.expectedContractMonthly, 11_000);
assert.equal(both.noticePeriodDays, 42);
assert.equal(both.visaStatus, "Employment Pass");
assert.deepEqual(candidateExpectedCompensationDisplay(both), [
  "Permanent: SGD 9,000/month · Annual bonus and medical",
  "Contract monthly equivalent: SGD 11,000/month · Agency insurance",
]);

const ambiguousLegacyBoth = normalizeCandidateCommercialPreferences({
  employment_preference: "Both",
  expected_salary_numeric: 8_500,
  salary_currency: "MYR",
});
assert.equal(
  ambiguousLegacyBoth.expectedPermanentMonthly,
  null,
  "a legacy single expectation is not assigned to Permanent when Both is selected",
);
assert.equal(
  ambiguousLegacyBoth.expectedContractMonthly,
  null,
  "a legacy single expectation is not copied into Contract when Both is selected",
);
assert.deepEqual(candidateExpectedCompensationDisplay(ambiguousLegacyBoth), [
  "Permanent: To discuss",
  "Contract monthly equivalent: To discuss",
]);

const permanent = normalizeCandidateCommercialPreferences({
  employment_type: "permanent",
  expected_salary_numeric: 8_500,
  notice_period_days: 30,
  visa_status: "Citizen",
});
assert.equal(permanent.expectedPermanentMonthly, 8_500);
assert.equal(permanent.expectedContractMonthly, null);
assert.equal(
  candidateMatchesCommercialFilters(permanent, {
    maximumPermanentExpectedMonthly: 9_000,
    maximumNoticePeriodDays: 30,
    employmentPreferences: ["Permanent"],
    visaStatuses: ["Citizen"],
  }),
  true,
);
assert.equal(
  candidateMatchesCommercialFilters(permanent, {
    maximumContractExpectedMonthly: 12_000,
  }),
  false,
  "an absent contract expectation never passes a contract salary ceiling",
);
assert.equal(
  candidateMatchesCommercialFilters(both, {
    benefitsKeywords: ["bonus", "medical"],
    maximumContractExpectedMonthly: 10_000,
  }),
  false,
  "contract ceiling remains independent from Permanent compensation",
);
assert.equal(
  candidateMatchesCommercialFilters(both, {
    benefitsKeywords: ["bonus", "medical"],
    maximumContractExpectedMonthly: 11_000,
  }),
  true,
);

const invalid = normalizeCandidateCommercialPreferences({
  current_salary_numeric: -1,
  expected_contract_monthly: "not disclosed",
  notice_period_days: 999,
  visa_status: "Visa required",
});
assert.equal(invalid.currentMonthlySalary, null);
assert.equal(invalid.expectedContractMonthly, null);
assert.equal(invalid.noticePeriodDays, null);
assert.equal(invalid.visaStatus, "Visa / Sponsorship Required");

console.log(
  "Candidate commercial preference normalization, dual-track display and filters passed",
);
