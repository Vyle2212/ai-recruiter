import {
  Candidate360FieldSource as Source,
  Candidate360VerificationStatus as Status,
  type Candidate360Field,
  type Candidate360Profile,
} from "./candidate360Types";
import type {
  CandidateSelfConfirmAction,
  CandidateSelfConfirmFieldValidation,
  CandidateSelfConfirmStagingFile,
  CandidateSelfConfirmStagingItem,
  CandidateSelfConfirmSubmission,
  CandidateSelfConfirmTrustImpact,
  CandidateSelfConfirmValidationResult,
} from "./candidateSelfConfirmTypes";
const INTERNAL = new Set([
  "workflowStatus",
  "repairStatus",
  "approvalHistory",
  "applyHistory",
  "id",
  "candidateId",
  "candidate_id",
  "systemId",
  "systemIds",
]);
export const CANDIDATE_SELF_CONFIRM_REQUIRED_FIELDS = [
  "displayName",
  "currentTitle",
  "currentCompany",
  "location",
  "workExperience",
  "sapModules",
  "techSkills",
  "projectExperience",
  "education",
  "languages",
] as const;
const REQUIRED = new Set<string>(CANDIDATE_SELF_CONFIRM_REQUIRED_FIELDS);
const GENERIC = new Set([
  "not disclosed",
  "financial services",
  "tax services",
  "consultant",
  "co-founder &",
]);
export const CANDIDATE_SELF_CONFIRM_DB_FIELDS: Record<string, string> = {
  displayName: "name",
  email: "email",
  phone: "phone",
  currentTitle: "current_title",
  currentCompany: "current_company",
  location: "location",
  yearsOfExperience: "years_of_experience",
  workExperience: "experience",
  sapModules: "sap_modules",
  techSkills: "skills",
  projectExperience: "projects",
  education: "education",
  certifications: "certifications",
  languages: "languages",
};
const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;
const text = (value: unknown) => String(clean(value) ?? "");
const same = (a: unknown, b: unknown) =>
  JSON.stringify(clean(a)) === JSON.stringify(clean(b));
function fieldMap(profile: Candidate360Profile) {
  return new Map<string, Candidate360Field>([
    ["displayName", profile.displayName],
    ["email", profile.contactInfo.email],
    ["phone", profile.contactInfo.phone],
    ["currentTitle", profile.currentTitle],
    ["currentCompany", profile.currentCompany],
    ["location", profile.location],
    ["yearsOfExperience", profile.yearsOfExperience],
  ]);
}
function suspicious(fieldName: string, value: unknown) {
  const valueText = text(value).toLowerCase();
  return (
    !valueText ||
    GENERIC.has(valueText) ||
    (fieldName === "currentTitle" && !/\s/.test(valueText))
  );
}
function structuredRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function rowValue(row: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && typeof value === "object" && "value" in value)
      return text(value.value);
    if (text(value)) return text(value);
  }
  return "";
}
function profileDate(value: string) {
  const match = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return year * 10_000 + month * 100 + day;
}
function completeDatedRow(
  row: Record<string, any>,
  identity: boolean,
  role: boolean,
) {
  const start = rowValue(row, "startDate", "start_date");
  const end = rowValue(row, "endDate", "end_date");
  const current = row.current === true;
  const startValue = profileDate(start);
  const endValue = end ? profileDate(end) : null;
  return Boolean(
    identity &&
      role &&
      startValue &&
      ((current && !end) || (!current && endValue && endValue >= startValue)),
  );
}
function completeProjectRow(row: Record<string, any>) {
  const identity = Boolean(rowValue(row, "name", "project", "client"));
  const role = Boolean(rowValue(row, "role", "title"));
  const start = rowValue(row, "startDate", "start_date");
  const end = rowValue(row, "endDate", "end_date");
  if (!identity || !role) return false;
  if (!start) return !end && row.current !== true;
  return completeDatedRow(row, identity, role);
}
function structuredRequirementReason(fieldName: string, value: unknown) {
  if (fieldName === "sapModules" || fieldName === "techSkills")
    return text(value)
      .split(/[,;|]+/)
      .some(Boolean)
      ? ""
      : "At least one SAP module is required.";
  const rows = structuredRows(value);
  if (fieldName === "workExperience") {
    const valid =
      rows.length > 0 &&
      rows.every((item) => {
        const row = item as Record<string, any>;
        return completeDatedRow(
          row,
          Boolean(rowValue(row, "company", "employer")),
          Boolean(rowValue(row, "title", "role")),
        );
      });
    return valid
      ? ""
      : "Every employment row needs employer, title, valid ISO start/end dates in order, or an explicit Current marker.";
  }
  if (fieldName === "projectExperience") {
    const valid =
      rows.length > 0 &&
      rows.every((item) => {
        const row = item as Record<string, any>;
        return completeProjectRow(row);
      });
    return valid
      ? ""
      : "Every SAP project needs project/client and role. Dates may both be blank; if supplied, they must form a valid ISO range or an explicit Current period.";
  }
  if (fieldName === "education") {
    const valid =
      rows.length > 0 &&
      rows.every((item) => {
        if (typeof item === "string") return Boolean(text(item));
        const row = item as Record<string, any>;
        return Boolean(
          rowValue(row, "institution") ||
            rowValue(row, "qualification", "degree") ||
            rowValue(row, "fieldOfStudy"),
        );
      });
    return valid ? "" : "At least one education record is required.";
  }
  if (fieldName === "languages") {
    const valid =
      rows.length > 0 &&
      rows.every((item) =>
        typeof item === "string"
          ? Boolean(text(item))
          : Boolean(rowValue(item as Record<string, any>, "language", "name")),
      );
    return valid ? "" : "At least one language is required.";
  }
  return "";
}

