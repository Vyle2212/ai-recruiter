import { parseRecruiterSearchIntent } from "./recruiterSearchPresentation";
import type { CandidateSearchV2Document } from "./candidateSearchV2Types";
import { resolvePublicIdentityToken } from "./searchV2PublicIdentity";
import { normalizeSearchV2Query } from "./searchV2QueryNormalization";

export const SEARCH_V2_UNIFIED_INTENT_VERSION =
  "search-v2-unified-intent-v5-punctuation-tolerant-identity";

export type SearchV2IntentType =
  | "candidate_name_lookup"
  | "identity_token_lookup"
  | "title_search"
  | "company_search"
  | "requirements_search"
  | "hybrid_candidate_evaluation"
  | "job_description_search"
  | "unrecognized";

export type SearchV2UnifiedIntent = Readonly<{
  version: typeof SEARCH_V2_UNIFIED_INTENT_VERSION;
  type: SearchV2IntentType;
  label: string;
  lookupValue: string | null;
  evaluationQuery: string;
  searchable: boolean;
}>;

export const normalizeSearchIdentityText = (value: unknown) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const roleWords =
  /\b(?:consultant|manager|analyst|developer|engineer|architect|lead|director|specialist|accountant|administrator|officer|head|support)\b/i;
const requirementWords =
  /\b(?:sap|fico|fi\s*[-/]?\s*co|s\/?4\s*hana|implementation|rollout|migration|configuration|support|certified|certification|years?|experience|relocation|remote|malaysia|singapore|indonesia|thailand|vietnam|philippines|finance|new\s+gl)\b/i;
const jdWords =
  /\b(?:job description|responsibilities|qualifications|required qualifications|about the role|must have|nice to have)\b/i;

