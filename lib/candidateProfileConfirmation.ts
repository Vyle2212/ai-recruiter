import type { Candidate360Profile } from "./candidate360Types";
import { careerMonthIndex } from "./candidateCareerExperience";
import { careerDateIsCurrent } from "./careerDateEvidence";
import { buildCandidateSearchIndexRow } from "./candidateSearchIndex";
import {
  buildCandidateSelfConfirmSubmission,
  validateCandidateSelfConfirmSubmission,
} from "./candidateSelfConfirmSubmission";

function text(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function rows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function strings(value: unknown) {
  return [
    ...new Set(
      text(value)
        .split(/[,;|]+/)
        .map(text)
        .filter(Boolean),
    ),
  ];
}

function fieldText(value: unknown) {
  if (value && typeof value === "object" && "value" in value)
    return text((value as { value?: unknown }).value);
  return text(value);
}

function confirmationDate(value: unknown) {
  const source = fieldText(value);
  // Keep ISO and year-only precision. Convert explicit month/year text without
  // inventing a day or accepting invalid calendar dates.
  if (!/^[A-Za-z]+[\s’'-]+\d{4}$/.test(source)) return source;
  const month = careerMonthIndex(source);
  return month === null
    ? source
    : `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}`;
}

function canonicalEmployment(value: unknown) {
  return rows(value).map((entry) => {
    const row = entry as Record<string, any>;
    const end = fieldText(row.end_date ?? row.endDate);
    return {
      employer: fieldText(row.employer ?? row.company),
      title: fieldText(row.title ?? row.role),
      start_date: confirmationDate(row.start_date ?? row.startDate),
      end_date: careerDateIsCurrent(end) ? null : confirmationDate(end) || null,
      current: row.current === true || careerDateIsCurrent(end),
    };
  });
}

function canonicalProjects(value: unknown) {
  return rows(value).map((entry) => {
    const row = entry as Record<string, any>;
    const end = fieldText(row.end_date ?? row.endDate);
    return {
      project: fieldText(row.project ?? row.projectName ?? row.name),
      client: fieldText(row.client ?? row.customer) || null,
      employer: fieldText(row.employer),
      description: fieldText(row.description),
      project_type: fieldText(row.project_type ?? row.projectType),
      role: fieldText(row.role ?? row.title),
      start_date: confirmationDate(row.start_date ?? row.startDate),
      end_date: careerDateIsCurrent(end) ? null : confirmationDate(end) || null,
      current: row.current === true || careerDateIsCurrent(end),
    };
  });
}

function canonicalEducation(value: unknown) {
  return rows(value).map((entry) => {
    if (typeof entry === "string") return { qualification: text(entry) };
    const row = entry as Record<string, any>;
    return {
      institution: fieldText(row.institution),
      qualification: fieldText(row.qualification ?? row.degree),
      field_of_study: fieldText(row.fieldOfStudy ?? row.field_of_study),
      graduation_year: fieldText(row.graduationYear ?? row.graduation_year),
    };
  });
}

function canonicalLanguages(value: unknown) {
  return rows(value).map((entry) => {
    if (typeof entry === "string") return { language: text(entry) };
    const row = entry as Record<string, any>;
    return {
      language: fieldText(row.language ?? row.name),
      proficiency: fieldText(row.proficiency ?? row.level),
    };
  });
}

function canonicalCertifications(value: unknown) {
  return rows(value)
    .map((entry) =>
      typeof entry === "string"
        ? text(entry)
        : fieldText((entry as Record<string, any>).name ?? entry),
    )
    .filter(Boolean);
}

export function buildCandidateProfileConfirmation(params: {
  candidateId: string;
  submittedFields: Record<string, unknown>;
  profile: Candidate360Profile;
  currentCandidate: Record<string, unknown>;
}) {
  const fields: Record<string, unknown> = {
    ...params.submittedFields,
    workExperience: JSON.stringify(
      canonicalEmployment(params.submittedFields.workExperience),
    ),
    projectExperience: JSON.stringify(
      canonicalProjects(params.submittedFields.projectExperience),
    ),
  };
  const submission = buildCandidateSelfConfirmSubmission(
    params.candidateId,
    {
      ...fields,
      confirmAccuracy: false,
      candidateConsent:
        (params.submittedFields.candidateConsent === true ||
          params.submittedFields.confirmAccuracy === true) &&
        params.submittedFields.consentToShare === true,
    },
    params.profile,
  );
  const validation = validateCandidateSelfConfirmSubmission(
    submission,
    params.profile,
  );
  if (!validation.valid || validation.riskLevel !== "safe") {
    return { accepted: false as const, submission, validation };
  }

  const candidatePayload = {
    name: text(fields.displayName),
    email: text(fields.email) || null,
    phone: text(fields.phone).replace(/[ ()\-.]/g, "") || null,
    current_title: text(fields.currentTitle),
    current_company: text(fields.currentCompany),
    location: text(fields.location),
    experience: canonicalEmployment(fields.workExperience),
    sap_modules: strings(fields.sapModules),
    primary_module: strings(fields.sapModules)[0] || null,
    skills: strings(fields.techSkills),
    projects: canonicalProjects(fields.projectExperience),
    education: canonicalEducation(fields.education),
    certifications: canonicalCertifications(fields.certifications),
    // The confirmation RPC validates records before PostgreSQL converts them
    // into the existing text[] column. Do not pre-encode its JSON contract.
    languages: canonicalLanguages(fields.languages),
  };
  const projectedCandidate = {
    ...params.currentCandidate,
    ...candidatePayload,
    status: "active",
    extraction_coverage_status: "complete_for_validation",
    extraction_coverage: {
      ...((params.currentCandidate.extraction_coverage as Record<
        string,
        unknown
      > | null) ?? {}),
      candidate_confirmation: {
        accuracy_consent: true,
        sharing_consent: true,
        confirmed_at: submission.submittedAt,
      },
    },
    profile_source_type: "candidate_confirmed",
    profile_confirmation_status: "candidate_confirmed",
    candidate_confirmed_at: submission.submittedAt,
    updated_at: submission.submittedAt,
  };
  const searchRow = buildCandidateSearchIndexRow(projectedCandidate);
  if (!searchRow) {
    return {
      accepted: false as const,
      submission,
      validation: {
        ...validation,
        valid: false,
        riskLevel: "blocked" as const,
        trustImpact: "blocked" as const,
        validationReasons: [
          ...validation.validationReasons,
          "searchIndex: Confirmed profile is not eligible for the recruiter search projection.",
        ],
      },
    };
  }
  return {
    accepted: true as const,
    submission,
    validation,
    candidatePayload,
    searchRow,
  };
}
