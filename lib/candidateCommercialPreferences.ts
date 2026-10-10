export const CANDIDATE_EMPLOYMENT_PREFERENCES = [
  "Permanent",
  "Contract",
  "Both",
] as const;

export const CANDIDATE_VISA_STATUSES = [
  "Citizen",
  "Permanent Resident",
  "Employment Pass",
  "Dependant Pass",
  "Other Work Visa",
  "Visa / Sponsorship Required",
  "To Confirm",
] as const;

export type CandidateEmploymentPreference =
  (typeof CANDIDATE_EMPLOYMENT_PREFERENCES)[number];

export type CandidateCommercialPreferences = Readonly<{
  currency: string;
  currentMonthlySalary: number | null;
  expectedPermanentMonthly: number | null;
  expectedContractMonthly: number | null;
  permanentBenefits: string;
  contractBenefits: string;
  noticePeriodDays: number | null;
  availability: string;
  visaStatus: string;
  employmentPreference: CandidateEmploymentPreference;
}>;

export type CandidateCommercialFilters = Readonly<{
  maximumCurrentMonthlySalary?: number;
  maximumPermanentExpectedMonthly?: number;
  maximumContractExpectedMonthly?: number;
  maximumNoticePeriodDays?: number;
  employmentPreferences?: CandidateEmploymentPreference[];
  visaStatuses?: string[];
  benefitsKeywords?: string[];
}>;

