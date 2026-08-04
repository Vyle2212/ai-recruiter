import type {
  CandidateSearchV2Document,
  CandidateSearchV2Explanation,
  CandidateSearchV2Result,
  CandidateSearchV2ScoreBreakdown,
} from "./candidateSearchV2Types";

import type {
  NormalizedCandidateSearchV2Request,
} from "./candidateSearchV2Request";

function clampScore(
  value: number,
) {
  return Math.round(
    Math.min(
      100,
      Math.max(
        0,
        value,
      ),
    ) *
      100,
  ) / 100;
}

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

function unique(
  values: string[],
) {
  return Array.from(
    new Set(
      values.filter(Boolean),
    ),
  );
}

function calculateTermCoverage(
  terms: string[],
  text: string,
) {
  if (
    terms.length ===
    0
  ) {
    return 0;
  }

  const matched =
    terms.filter(
      (term) =>
        text.includes(
          term,
        ),
    );

  return (
    matched.length /
    terms.length
  ) * 100;
}

function calculateListCoverage(
  required: string[],
  available: string[],
) {
  if (
    required.length ===
    0
  ) {
    return 0;
  }

  const normalizedAvailable =
    available.map(
      normalize,
    );

  const matched =
    required.filter(
      (requiredValue) =>
        normalizedAvailable.some(
          (availableValue) =>
            availableValue.includes(
              requiredValue,
            ) ||
            requiredValue.includes(
              availableValue,
            ),
        ),
    );

  return (
    matched.length /
    required.length
  ) * 100;
}

function calculateRecencyScore(
  updatedAt:
    | string
    | null
    | undefined,
  now:
    Date =
      new Date(),
) {
  if (
    !updatedAt
  ) {
    return 0;
  }

  const timestamp =
    Date.parse(
      updatedAt,
    );

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return 0;
  }

  const ageInDays =
    Math.max(
      0,
      (
        now.getTime() -
        timestamp
      ) /
        86_400_000,
    );

  if (
    ageInDays <=
    30
  ) {
    return 100;
  }

  if (
    ageInDays <=
    90
  ) {
    return 80;
  }

  if (
    ageInDays <=
    180
  ) {
    return 60;
  }

  if (
    ageInDays <=
    365
  ) {
    return 40;
  }

  return 20;
}

