import type {
  CandidateSearchV2Document,
} from "./candidateSearchV2Types";

import type {
  NormalizedCandidateSearchV2Request,
} from "./candidateSearchV2Request";

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
    | string[]
    | undefined,
) {
  return (
    values ||
    []
  ).map(
    normalize,
  );
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