export function candidateSelfConfirmRequiredGaps(
  submission: CandidateSelfConfirmSubmission,
) {
  const submitted = new Map(
    submission.fields.map((field) => [field.fieldName, field.submittedValue]),
  );
  const gaps: string[] = CANDIDATE_SELF_CONFIRM_REQUIRED_FIELDS.flatMap(
    (fieldName) => {
      const value = submitted.get(fieldName);
      if (!text(value)) return [fieldName];
      return structuredRequirementReason(fieldName, value) ? [fieldName] : [];
    },
  );
  if (!text(submitted.get("email")) && !text(submitted.get("phone")))
    gaps.push("contact");
  if (!submission.candidateConsent) gaps.push("candidateConsent");
  return [...new Set(gaps)];
}
function riskRank(value: "safe" | "needs_recruiter_review" | "blocked") {
  return value === "safe" ? 0 : value === "needs_recruiter_review" ? 1 : 2;
}
export function buildCandidateSelfConfirmSubmission(
  candidateId: string,
  formInput: Record<string, unknown>,
  profile: Candidate360Profile,
): CandidateSelfConfirmSubmission {
  const consent =
      formInput.candidateConsent === true || formInput.confirmAccuracy === true,
    confirmedAt =
      text(formInput.candidateConfirmedAt) || new Date().toISOString(),
    known = fieldMap(profile);
  const fields = Object.entries(formInput)
    .filter(
      ([name]) =>
        ![
          "candidateConsent",
          "confirmAccuracy",
          "consentToShare",
          "candidateConfirmedAt",
        ].includes(name),
    )
    .map(([fieldName, submitted]) => {
      const current = known.get(fieldName)?.value ?? null,
        submittedValue = clean(submitted);
      let candidateAction: CandidateSelfConfirmAction = same(
        current,
        submittedValue,
      )
        ? "confirm_existing"
        : !text(submittedValue)
          ? "remove_value"
          : !text(current)
            ? "add_missing"
            : "edit_value";
      return {
        candidateId,
        fieldName,
        currentValue: current,
        submittedValue,
        candidateAction,
        candidateConfirmedAt: confirmedAt,
        candidateConsent: consent,
        source: "candidate_self_confirm" as const,
        evidenceNote: text(formInput.evidenceNote) || undefined,
      };
    });
  return {
    submissionId: `self-confirm-${candidateId}-${Date.now()}`,
    candidateId,
    submittedAt: confirmedAt,
    candidateConsent: consent,
    source: "candidate_self_confirm",
    fields,
    mode: "candidate self-confirm submission preview; no candidate DB writes",
  };
}
function validateField(
  field: CandidateSelfConfirmSubmission["fields"][number],
  profileField?: Candidate360Field,
): CandidateSelfConfirmFieldValidation {
  const reasons: string[] = [];
  let risk: "safe" | "needs_recruiter_review" | "blocked" = "safe",
    impact: CandidateSelfConfirmTrustImpact = "becomes_candidate_confirmed";
  if (!field.candidateConsent) {
    risk = "blocked";
    impact = "blocked";
    reasons.push("Candidate consent is required.");
  }
  if (
    INTERNAL.has(field.fieldName) ||
    !CANDIDATE_SELF_CONFIRM_DB_FIELDS[field.fieldName]
  ) {
    risk = "blocked";
    impact = "blocked";
    reasons.push("Field is internal or has no approved candidate DB mapping.");
  }
  if (!text(field.submittedValue) && REQUIRED.has(field.fieldName)) {
    risk = "blocked";
    impact = "blocked";
    reasons.push("Submitted value is empty or required.");
  }
  const structuredReason = REQUIRED.has(field.fieldName)
    ? structuredRequirementReason(field.fieldName, field.submittedValue)
    : "";
  if (structuredReason) {
    risk = "blocked";
    impact = "blocked";
    reasons.push(structuredReason);
  }
  if (
    text(field.submittedValue) &&
    suspicious(field.fieldName, field.submittedValue)
  ) {
    risk = "blocked";
    impact = "blocked";
    reasons.push("Submitted value is generic or suspicious.");
  }
  const highTrust =
    profileField?.source === Source.RecruiterApproved ||
    profileField?.source === Source.CandidateConfirmed ||
    profileField?.verificationStatus === Status.RecruiterVerified ||
    profileField?.verificationStatus === Status.CandidateConfirmed;
  if (
    risk !== "blocked" &&
    field.candidateAction === "edit_value" &&
    highTrust &&
    !same(field.currentValue, field.submittedValue)
  ) {
    risk = "needs_recruiter_review";
    impact = "candidate_edit_needs_review";
    reasons.push("Candidate edit conflicts with a high-trust existing value.");
  }
  if (risk !== "blocked" && field.candidateAction === "remove_value") {
    risk = "needs_recruiter_review";
    impact = "keep_existing";
    reasons.push("Removing an existing value requires recruiter review.");
  }
  if (!reasons.length)
    reasons.push(
      field.candidateAction === "confirm_existing"
        ? "Existing non-empty value confirmed by candidate."
        : "Candidate value can safely fill or replace an empty/low-trust field.",
    );
  return {
    fieldName: field.fieldName,
    valid: risk !== "blocked",
    riskLevel: risk,
    validationReasons: reasons,
    trustImpact: impact,
  };
}
export function validateCandidateSelfConfirmSubmission(
  submission: CandidateSelfConfirmSubmission,
  profile: Candidate360Profile,
): CandidateSelfConfirmValidationResult {
  const known = fieldMap(profile),
    fieldResults = submission.fields.map((item) =>
      validateField(item, known.get(item.fieldName)),
    );
  const requiredGaps = candidateSelfConfirmRequiredGaps(submission);
  const fieldRiskLevel = fieldResults.reduce(
    (risk, item) =>
      riskRank(item.riskLevel) > riskRank(risk) ? item.riskLevel : risk,
    "safe" as "safe" | "needs_recruiter_review" | "blocked",
  );
  const riskLevel = requiredGaps.length ? "blocked" : fieldRiskLevel;
  const validationReasons = [
    ...fieldResults.flatMap((item) =>
      item.validationReasons.map((reason) => `${item.fieldName}: ${reason}`),
    ),
    ...requiredGaps.map(
      (field) => `${field}: Required profile data is missing.`,
    ),
  ];
  const trustImpact: CandidateSelfConfirmTrustImpact =
    riskLevel === "blocked"
      ? "blocked"
      : riskLevel === "needs_recruiter_review"
        ? "candidate_edit_needs_review"
        : "becomes_candidate_confirmed";
  return {
    submissionId: submission.submissionId,
    candidateId: submission.candidateId,
    valid:
      submission.candidateConsent &&
      requiredGaps.length === 0 &&
      fieldResults.every((item) => item.valid),
    riskLevel,
    validationReasons,
    trustImpact,
    fieldResults,
    noDbWrites: true,
  };
}
export function buildCandidateSelfConfirmStaging(
  submission: CandidateSelfConfirmSubmission,
  validation: CandidateSelfConfirmValidationResult,
  profile?: Candidate360Profile,
): CandidateSelfConfirmStagingFile {
  const known = profile
    ? fieldMap(profile)
    : new Map<string, Candidate360Field>();
  const items: CandidateSelfConfirmStagingItem[] = submission.fields.map(
    (field, index) => {
      const result = validation.fieldResults[index],
        existing = known.get(field.fieldName);
      return {
        stagingItemId: `${submission.submissionId}-${field.fieldName}`,
        submissionId: submission.submissionId,
        candidateId: submission.candidateId,
        fieldName: field.fieldName,
        currentValue: field.currentValue,
        submittedValue: field.submittedValue,
        candidateAction: field.candidateAction,
        existingSource: existing?.source || "unknown",
        existingVerificationStatus:
          existing?.verificationStatus || "unverified",
        riskLevel: result.riskLevel,
        trustImpact: result.trustImpact,
        validationReasons: result.validationReasons,
        candidateConfirmedAt: field.candidateConfirmedAt,
        candidateConsent: field.candidateConsent,
        defaultDecision:
          result.riskLevel === "safe"
            ? "approve_candidate_confirm"
            : result.riskLevel === "needs_recruiter_review"
              ? "hold_for_recruiter_review"
              : "reject_candidate_change",
        dbFieldName: CANDIDATE_SELF_CONFIRM_DB_FIELDS[field.fieldName] || null,
      };
    },
  );
  return {
    generatedAt: new Date().toISOString(),
    mode: "candidate self-confirm staging; local report only; no candidate DB writes",
    candidateId: submission.candidateId,
    submission,
    validation,
    items,
    summary: {
      fieldsSubmitted: items.length,
      safeConfirmations: items.filter((item) => item.riskLevel === "safe")
        .length,
      needsRecruiterReview: items.filter(
        (item) => item.riskLevel === "needs_recruiter_review",
      ).length,
      blockedChanges: items.filter((item) => item.riskLevel === "blocked")
        .length,
    },
  };
}
