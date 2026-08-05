import type {
  CandidateSearchV2Document,
} from "./candidateSearchV2Types";

type UnknownRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown,
): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function firstValue(
  record: UnknownRecord,
  keys: string[],
): unknown {
  for (const key of keys) {
    const value =
      record[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return undefined;
}

function asString(
  value: unknown,
): string | null {
  if (
    typeof value === "string"
  ) {
    const normalized =
      value.trim();

    return normalized ||
      null;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

function asNumber(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value
        .replace(/,/g, "")
        .trim();

    if (!normalized) {
      return null;
    }

    const parsed =
      Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function asStringArray(
  value: unknown,
): string[] {
  if (
    Array.isArray(value)
  ) {
    return Array.from(
      new Set(
        value
          .flatMap(
            (item) => {
              if (
                typeof item ===
                "string"
              ) {
                return item
                  .split(
                    /[,;|]/,
                  );
              }

              if (
                item &&
                typeof item ===
                  "object"
              ) {
                const itemRecord =
                  item as UnknownRecord;

                const label =
                  firstValue(
                    itemRecord,
                    [
                      "name",
                      "label",
                      "value",
                      "title",
                      "skill",
                    ],
                  );

                return label
                  ? [
                      String(label),
                    ]
                  : [];
              }

              return [];
            },
          )
          .map(
            (item) =>
              item.trim(),
          )
          .filter(Boolean),
      ),
    );
  }

  if (
    typeof value === "string"
  ) {
    return Array.from(
      new Set(
        value
          .split(
            /[,;|]/,
          )
          .map(
            (item) =>
              item.trim(),
          )
          .filter(Boolean),
      ),
    );
  }

  return [];
}

function expandSapModuleAliases(
  values: string[],
) {
  const normalized =
    Array.from(
      new Set(
        values
          .map(
            (value) =>
              value
                .normalize("NFKC")
                .trim(),
          )
          .filter(Boolean),
      ),
    );

  const upper =
    normalized.map(
      (value) =>
        value
          .toUpperCase()
          .replace(
            /^SAP\s+/,
            "",
          )
          .replace(
            /\s+/g,
            " ",
          ),
    );

  const expanded =
    new Set<string>(
      normalized,
    );

  for (const moduleName of upper) {
    expanded.add(
      moduleName,
    );

    expanded.add(
      `SAP ${moduleName}`,
    );

    if (
      moduleName === "FICO" ||
      moduleName === "FI/CO" ||
      moduleName === "FI-CO"
    ) {
      expanded.add("FICO");
      expanded.add("SAP FICO");
      expanded.add("FI");
      expanded.add("SAP FI");
      expanded.add("CO");
      expanded.add("SAP CO");
    }
  }

  const hasFi =
    upper.some(
      (value) =>
        value === "FI" ||
        value === "FICO" ||
        value === "FI/CO" ||
        value === "FI-CO",
    );

  const hasCo =
    upper.some(
      (value) =>
        value === "CO" ||
        value === "FICO" ||
        value === "FI/CO" ||
        value === "FI-CO",
    );

  if (
    hasFi &&
    hasCo
  ) {
    expanded.add("FICO");
    expanded.add("SAP FICO");
  }

  return Array.from(
    expanded,
  );
}

function collectNestedRecord(
  record: UnknownRecord,
) {
  return {
    profile:
      asRecord(
        firstValue(
          record,
          [
            "profile",
            "candidateProfile",
            "candidate_profile",
          ],
        ),
      ),

    currentExperience:
      asRecord(
        firstValue(
          record,
          [
            "currentExperience",
            "current_experience",
            "latestExperience",
            "latest_experience",
          ],
        ),
      ),

    normalized:
      asRecord(
        firstValue(
          record,
          [
            "normalized",
            "normalizedData",
            "normalized_data",
          ],
        ),
      ),
  };
}

export function adaptCandidateToSearchV2Document(
  input: unknown,
  index = 0,
): CandidateSearchV2Document {
  const record =
    asRecord(input);

  const {
    profile,
    currentExperience,
    normalized,
  } =
    collectNestedRecord(
      record,
    );

  const candidateId =
    asString(
      firstValue(
        record,
        [
          "id",
          "candidateId",
          "candidate_id",
          "uuid",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "id",
          "candidateId",
          "candidate_id",
        ],
      ),
    ) ||
    `candidate-${index + 1}`;

  const candidateName =
    asString(
      firstValue(
        record,
        [
          "candidateName",
          "candidate_name",
          "fullName",
          "full_name",
          "name",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "fullName",
          "full_name",
          "name",
        ],
      ),
    );

  const currentTitle =
    asString(
      firstValue(
        record,
        [
          "currentTitle",
          "current_title",
          "jobTitle",
          "job_title",
          "headline",
          "title",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "currentTitle",
          "current_title",
          "headline",
          "title",
        ],
      ),
    ) ||
    asString(
      firstValue(
        currentExperience,
        [
          "title",
          "jobTitle",
          "job_title",
          "position",
        ],
      ),
    );

  const currentEmployer =
    asString(
      firstValue(
        record,
        [
          "currentEmployer",
          "current_employer",
          "currentCompany",
          "current_company",
          "company",
          "employer",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "currentEmployer",
          "current_employer",
          "currentCompany",
          "current_company",
        ],
      ),
    ) ||
    asString(
      firstValue(
        currentExperience,
        [
          "company",
          "employer",
          "companyName",
          "company_name",
        ],
      ),
    );

  const country =
    asString(
      firstValue(
        record,
        [
          "country",
          "currentCountry",
          "current_country",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "country",
          "currentCountry",
          "current_country",
        ],
      ),
    );

  const location =
    asString(
      firstValue(
        record,
        [
          "location",
          "currentLocation",
          "current_location",
          "city",
        ],
      ),
    ) ||
    asString(
      firstValue(
        profile,
        [
          "location",
          "currentLocation",
          "current_location",
          "city",
        ],
      ),
    );

  const resolvedCountry =
    country ||
    location;

  const skills =
    asStringArray(
      firstValue(
        record,
        [
          "skills",
          "technicalSkills",
          "technical_skills",
          "coreSkills",
          "core_skills",
        ],
      ),
    );

  const profileSkills =
    asStringArray(
      firstValue(
        profile,
        [
          "skills",
          "technicalSkills",
          "technical_skills",
        ],
      ),
    );

  const normalizedSkills =
    asStringArray(
      firstValue(
        normalized,
        [
          "skills",
          "normalizedSkills",
          "normalized_skills",
        ],
      ),
    );

  const legacySapModules =
    asStringArray(
      firstValue(
        record,
        [
          "sapModules",
          "sap_modules",
          "modules",
        ],
      ),
    );

  const primarySapModules =
    asStringArray(
      firstValue(
        record,
        [
          "primary_module",
          "primaryModule",
        ],
      ),
    );

  const secondarySapModules =
    asStringArray(
      firstValue(
        record,
        [
          "secondary_modules",
          "secondaryModules",
        ],
      ),
    );

  const sapSubmodules =
    asStringArray(
      firstValue(
        record,
        [
          "sap_submodules",
          "sapSubmodules",
        ],
      ),
    );

  const sapModules =
    expandSapModuleAliases(
      [
        ...legacySapModules,
        ...primarySapModules,
        ...secondarySapModules,
        ...sapSubmodules,
      ],
    );

  const combinedSkills =
    Array.from(
      new Set(
        [
          ...skills,
          ...profileSkills,
          ...normalizedSkills,
          ...sapModules,
        ],
      ),
    );

  const industries =
    asStringArray(
      firstValue(
        record,
        [
          "industries",
          "industry",
          "industryExperience",
          "industry_experience",
        ],
      ),
    );

  const languages =
    asStringArray(
      firstValue(
        record,
        [
          "languages",
          "language",
          "spokenLanguages",
          "spoken_languages",
        ],
      ),
    );

  const workflowStatus =
    asString(
      firstValue(
        record,
        [
          "workflowStatus",
          "workflow_status",
          "candidateStatus",
          "candidate_status",
          "status",
        ],
      ),
    );

  const qualityStatus =
    asString(
      firstValue(
        record,
        [
          "qualityStatus",
          "quality_status",
          "validationStatus",
          "validation_status",
          "dataQualityStatus",
          "data_quality_status",
        ],
      ),
    );

  const totalYearsExperience =
    asNumber(
      firstValue(
        record,
        [
          "totalYearsExperience",
          "total_years_experience",
          "yearsOfExperience",
          "years_of_experience",
          "years",
          "experienceYears",
          "experience_years",
        ],
      ),
    );

  const relevantYearsExperience =
    asNumber(
      firstValue(
        record,
        [
          "relevantYearsExperience",
          "relevant_years_experience",
        ],
      ),
    );

  const profileQualityScore =
    asNumber(
      firstValue(
        record,
        [
          "profileQualityScore",
          "profile_quality_score",
          "qualityScore",
          "quality_score",
        ],
      ),
    );

  const dataConfidenceScore =
    asNumber(
      firstValue(
        record,
        [
          "dataConfidenceScore",
          "data_confidence_score",
          "confidenceScore",
          "confidence_score",
          "confidence",
        ],
      ),
    );

  const searchableText =
    [
      candidateName,
      currentTitle,
      currentEmployer,
      location,
      resolvedCountry,
      ...combinedSkills,
      ...sapModules,
      ...industries,
      ...languages,
      asString(
        firstValue(
          record,
          [
            "summary",
            "professionalSummary",
            "professional_summary",
            "executiveSummary",
            "executive_summary",
            "searchableText",
            "searchable_text",
            "resume_text",
            "raw_text",
            "raw_cv",
          ],
        ),
      ),
    ]
      .filter(Boolean)
      .join(" ");

  return {
    candidateId,
    candidateName,
    currentTitle,
    currentEmployer,
    country:
      resolvedCountry,

    location,

    totalYearsExperience,
    relevantYearsExperience,

    skills:
      combinedSkills,

    sapModules,
    industries,
    languages,

    salaryExpectation:
      asNumber(
        firstValue(
          record,
          [
            "salaryExpectation",
            "salary_expectation",
            "expectedSalary",
            "expected_salary",
          ],
        ),
      ),

    noticePeriodDays:
      asNumber(
        firstValue(
          record,
          [
            "noticePeriodDays",
            "notice_period_days",
          ],
        ),
      ),

    workAuthorization:
      asStringArray(
        firstValue(
          record,
          [
            "workAuthorization",
            "work_authorization",
            "visaStatus",
            "visa_status",
          ],
        ),
      ),

    workflowStatus,
    qualityStatus,

    profileQualityScore,
    dataConfidenceScore,

    updatedAt:
      asString(
        firstValue(
          record,
          [
            "updatedAt",
            "updated_at",
            "modifiedAt",
            "modified_at",
          ],
        ),
      ),

    searchableText,

    semanticSimilarity:
      asNumber(
        firstValue(
          record,
          [
            "semanticSimilarity",
            "semantic_similarity",
            "vectorSimilarity",
            "vector_similarity",
          ],
        ),
      ),

    evidence: [
      currentTitle
        ? {
            label:
              "Current title",

            value:
              currentTitle,

            source:
              "candidate profile",
          }
        : null,

      currentEmployer
        ? {
            label:
              "Current employer",

            value:
              currentEmployer,

            source:
              "candidate profile",
          }
        : null,

      combinedSkills.length
        ? {
            label:
              "Skills",

            value:
              combinedSkills.join(
                ", ",
              ),

            source:
              "candidate profile",
          }
        : null,
    ].filter(
      (
        evidence,
      ): evidence is NonNullable<
        typeof evidence
      > =>
        Boolean(evidence),
    ),
  };
}

export function adaptCandidatesToSearchV2Documents(
  input: unknown,
): CandidateSearchV2Document[] {
  let records: unknown[] =
    [];

  if (
    Array.isArray(input)
  ) {
    records =
      input;
  } else {
    const record =
      asRecord(input);

    const candidateCollection =
      firstValue(
        record,
        [
          "candidates",
          "data",
          "items",
          "results",
          "rows",
        ],
      );

    if (
      Array.isArray(
        candidateCollection,
      )
    ) {
      records =
        candidateCollection;
    }
  }

  return records.map(
    (
      candidate,
      index,
    ) =>
      adaptCandidateToSearchV2Document(
        candidate,
        index,
      ),
  );
}