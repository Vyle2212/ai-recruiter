export const CANDIDATE360_SEARCH_CONTEXT_KEY =
  "candidate360.searchContext.v1";

type SearchCandidate = {
  candidateId: string;
  retrievalKind?: "identity_match" | "evaluated_match";
  evaluation?: { kind?: string } | null;
  score?: { finalScore?: number } | null;
  matchLabel?: string | null;
  profileDataConfidencePercent?: number | null;
  verifiedSkills?: string[];
  verifiedSapModules?: string[];
  explanation?: {
    matchedSkills?: string[];
    matchedSapModules?: string[];
    matchedIndustries?: string[];
    matchedTerms?: string[];
  } | null;
};

export type Candidate360SearchMatch =
  | {
      kind: "identity_match";
      profileDataConfidencePercent?: number;
    }
  | {
      kind: "fit_evaluation";
      finalScore?: number;
      matchLevel?: string;
      confidence?: string;
      matchedSkills?: string[];
      matchedSapModules?: string[];
      matchedIndustries?: string[];
      matchedTerms?: string[];
    }
  | {
      kind?: "identity_match" | "fit_evaluation";
      finalScore?: number;
      matchedSkills?: string[];
      matchedSapModules?: string[];
      matchedIndustries?: string[];
      matchedTerms?: string[];
    };

export type Candidate360SearchContext = {
  contextId: string;
  candidateIds: string[];
  returnUrl: string;
  matchedByCandidate?: Record<string, Candidate360SearchMatch>;
  [key: string]: unknown;
};

function unique(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Map(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function candidate360SearchContextId(response: unknown) {
  const value =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const request =
    value.request && typeof value.request === "object"
      ? (value.request as Record<string, unknown>)
      : {};
  const results = Array.isArray(value.results)
    ? value.results
        .map((item) =>
          item && typeof item === "object"
            ? String((item as Record<string, unknown>).candidateId || "")
            : "",
        )
        .filter(Boolean)
    : [];
  return `search-v2-${stableHash(
    JSON.stringify({
      query: request.query || "",
      generatedAt: value.generatedAt || "",
      candidateIds: results,
    }),
  )}`;
}

export function candidate360MatchedByCandidate(
  candidates: SearchCandidate[],
  evaluationMode: string | null | undefined,
  confidenceFor: (candidate: SearchCandidate) => string,
) {
  return Object.fromEntries(
    candidates.map((candidate) => {
      const identityOnly =
        evaluationMode === "identity_only" ||
        candidate.retrievalKind === "identity_match" ||
        candidate.evaluation === null;
      if (identityOnly) {
        const confidence = candidate.profileDataConfidencePercent;
        return [
          candidate.candidateId,
          {
            kind: "identity_match" as const,
            ...(typeof confidence === "number"
              ? { profileDataConfidencePercent: confidence }
              : {}),
          },
        ];
      }
      return [
        candidate.candidateId,
        {
          kind: "fit_evaluation" as const,
          ...(typeof candidate.score?.finalScore === "number"
            ? { finalScore: candidate.score.finalScore }
            : {}),
          ...(candidate.matchLabel ? { matchLevel: candidate.matchLabel } : {}),
          confidence: confidenceFor(candidate),
          matchedSkills: unique(
            candidate.explanation?.matchedSkills || candidate.verifiedSkills,
          ),
          matchedSapModules: unique(
            candidate.explanation?.matchedSapModules ||
              candidate.verifiedSapModules,
          ),
          matchedIndustries: unique(
            candidate.explanation?.matchedIndustries,
          ),
          matchedTerms: unique(candidate.explanation?.matchedTerms),
        },
      ];
    }),
  );
}

export function candidate360SearchPosition(
  context: Pick<Candidate360SearchContext, "candidateIds"> | null,
  candidateId: string,
) {
  const candidateIds = context?.candidateIds || [];
  const index = candidateIds.indexOf(candidateId);
  return {
    index,
    total: candidateIds.length,
    previousId: index > 0 ? candidateIds[index - 1] : null,
    nextId:
      index >= 0 && index < candidateIds.length - 1
        ? candidateIds[index + 1]
        : null,
  };
}

export function resolveCandidate360SearchContext(
  context: unknown,
  candidateId: string,
  expectedContextId?: string | null,
): Candidate360SearchContext | null {
  if (!context || typeof context !== "object" || Array.isArray(context))
    return null;
  const value = context as Record<string, unknown>;
  const contextId = String(value.contextId || "").trim();
  const candidateIds = unique(value.candidateIds);
  const returnUrl = String(value.returnUrl || "").trim();
  if (
    !contextId ||
    !returnUrl ||
    !candidateIds.includes(candidateId) ||
    (expectedContextId && contextId !== expectedContextId)
  )
    return null;
  return {
    ...value,
    contextId,
    candidateIds,
    returnUrl,
    matchedByCandidate:
      value.matchedByCandidate && typeof value.matchedByCandidate === "object"
        ? (value.matchedByCandidate as Record<string, Candidate360SearchMatch>)
        : {},
  };
}

export function candidate360SearchHref(
  candidateId: string,
  searchContextId?: string | null,
  jobId?: string | null,
) {
  const params = new URLSearchParams({ from: "search-v2" });
  if (searchContextId) params.set("searchContext", searchContextId);
  if (jobId) params.set("jobId", jobId);
  return `/recruiter/candidate360-v2/${encodeURIComponent(candidateId)}?${params.toString()}`;
}
