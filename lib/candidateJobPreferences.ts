import { candidateCountries } from "./candidateEditOptions";
export const jobCurrencies = Intl.supportedValuesOf("currency");
export const employmentTypes = ["Permanent", "Contract", "Both"];
export const workingTypes = ["Onsite", "Hybrid", "Remote"];
export const availabilityOptions = [
  "Available immediately",
  "2 weeks",
  "1 month",
  "2 months",
  "3 months",
  "Specific date",
  "Other",
];
export const salaryStatuses = [
  "Provided",
  "Prefer not to disclose",
  "Not currently employed",
];
export function visaOptions(country: string) {
  const common = [
    "Citizen",
    "Permanent resident",
    "Work visa / permit",
    "Dependent visa / pass",
    "Visa required",
    "Unsure",
  ];
  return country === "Singapore"
    ? [...common, "EP", "S Pass", "DP", "LTVP"]
    : country === "Malaysia"
      ? [...common, "Employment Pass", "Dependent Pass"]
      : common;
}
export type Compensation = {
  status?: string;
  currency?: string;
  amount?: string;
  maximum?: string;
  negotiable?: boolean;
  benefits?: string;
  basis?: string;
};
export type CandidateJobPreferences = {
  currentSalary?: Compensation;
  employmentType?: string;
  permanent?: Compensation;
  contract?: Compensation;
  workingTypes?: string[];
  availability?: string;
  availabilityDate?: string;
  availabilityDetails?: string;
  workAuthorization?: {
    _rowId?: string;
    country: string;
    status: string;
    visaType?: string;
    expiry?: string;
    sponsorship?: string;
  }[];
};
export function parseJobPreferences(raw: unknown): CandidateJobPreferences {
  try {
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    return result && typeof result === "object" && !Array.isArray(result)
      ? result
      : {};
  } catch {
    return {};
  }
}
function validatePreferences(raw: unknown) {
  const p = parseJobPreferences(raw),
    issues: Record<string, string> = {};
  if (!employmentTypes.includes(p.employmentType || ""))
    issues.employmentType = "Choose Permanent, Contract or Both.";
  if (
    !Array.isArray(p.workingTypes) ||
    !p.workingTypes.length ||
    p.workingTypes.some((x) => !workingTypes.includes(x))
  )
    issues.workingTypes = "Choose at least one working type.";
  if (!availabilityOptions.includes(p.availability || ""))
    issues.availability = "Choose your notice period or availability.";
  if (p.availability === "Other" && !p.availabilityDetails?.trim())
    issues.availabilityDetails = "Describe your availability.";
  if (
    p.availability === "Specific date" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(p.availabilityDate || "") ||
      Number.isNaN(Date.parse(p.availabilityDate!)) ||
      new Date(p.availabilityDate!).toISOString().slice(0, 10) !==
        p.availabilityDate)
  )
    issues.availabilityDate = "Choose a valid available start date.";
  for (const key of ["currentSalary", "permanent", "contract"] as const) {
    const c = p[key];
    const expected = key !== "currentSalary";
    const applicable =
      key === "currentSalary"
        ? true
        : p.employmentType === "Both" ||
          p.employmentType === (key === "permanent" ? "Permanent" : "Contract");
    if (!applicable) continue;
    if (c && (typeof c !== "object" || Array.isArray(c))) {
      issues[key] = "Choose a valid compensation option.";
      continue;
    }
    if (expected && c?.status && c.status !== "Provided")
      issues[key] = "Enter your expected gross amount.";
    if (
      c?.benefits &&
      (typeof c.benefits !== "string" || c.benefits.length > 3000)
    )
      issues[key + ".benefits"] = "Keep benefits under 3,000 characters.";

    if (!jobCurrencies.includes(c?.currency || ""))
      issues[key + ".currency"] = "Choose a currency.";
    if (
      typeof c?.amount !== "string" ||
      !/^\d+(?:\.\d{1,2})?$/.test(c?.amount || "") ||
      (expected ? Number(c?.amount) <= 0 : Number(c?.amount) < 0) ||
      Number(c?.amount) > 1e9
    )
      issues[key + ".amount"] = expected
        ? "Enter a positive gross amount."
        : "Enter your gross monthly salary; use 0 if not currently earning a salary.";
    if (
      c?.maximum &&
      (!/^\d+(?:\.\d{1,2})?$/.test(c.maximum) ||
        Number(c.maximum) < Number(c.amount) ||
        Number(c.maximum) > 1e9)
    )
      issues[key + ".maximum"] = "Maximum must be at least the minimum.";
    if (
      c?.basis &&
      c.basis !== (key === "contract" ? "gross_daily" : "gross_monthly")
    )
      issues[key + ".basis"] =
        "Use gross monthly salary or gross daily contract rate.";
    if ((c?.benefits || "").length > 3000)
      issues[key + ".benefits"] = "Keep benefits under 3,000 characters.";
  }
  if (p.currentSalary?.status && p.currentSalary.status !== "Provided")
    issues.currentSalary = "Enter your current gross monthly salary.";
  if (!Array.isArray(p.workAuthorization) || !p.workAuthorization.length)
    issues.workAuthorizationRequired =
      "Add at least one work country, authorization status and sponsorship answer.";
  if (
    p.workAuthorization &&
    (!Array.isArray(p.workAuthorization) || p.workAuthorization.length > 20)
  )
    issues.workAuthorization = "Use up to 20 work authorization records.";
  else
    p.workAuthorization?.forEach((r, i) => {
      if (
        !r ||
        !candidateCountries.some((c) => c.name === r.country) ||
        !visaOptions(r.country).includes(r.status)
      )
        issues[`visa.${i}`] = "Choose the country and status.";
      if (
        r.expiry &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiry) ||
          Number.isNaN(Date.parse(r.expiry)) ||
          new Date(r.expiry).toISOString().slice(0, 10) !== r.expiry)
      )
        issues[`visa.${i}.expiry`] = "Choose a valid visa expiry date.";
      if ((r.visaType || "").length > 300)
        issues[`visa.${i}.visaType`] =
          "Keep visa details under 300 characters.";
      if (!["Yes", "No", "Unsure"].includes(r.sponsorship || ""))
        issues[`visa.${i}.sponsorship`] =
          "Choose whether employer sponsorship is required.";
    });
  return issues;
}
export function jobPreferenceIssues(raw: unknown): Record<string, string> {
  try {
    if (JSON.stringify(raw)?.length > 20000)
      return { preferences: "Job preference details are too long." };
    const p = parseJobPreferences(raw);
    for (const c of [p.currentSalary, p.permanent, p.contract])
      if (c) {
        if (typeof c !== "object" || Array.isArray(c))
          return { preferences: "Choose valid compensation options." };
        for (const key of [
          "status",
          "currency",
          "amount",
          "maximum",
          "benefits",
          "basis",
        ] as const)
          if (c[key] !== undefined && typeof c[key] !== "string")
            return { preferences: "Enter valid compensation details." };
        if ((c.benefits || "").length > 3000)
          return { preferences: "Keep benefits under 3,000 characters." };
      }
    for (const key of ["availabilityDate", "availabilityDetails"] as const)
      if (p[key] !== undefined && typeof p[key] !== "string")
        return { preferences: "Enter valid availability details." };
    if ((p.availabilityDetails || "").length > 1000)
      return {
        availabilityDetails:
          "Keep availability details under 1,000 characters.",
      };
    if (Array.isArray(p.workAuthorization))
      for (const r of p.workAuthorization) {
        if (!r || typeof r !== "object" || Array.isArray(r))
          return {
            workAuthorization: "Choose valid work authorization details.",
          };
        for (const key of [
          "country",
          "status",
          "visaType",
          "expiry",
          "sponsorship",
        ] as const)
          if (r[key] !== undefined && typeof r[key] !== "string")
            return { workAuthorization: "Enter valid visa details." };
      }
    return validatePreferences(p);
  } catch {
    return { preferences: "Choose valid job preference details." };
  }
}
export function canonicalJobPreferences(raw: unknown): CandidateJobPreferences {
  const p = parseJobPreferences(raw);
  const issues = jobPreferenceIssues(p);
  if (
    issues.preferences ||
    issues.workAuthorization ||
    (p.workAuthorization && !Array.isArray(p.workAuthorization))
  )
    return {};
  const compensation = (c: Compensation | undefined, basis: string) =>
    c
      ? {
          status: "Provided",
          currency: c.currency,
          amount: c.amount?.trim(),
          maximum: c.maximum?.trim(),
          negotiable: c.negotiable === true,
          benefits: c.benefits?.trim(),
          basis,
        }
      : undefined;
  return {
    currentSalary:
      !p.currentSalary?.status || p.currentSalary.status === "Provided"
        ? compensation(p.currentSalary, "gross_monthly")
        : undefined,
    employmentType: p.employmentType,
    workingTypes: Array.isArray(p.workingTypes)
      ? [...new Set(p.workingTypes.filter((v) => workingTypes.includes(v)))]
      : [],
    permanent:
      p.employmentType !== "Contract"
        ? compensation(p.permanent, "gross_monthly")
        : undefined,
    contract:
      p.employmentType !== "Permanent"
        ? compensation(p.contract, "gross_daily")
        : undefined,
    availability: p.availability,
    availabilityDate:
      p.availability === "Specific date" ? p.availabilityDate : undefined,
    availabilityDetails:
      p.availability === "Other" ? p.availabilityDetails?.trim() : undefined,
    workAuthorization: (p.workAuthorization || []).map((r) => ({
      country: r.country,
      status: r.status,
      visaType: r.visaType?.trim(),
      expiry: r.expiry,
      sponsorship: r.sponsorship,
    })),
  };
}