export function scoreCandidateSearchV2Document(
  candidate:
    CandidateSearchV2Document,
  request:
    NormalizedCandidateSearchV2Request,
): CandidateSearchV2Result {
  const searchableText =
    normalize(
      [
        candidate.candidateName,
        candidate.currentTitle,
        candidate.currentEmployer,
        candidate.country,
        candidate.location,
        ...(
          candidate.skills ||
          []
        ),
        ...(
          candidate.sapModules ||
          []
        ),
        ...(
          candidate.industries ||
          []
        ),
        ...(
          candidate.languages ||
          []
        ),
        candidate.searchableText,
      ].join(
        " ",
      ),
    );

  const matchedTerms =
    request.terms.filter(
      (term) =>
        searchableText.includes(
          term,
        ),
    );

  const requestedSkills =
    request.filters.skills ||
    [];

  const requestedSapModules =
    request.filters.sapModules ||
    [];

  const requestedIndustries =
    request.filters.industries ||
    [];

  const candidateSkills =
    (
      candidate.skills ||
      []
    ).map(
      normalize,
    );

  const candidateSapModules =
    (
      candidate.sapModules ||
      []
    ).map(
      normalize,
    );

  const candidateIndustries =
    (
      candidate.industries ||
      []
    ).map(
      normalize,
    );

  const matchedSkills =
    requestedSkills.filter(
      (skill) =>
        candidateSkills.some(
          (candidateSkill) =>
            candidateSkill.includes(
              skill,
            ) ||
            skill.includes(
              candidateSkill,
            ),
        ),
    );

  const matchedSapModules =
    requestedSapModules.filter(
      (moduleName) =>
        candidateSapModules.some(
          (candidateModule) =>
            candidateModule.includes(
              moduleName,
            ) ||
            moduleName.includes(
              candidateModule,
            ),
        ),
    );

  const matchedIndustries =
    requestedIndustries.filter(
      (industry) =>
        candidateIndustries.some(
          (candidateIndustry) =>
            candidateIndustry.includes(
              industry,
            ) ||
            industry.includes(
              candidateIndustry,
            ),
        ),
    );

  const missingSkills =
    requestedSkills.filter(
      (skill) =>
        !matchedSkills.includes(
          skill,
        ),
    );

  const keywordScore =
    calculateTermCoverage(
      request.terms,
      searchableText,
    );

  const semanticScore =
    clampScore(
      (
        candidate.semanticSimilarity ??
        0
      ) * 100,
    );

  const skillScore =
    Math.max(
      calculateListCoverage(
        requestedSkills,
        candidate.skills ||
          [],
      ),
      calculateListCoverage(
        requestedSapModules,
        candidate.sapModules ||
          [],
      ),
    );

  const titleScore =
    calculateTermCoverage(
      request.terms,
      normalize(
        candidate.currentTitle,
      ),
    );

  const employerScore =
    calculateTermCoverage(
      request.terms,
      normalize(
        candidate.currentEmployer,
      ),
    );

  const locationScore =
    calculateTermCoverage(
      request.terms,
      normalize(
        [
          candidate.location,
          candidate.country,
        ].join(
          " ",
        ),
      ),
    );

  const industryScore =
    calculateListCoverage(
      requestedIndustries,
      candidate.industries ||
        [],
    );

  const qualityScore =
    clampScore(
      candidate.profileQualityScore ??
      0,
    );

  const confidenceScore =
    clampScore(
      candidate.dataConfidenceScore ??
      0,
    );

  const recencyScore =
    calculateRecencyScore(
      candidate.updatedAt,
    );

  const baseKeywordComponent =
    (
      keywordScore *
      0.4
    ) +
    (
      skillScore *
      0.25
    ) +
    (
      titleScore *
      0.15
    ) +
    (
      employerScore *
      0.05
    ) +
    (
      locationScore *
      0.05
    ) +
    (
      industryScore *
      0.1
    );

  const weightedScore =
    (
      baseKeywordComponent *
      request.keywordWeight
    ) +
    (
      semanticScore *
      request.semanticWeight
    ) +
    (
      qualityScore *
      request.qualityWeight
    ) +
    (
      confidenceScore *
      0.08
    ) +
    (
      recencyScore *
      request.recencyWeight
    );

  const denominator =
    request.keywordWeight +
    request.semanticWeight +
    request.qualityWeight +
    request.recencyWeight +
    0.08;

  const finalScore =
    clampScore(
      denominator > 0
        ? weightedScore /
          denominator
        : 0,
    );

  const score:
    CandidateSearchV2ScoreBreakdown = {
      keywordScore:
        clampScore(
          keywordScore,
        ),

      semanticScore:
        clampScore(
          semanticScore,
        ),

      skillScore:
        clampScore(
          skillScore,
        ),

      titleScore:
        clampScore(
          titleScore,
        ),

      employerScore:
        clampScore(
          employerScore,
        ),

      locationScore:
        clampScore(
          locationScore,
        ),

      industryScore:
        clampScore(
          industryScore,
        ),

      qualityScore:
        clampScore(
          qualityScore,
        ),

      confidenceScore:
        clampScore(
          confidenceScore,
        ),

      recencyScore:
        clampScore(
          recencyScore,
        ),

      finalScore,
    };

  const reasons: string[] =
    [];

  if (
    matchedSkills.length
  ) {
    reasons.push(
      `Matched skills: ${matchedSkills.join(", ")}`,
    );
  }

  if (
    matchedSapModules.length
  ) {
    reasons.push(
      `Matched SAP modules: ${matchedSapModules.join(", ")}`,
    );
  }

  if (
    titleScore >=
    50
  ) {
    reasons.push(
      "Current title is relevant to the search query.",
    );
  }

  if (
    semanticScore >=
    70
  ) {
    reasons.push(
      "Profile has strong semantic similarity.",
    );
  }

  if (
    qualityScore >=
    80
  ) {
    reasons.push(
      "Candidate profile quality is high.",
    );
  }

  const warnings: string[] =
    [];

  if (
    missingSkills.length
  ) {
    warnings.push(
      `Missing requested skills: ${missingSkills.join(", ")}`,
    );
  }

  if (
    confidenceScore <
    50
  ) {
    warnings.push(
      "Candidate data confidence is low.",
    );
  }

  if (
    !candidate.currentEmployer
  ) {
    warnings.push(
      "Current employer is missing.",
    );
  }

  const confidenceLevel:
    CandidateSearchV2Explanation["confidenceLevel"] =
      confidenceScore >= 75
        ? "high"
        : confidenceScore >= 45
          ? "medium"
          : "low";

  return {
    candidateId:
      candidate.candidateId,

    candidateName:
      candidate.candidateName ??
      null,

    currentTitle:
      candidate.currentTitle ??
      null,

    currentEmployer:
      candidate.currentEmployer ??
      null,

    location:
      candidate.location ??
      null,

    country:
      candidate.country ??
      null,

    score,

    explanation: {
      matchedTerms:
        unique(
          matchedTerms,
        ),

      matchedSkills:
        unique(
          matchedSkills,
        ),

      matchedSapModules:
        unique(
          matchedSapModules,
        ),

      matchedIndustries:
        unique(
          matchedIndustries,
        ),

      missingSkills:
        unique(
          missingSkills,
        ),

      reasons,
      warnings,
      confidenceLevel,
    },

    evidence:
      candidate.evidence ||
      [],
  };
}