function text(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundedMoney(value: unknown) {
  const normalized =
    typeof value === "string" ? value.replace(/[^0-9.-]/g, "") : value;
  if (normalized === "" || normalized === null || normalized === undefined)
    return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000_000
    ? Math.round(parsed * 100) / 100
    : null;
}

function noticeDays(value: unknown) {
  if (value === null || value === undefined || text(value) === "") return null;
  const direct = Number(value);
  if (Number.isInteger(direct) && direct >= 0 && direct <= 365) return direct;
  const source = text(value).toLowerCase();
  if (/^(?:immediate|immediately|available now)$/.test(source)) return 0;
  const amount = Number(source.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const days = /month/.test(source)
    ? Math.round(amount * 30)
    : /week/.test(source)
      ? Math.round(amount * 7)
      : Math.round(amount);
  return days <= 365 ? days : null;
}

function employmentPreference(value: unknown): CandidateEmploymentPreference {
  const source = text(value).toLowerCase();
  if (/both|either|contract.*perm|perm.*contract/.test(source)) return "Both";
  if (/contract|freelance|temporary/.test(source)) return "Contract";
  return "Permanent";
}

function normalizedVisa(value: unknown) {
  const source = text(value);
  const normalized = source.toLowerCase();
  if (!source) return "To Confirm";
  if (/citizen|citizenship|local national/.test(normalized)) return "Citizen";
  if (/permanent resident|\bpr\b/.test(normalized)) return "Permanent Resident";
  if (/employment pass|\bep\b/.test(normalized)) return "Employment Pass";
  if (/depend(?:a|e)nt pass|\bdp\b/.test(normalized)) return "Dependant Pass";
  if (/sponsor|visa required|requires? visa/.test(normalized))
    return "Visa / Sponsorship Required";
  if (/visa|work permit|work pass/.test(normalized)) return "Other Work Visa";
  return source.slice(0, 80);
}

export function normalizeCandidateCommercialPreferences(
  input: Record<string, unknown>,
): CandidateCommercialPreferences {
  const preference = employmentPreference(
    input.employmentPreference ??
      input.employment_preference ??
      input.employmentType ??
      input.employment_type,
  );
  const legacyExpected = boundedMoney(
    input.expectedSalaryNumeric ??
      input.expected_salary_numeric ??
      input.expectedSalary ??
      input.expected_salary,
  );
  const explicitPermanent = boundedMoney(
    input.expectedPermanentMonthly ?? input.expected_permanent_monthly,
  );
  const explicitContract = boundedMoney(
    input.expectedContractMonthly ?? input.expected_contract_monthly,
  );
  return {
    currency: text(
      input.salaryCurrency ??
        input.salary_currency ??
        input.expectedSalaryCurrency ??
        input.expected_salary_currency,
    )
      .toUpperCase()
      .slice(0, 8),
    currentMonthlySalary: boundedMoney(
      input.currentMonthlySalary ?? input.current_salary_numeric,
    ),
    // A legacy single expectation is safe only when the candidate selected one
    // employment track. Never silently copy it into both tracks.
    expectedPermanentMonthly:
      explicitPermanent ?? (preference === "Permanent" ? legacyExpected : null),
    expectedContractMonthly:
      explicitContract ?? (preference === "Contract" ? legacyExpected : null),
    permanentBenefits: text(
      input.permanentBenefits ?? input.permanent_benefits,
    ).slice(0, 500),
    contractBenefits: text(
      input.contractBenefits ?? input.contract_benefits,
    ).slice(0, 500),
    noticePeriodDays: noticeDays(
      input.noticePeriodDays ?? input.notice_period_days ?? input.noticePeriod,
    ),
    availability: text(
      input.availability ??
        input.availabilityTimeline ??
        input.availability_timeline,
    ).slice(0, 120),
    visaStatus: normalizedVisa(
      input.visaStatus ??
        input.visa_status ??
        input.workAuthorization ??
        input.work_authorization,
    ),
    employmentPreference: preference,
  };
}

function money(amount: number | null, currency: string) {
  if (amount === null) return "To discuss";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency || "Currency to confirm"} ${formatted}/month`;
}

function expectationLine(
  label: string,
  amount: number | null,
  currency: string,
  benefits: string,
) {
  return `${label}: ${money(amount, currency)}${benefits ? ` · ${benefits}` : ""}`;
}

export function candidateExpectedCompensationDisplay(
  value: CandidateCommercialPreferences,
) {
  if (value.employmentPreference === "Permanent")
    return [
      expectationLine(
        "Permanent",
        value.expectedPermanentMonthly,
        value.currency,
        value.permanentBenefits,
      ),
    ];
  if (value.employmentPreference === "Contract")
    return [
      expectationLine(
        "Contract monthly equivalent",
        value.expectedContractMonthly,
        value.currency,
        value.contractBenefits,
      ),
    ];
  return [
    expectationLine(
      "Permanent",
      value.expectedPermanentMonthly,
      value.currency,
      value.permanentBenefits,
    ),
    expectationLine(
      "Contract monthly equivalent",
      value.expectedContractMonthly,
      value.currency,
      value.contractBenefits,
    ),
  ];
}

function underMaximum(value: number | null, maximum: number | undefined) {
  return maximum === undefined || (value !== null && value <= maximum);
}

export function candidateMatchesCommercialFilters(
  candidate: CandidateCommercialPreferences,
  filters: CandidateCommercialFilters,
) {
  if (
    !underMaximum(
      candidate.currentMonthlySalary,
      filters.maximumCurrentMonthlySalary,
    ) ||
    !underMaximum(
      candidate.expectedPermanentMonthly,
      filters.maximumPermanentExpectedMonthly,
    ) ||
    !underMaximum(
      candidate.expectedContractMonthly,
      filters.maximumContractExpectedMonthly,
    ) ||
    !underMaximum(candidate.noticePeriodDays, filters.maximumNoticePeriodDays)
  )
    return false;
  if (
    filters.employmentPreferences?.length &&
    !filters.employmentPreferences.includes(candidate.employmentPreference)
  )
    return false;
  if (
    filters.visaStatuses?.length &&
    !filters.visaStatuses.some(
      (visa) => visa.toLowerCase() === candidate.visaStatus.toLowerCase(),
    )
  )
    return false;
  if (filters.benefitsKeywords?.length) {
    const benefits =
      `${candidate.permanentBenefits} ${candidate.contractBenefits}`.toLowerCase();
    if (
      !filters.benefitsKeywords.every((keyword) =>
        benefits.includes(text(keyword).toLowerCase()),
      )
    )
      return false;
  }
  return true;
}
