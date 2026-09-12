import type {
  CandidateSearchV2Document,
} from "./candidateSearchV2Types";

import type {
  NormalizedCandidateSearchV2Request,
} from "./candidateSearchV2Request";
import { professionalRolesInText, seniorityInText } from "./searchV2RequirementOntology";

function normalize(
  value:
    | string
    | null
    | undefined,
) {
  return String(
    value ||
    "",
  )
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function normalizeValues(
  values:
    | readonly (string | null | undefined)[]
    | undefined,
) {
  return (
    values ||
    []
  ).map(
    normalize,
  ).filter(
    Boolean,
  );
}

function searchableCandidateValues(candidate: CandidateSearchV2Document) {
  return normalizeValues([
    candidate.candidateName,
    candidate.currentTitle,
    candidate.currentEmployer,
    candidate.country,
    candidate.location,
    candidate.searchableText,
    ...(candidate.historicalTitles || []),
    ...(candidate.skills || []),
    ...(candidate.sapModules || []),
    ...(candidate.industries || []),
    ...(candidate.languages || []),
    ...(candidate.workAuthorization || []),
    ...(candidate.evidence || []).flatMap((item) => [item.label, item.value]),
    ...(candidate.trustedCandidateEvidence?.values || []).map((item) => item.value),
  ]);
}

function includesAny(
  source:
    string[],
  expected:
    string[],
) {
  if (
    expected.length ===
    0
  ) {
    return true;
  }

  return expected.some(
    (value) =>
      source.some(
        (item) =>
          item.includes(
            value,
          ) ||
          value.includes(
            item,
          ),
      ),
  );
}

export function candidatePassesSearchV2Filters(
  candidate:
    CandidateSearchV2Document,
  request:
    NormalizedCandidateSearchV2Request,
) {
  const filters =
    request.filters;

  const candidateSkills =
    normalizeValues(
      candidate.skills,
    );

  const candidateSapModules =
    normalizeValues(
      candidate.sapModules,
    );

  const candidateIndustries =
    normalizeValues(
      candidate.industries,
    );

  const candidateLanguages =
    normalizeValues(
      candidate.languages,
    );

  const authorization =
    normalizeValues(
      candidate.workAuthorization,
    );

  const searchableValues =
    searchableCandidateValues(
      candidate,
    );

  if (
    filters.candidateNames?.length &&
    !includesAny(
      [normalize(candidate.candidateName)],
      filters.candidateNames,
    )
  ) {
    return false;
  }

  if (
    filters.countries?.length &&
    !includesAny(
      [
        normalize(
          candidate.country,
        ),
      ],
      filters.countries,
    )
  ) {
    return false;
  }

  if (
    filters.locations?.length &&
    !includesAny(
      [
        normalize(
          candidate.location,
        ),
        normalize(
          candidate.country,
        ),
      ],
      filters.locations,
    )
  ) {
    return false;
  }

  if (
    filters.currentTitles?.length &&
    !includesAny(
      [
        normalize(
          candidate.currentTitle,
        ),
      ],
      filters.currentTitles,
    )
  ) {
    return false;
  }

  if (
    filters.currentEmployers?.length &&
    !includesAny(
      [
        normalize(
          candidate.currentEmployer,
        ),
      ],
      filters.currentEmployers,
    )
  ) {
    return false;
  }

  if (
    filters.anyEmployers?.length &&
    !includesAny(
      normalizeValues([
        candidate.currentEmployer,
        ...(candidate.trustedCandidateEvidence?.values || [])
          .filter((item) => item.sourceType === "raw_experience")
          .map((item) => item.value),
      ]),
      filters.anyEmployers,
    )
  ) {
    return false;
  }

  if (
    filters.anyTitles?.length &&
    !includesAny(
      normalizeValues([
        candidate.currentTitle,
        ...(candidate.historicalTitles || []),
      ]),
      filters.anyTitles,
    )
  ) {
    return false;
  }

  if (
    filters.professionalRoles?.length &&
    !includesAny(
      professionalRolesInText([
        candidate.currentTitle,
        ...(candidate.historicalTitles || []),
      ].join(" ")).flatMap((role) => [role.label, ...role.aliases]).map(normalize),
      filters.professionalRoles,
    )
  ) {
    return false;
  }

  if (
    filters.seniorities?.length &&
    !includesAny(
      [normalize(seniorityInText(candidate.currentTitle) || "")],
      filters.seniorities,
    )
  ) {
    return false;
  }

  if (
    filters.skills?.length &&
    !includesAny(
      candidateSkills,
      filters.skills,
    )
  ) {
    return false;
  }

  if (
    filters.sapModules?.length &&
    !includesAny(
      candidateSapModules,
      filters.sapModules,
    )
  ) {
    return false;
  }

  if (
    filters.industries?.length &&
    !includesAny(
      candidateIndustries,
      filters.industries,
    )
  ) {
    return false;
  }

  if (
    filters.languages?.length &&
    !includesAny(
      candidateLanguages,
      filters.languages,
    )
  ) {
    return false;
  }

  if (
    filters.workAuthorization?.length &&
    !includesAny(
      authorization,
      filters.workAuthorization,
    )
  ) {
    return false;
  }

  if (
    filters.workflowStatuses?.length &&
    !filters.workflowStatuses.includes(
      normalize(
        candidate.workflowStatus,
      ),
    )
  ) {
    return false;
  }

  if (
    filters.qualityStatuses?.length &&
    !filters.qualityStatuses.includes(
      normalize(
        candidate.qualityStatus,
      ),
    )
  ) {
    return false;
  }
  for (const [language, proficiency] of Object.entries(filters.languageProficiencies || {})) {
    const supported = (candidate.trustedCandidateEvidence?.values || []).some((entry) =>
      normalize(entry.value).includes(normalize(language)) &&
      normalize(entry.value).includes(normalize(proficiency)),
    );
    if (!supported) return false;
  }

  if (
    filters.education?.length &&
    !includesAny(
      searchableValues,
      filters.education,
    )
  ) {
    return false;
  }

  if (
    filters.certifications?.length &&
    !includesAny(
      searchableValues,
      filters.certifications,
    )
  ) {
    return false;
  }

  if (
    filters.exclusions?.length &&
    filters.exclusions.some(
      (value) =>
        includesAny(
          searchableValues,
          [value],
        ),
    )
  ) {
    return false;
  }

  const totalYears =
    candidate.totalYearsExperience ??
    0;

  const relevantYears =
    candidate.relevantYearsExperience ??
    0;

  if (
    typeof filters.minimumTotalYearsExperience ===
      "number" &&
    totalYears <
      filters.minimumTotalYearsExperience
  ) {
    return false;
  }

  if (
    typeof filters.maximumTotalYearsExperience ===
      "number" &&
    totalYears >
      filters.maximumTotalYearsExperience
  ) {
    return false;
  }

  if (
    typeof filters.minimumRelevantYearsExperience ===
      "number" &&
    relevantYears <
      filters.minimumRelevantYearsExperience
  ) {
    return false;
  }

  if (
    typeof filters.maximumRelevantYearsExperience ===
      "number" &&
    relevantYears >
      filters.maximumRelevantYearsExperience
  ) {
    return false;
  }

  if (
    typeof filters.maximumNoticePeriodDays ===
      "number" &&
    (
      candidate.noticePeriodDays ??
      Number.POSITIVE_INFINITY
    ) >
      filters.maximumNoticePeriodDays
  ) {
    return false;
  }

  if (
    typeof filters.maximumExpectedSalary ===
      "number" &&
    (
      candidate.salaryExpectation ??
      Number.POSITIVE_INFINITY
    ) >
      filters.maximumExpectedSalary
  ) {
    return false;
  }

  return true;
}