function personLike(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (
    words.length >= 1 &&
    words.length <= 5 &&
    words.every((word) => /^[\p{L}][\p{L}'.-]*$/u.test(word)) &&
    !roleWords.test(value) &&
    !requirementWords.test(value)
  );
}

function hybridCandidateParts(query: string) {
  const check = query.match(
    /^\s*(?:check|verify|assess|evaluate)\s+(?:whether\s+)?(.+?)\s+(?:has|with|against|for)\s+(.+)$/i,
  );
  if (check && personLike(check[1]))
    return { name: check[1].trim(), evaluation: check[2].trim() };
  const withClause = query.match(/^\s*(.+?)\s+with\s+(.+)$/i);
  if (
    withClause &&
    personLike(withClause[1]) &&
    requirementWords.test(withClause[2])
  )
    return { name: withClause[1].trim(), evaluation: withClause[2].trim() };
  const tokens = query.trim().split(/\s+/);
  for (
    let boundary = Math.min(4, tokens.length - 1);
    boundary >= 1;
    boundary -= 1
  ) {
    const name = tokens.slice(0, boundary).join(" "),
      evaluation = tokens.slice(boundary).join(" ");
    if (personLike(name) && requirementWords.test(evaluation))
      return { name, evaluation };
  }
  return null;
}

export function detectSearchV2UnifiedIntent(
  input: unknown,
): SearchV2UnifiedIntent {
  const normalized = normalizeSearchV2Query(input);
  const query = normalized.normalizedQuery;
  const base = { version: SEARCH_V2_UNIFIED_INTENT_VERSION } as const;
  if (!query)
    return {
      ...base,
      type: "unrecognized",
      label: "No searchable intent",
      lookupValue: null,
      evaluationQuery: "",
      searchable: false,
    };
  const token = query.match(/^#?([a-f0-9]{6})$/i);
  if (token)
    return {
      ...base,
      type: "identity_token_lookup",
      label: "Candidate identity",
      lookupValue: `#${token[1].toUpperCase()}`,
      evaluationQuery: "",
      searchable: true,
    };
  if (
    normalized.structuredField === "candidate" ||
    normalized.structuredField === "name"
  )
    return {
      ...base,
      type: "candidate_name_lookup",
      label: "Candidate name",
      lookupValue: query,
      evaluationQuery: "",
      searchable: true,
    };
  if (normalized.structuredField === "title")
    return {
      ...base,
      type: "title_search",
      label: "Job title or role",
      lookupValue: query,
      evaluationQuery: query,
      searchable: true,
    };
  if (normalized.structuredField === "company")
    return {
      ...base,
      type: "company_search",
      label: "Employer or company",
      lookupValue: query,
      evaluationQuery: "",
      searchable: true,
    };
  if (query.length >= 180 || /\n/.test(query) || jdWords.test(query))
    return {
      ...base,
      type: "job_description_search",
      label: "Job description",
      lookupValue: null,
      evaluationQuery: query,
      searchable: true,
    };
  const hybrid = hybridCandidateParts(query);
  if (hybrid)
    return {
      ...base,
      type: "hybrid_candidate_evaluation",
      label: "Candidate evaluation",
      lookupValue: hybrid.name,
      evaluationQuery: hybrid.evaluation,
      searchable: true,
    };
  const company = query.match(
    /\b(?:working\s+at|worked\s+at|from|at|former(?:ly)?\s+(?:at\s+)?)\s+([\p{L}\p{N}&.' -]{2,80}?)(?=\s+(?:sap|consultants?|professionals?|with|who|in)\b|$)/iu,
  );
  if (company) {
    const evaluation = query
      .replace(company[0], " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      ...base,
      type: "company_search",
      label: "Employer or company",
      lookupValue: company[1].trim(),
      evaluationQuery: evaluation,
      searchable: true,
    };
  }
  if (personLike(query))
    return {
      ...base,
      type: "candidate_name_lookup",
      label: "Candidate name",
      lookupValue: query,
      evaluationQuery: "",
      searchable: true,
    };
  const parsed = parseRecruiterSearchIntent(query);
  const recognizedRequirements =
    parsed.roleConcepts.length ||
    parsed.skills.length ||
    parsed.sapModules.length ||
    parsed.countries.length ||
    parsed.seniority.length ||
    parsed.lifecycle.length ||
    /\b\d+\s*\+?\s*years?\b/i.test(query);
  const compoundRequirements =
    parsed.countries.length ||
    parsed.lifecycle.length ||
    /\b\d+\s*\+?\s*years?\b/i.test(query) ||
    /\b(?:relocation|remote)\b/i.test(query);
  if (recognizedRequirements && compoundRequirements)
    return {
      ...base,
      type: "requirements_search",
      label: "Requirements",
      lookupValue: null,
      evaluationQuery: query,
      searchable: true,
    };
  if (roleWords.test(query))
    return {
      ...base,
      type: "title_search",
      label: "Job title or role",
      lookupValue: query,
      evaluationQuery: query,
      searchable: true,
    };
  if (recognizedRequirements)
    return {
      ...base,
      type: "requirements_search",
      label: "Requirements",
      lookupValue: null,
      evaluationQuery: query,
      searchable: true,
    };
  return {
    ...base,
    type: "unrecognized",
    label: "No searchable intent",
    lookupValue: null,
    evaluationQuery: "",
    searchable: false,
  };
}

const editDistance = (left: string, right: string) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let a = 1; a <= left.length; a += 1) {
    let previous = row[0];
    row[0] = a;
    for (let b = 1; b <= right.length; b += 1) {
      const before = row[b];
      row[b] = Math.min(
        row[b] + 1,
        row[b - 1] + 1,
        previous + Number(left[a - 1] !== right[b - 1]),
      );
      previous = before;
    }
  }
  return row[right.length];
};

export function canonicalLookupMatches(
  documents: readonly CandidateSearchV2Document[],
  intent: SearchV2UnifiedIntent,
) {
  const lookup = normalizeSearchIdentityText(intent.lookupValue);
  if (intent.type === "identity_token_lookup") {
    const requested = intent.lookupValue || "";
    const identifiersFor = (document: CandidateSearchV2Document) => [
      document.candidateId,
      document.canonicalCandidateId,
      ...(document.sourceCandidateIds || []),
    ];
    const exact = documents.filter((document) =>
      resolvePublicIdentityToken(requested, identifiersFor(document)),
    );
    if (exact.length)
      return exact.map((document) => ({ document, matchRank: 0 }));
    return [];
  }
  const matches = documents
    .flatMap((document) => {
      if (intent.type === "company_search") {
        const employers = [
          document.currentEmployer,
          ...(document.historicalEmployers || []),
        ]
          .map(normalizeSearchIdentityText)
          .filter(Boolean);
        const exact = employers.some((value) => value === lookup),
          partial = employers.some(
            (value) => value.includes(lookup) || lookup.includes(value),
          );
        return exact || partial ? [{ document, matchRank: exact ? 0 : 1 }] : [];
      }
      // Name retrieval is deliberately bounded to the grounded canonical name.
      // Raw alternate fields can contain headings, employers, or low-confidence
      // extraction fragments and must never turn a nameless profile into an
      // identity match. Source spelling variants are retained only when they
      // normalize to the same canonical identity.
      const canonicalName = normalizeSearchIdentityText(document.candidateName);
      const names = [
        document.candidateName,
        ...(document.alternateNames || []).filter(
          (name) =>
            Boolean(canonicalName) &&
            normalizeSearchIdentityText(name) === canonicalName,
        ),
      ]
        .map(normalizeSearchIdentityText)
        .filter(Boolean);
      const exact = names.some((value) => value === lookup);
      const partial =
        lookup.length >= 3 &&
        names.some(
          (value) =>
            value.split(" ").some((part) => part.startsWith(lookup)) ||
            value.includes(lookup),
        );
      const fuzzy =
        lookup.length >= 5 &&
        names.some(
          (value) =>
            editDistance(value, lookup) <=
            Math.max(1, Math.floor(lookup.length / 8)),
        );
      return exact || partial || fuzzy
        ? [{ document, matchRank: exact ? 0 : partial ? 1 : 2 }]
        : [];
    })
    .sort(
      (left, right) =>
        left.matchRank - right.matchRank ||
        normalizeSearchIdentityText(left.document.candidateName).localeCompare(
          normalizeSearchIdentityText(right.document.candidateName),
        ) ||
        left.document.candidateId.localeCompare(right.document.candidateId),
    );
  const exactMatches = matches.filter((match) => match.matchRank === 0);
  return exactMatches.length ? exactMatches : matches;
}

export function confirmSearchV2IdentityIntent(
  documents: readonly CandidateSearchV2Document[],
  query: unknown,
  detected = detectSearchV2UnifiedIntent(query),
): SearchV2UnifiedIntent {
  if (detected.type === "identity_token_lookup") return detected;
  const normalized = normalizeSearchV2Query(query);
  const lookup = normalizeSearchIdentityText(normalized.normalizedQuery);
  if (!lookup) return detected;
  const exactNameExists = documents.some(
    (document) =>
      Boolean(document.candidateName) &&
      normalizeSearchIdentityText(document.candidateName) === lookup,
  );
  if (!exactNameExists && detected.type === "candidate_name_lookup") {
    const exactEmployerExists = documents.some((document) =>
      [document.currentEmployer, ...(document.historicalEmployers || [])]
        .map(normalizeSearchIdentityText)
        .some((employer) => employer === lookup),
    );
    if (exactEmployerExists)
      return {
        version: SEARCH_V2_UNIFIED_INTENT_VERSION,
        type: "company_search",
        label: "Employer or company",
        lookupValue: normalized.normalizedQuery,
        evaluationQuery: "",
        searchable: true,
      };
  }
  return exactNameExists
    ? {
        version: SEARCH_V2_UNIFIED_INTENT_VERSION,
        type: "candidate_name_lookup" as const,
        label: "Candidate name",
        lookupValue: normalized.normalizedQuery,
        evaluationQuery: "",
        searchable: true,
      }
    : detected;
}

/** Profile-only projection for pure identity retrieval.
 * Deliberately excludes every recruiter-fit score, tier, requirement and criterion field. */
export function identityOnlyCandidateProjection(
  document: CandidateSearchV2Document,
  identityMatchKind: "exact" | "partial" | "fuzzy" = "exact",
) {
  const profileEvidence = document.profileEvidence || {
    name: Boolean(document.candidateName),
    title: Boolean(document.currentTitle),
    employer: Boolean(document.currentEmployer),
    location: Boolean(document.location || document.country),
    experienceDuration: Boolean(
      document.totalYearsExperience && document.totalYearsExperience > 0,
    ),
    employmentHistory: false,
    projectHistory: false,
    education: false,
    certifications: false,
    skills: Boolean(document.skills?.length || document.sapModules?.length),
  };
  const evidenceValues = Object.values(profileEvidence);
  const fallbackCompleteness = evidenceValues.length
    ? Math.round(
        (evidenceValues.filter(Boolean).length / evidenceValues.length) * 100,
      )
    : 0;
  const profileCompletenessPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        document.canonicalProfileCompletenessScore ??
          document.profileQualityScore ??
          fallbackCompleteness,
      ),
    ),
  );
  return {
    candidateId: document.candidateId,
    talentPool: document.talentPool || "internal_profiles",
    linkedInProfileUrl: document.linkedInProfileUrl || null,
    canonicalCandidateId: document.canonicalCandidateId || document.candidateId,
    sourceCandidateIds: document.sourceCandidateIds || [document.candidateId],
    candidateName: document.candidateName ?? null,
    currentTitle: document.currentTitle ?? null,
    currentEmployer: document.currentEmployer ?? null,
    location: document.location ?? null,
    country: document.country ?? null,
    totalYearsExperience: document.totalYearsExperience ?? null,
    evidence: document.evidence || [],
    profileEvidence,
    profileCompletenessPercent,
    profileDataConfidencePercent: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          document.dataConfidenceScore ??
            document.profileQualityScore ??
            profileCompletenessPercent,
        ),
      ),
    ),
    sourceCompletenessPercent:
      document.sourceCompletenessScore == null
        ? undefined
        : Math.max(
            0,
            Math.min(100, Math.round(document.sourceCompletenessScore)),
          ),
    verifiedSkills: [...new Set(document.skills || [])],
    verifiedSapModules: [...new Set(document.sapModules || [])],
    queryRelevantSkills: [],
    profilePreview: document.profilePreview,
    retrievalKind: "identity_match" as const,
    identityMatchKind,
    evaluation: null,
    score: null,
    matchLabel: null,
    requiredCoveragePercent: null,
    criteriaDiagnostic: null,
    fitEvaluation: null,
  };
}
