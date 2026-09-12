export const SEARCH_V2_RESPONSE_CONTRACT_VERSION =
  "search-v2-response-contract-v72-project-identity-separation";

export type SearchV2ClientSummary = {
  totalDocuments: number;
  totalMatched: number;
  eligibleTotal: number;
  visibleTotal: number;
  verifiedVisible: number;
  supportedVisible: number;
  relatedVisible: number;
  appliedMinimumScore: number;
  appliedMatchQuality: "any" | "relevant" | "strong";
  returned: number;
  page: number;
  pageSize: number;
};

export type NormalizedSearchV2Response<Result = unknown> = {
  generatedAt: string;
  request: {
    query: string;
    mode: string;
    page: number;
    pageSize: number;
    minimumScore: number;
  };
  summary: SearchV2ClientSummary;
  results: Result[];
  source?: Record<string, unknown>;
  safety?: Record<string, unknown>;
  eligibilityDiagnostic?: import("./searchV2CommittedRequirements").SearchV2EligibilityDiagnostic;
  searchIntent?: import("./searchV2UnifiedIntent").SearchV2UnifiedIntent;
  evaluationMode?:
    "identity_only" | "named_candidate_evaluation" | "requirements_ranking";
};

export type SearchV2ResponseNormalization =
  | { ok: true; response: NormalizedSearchV2Response }
  | { ok: false; code: "invalid_response" };

export function internalSearchV2ResultSummaryText(input: {
  returned: number;
  visibleTotal: number;
  eligibleTotal: number;
}) {
  const thresholdContext =
    input.eligibleTotal > input.visibleTotal
      ? ` (${input.eligibleTotal.toLocaleString()} met required filters)`
      : "";
  return input.returned
    ? `Showing top ${input.returned.toLocaleString()} of ${input.visibleTotal.toLocaleString()} matching candidates${thresholdContext}`
    : `${input.visibleTotal.toLocaleString()} matching candidates${thresholdContext}`;
}

export type SearchV2ResponseReconciliation =
  | { status: "accepted"; response: NormalizedSearchV2Response }
  | { status: "invalid"; code: "invalid_response" }
  | { status: "stale" };

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finiteNonNegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const nonNegativeInteger = (value: unknown) => {
  const number = finiteNonNegative(value);
  return number !== null && Number.isInteger(number) ? number : null;
};
const has = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export function normalizeSearchV2Response(
  value: unknown,
  options: { allowEmptyInitialization?: boolean } = {},
): SearchV2ResponseNormalization {
  if (
    !record(value) ||
    !record(value.summary) ||
    !record(value.request) ||
    !Array.isArray(value.results)
  )
    return { ok: false, code: "invalid_response" };
  const summary = value.summary;
  const request = value.request;
  const identityOnly = value.evaluationMode === "identity_only";
  const results = value.results.map((item) => {
    if (!record(item)) return item;
    if (identityOnly)
      return {
        ...item,
        retrievalKind: "identity_match",
        evaluation: null,
        score: null,
        matchLabel: null,
        requiredCoveragePercent: null,
        criteriaDiagnostic: null,
      };
    return record(item.score)
      ? {
          ...item,
          retrievalKind: "evaluated_match",
          evaluation: { kind: "recruiter_fit" },
        }
      : item;
  });
  const initialization =
    options.allowEmptyInitialization === true && results.length === 0;

  if (
    identityOnly &&
    results.some(
      (item) =>
        !record(item) ||
        item.retrievalKind !== "identity_match" ||
        item.evaluation !== null ||
        item.score !== null ||
        item.matchLabel !== null ||
        item.requiredCoveragePercent !== null,
    )
  )
    return { ok: false, code: "invalid_response" };

  if (value.source === "external_talent_network") {
    const invalidExternalScore = results.some((item) => {
      if (!record(item) || !record(item.score)) return true;
      const rankingScore = finiteNonNegative(item.rankingScore);
      return (
        rankingScore === null ||
        finiteNonNegative(item.overallMatchScore) !== rankingScore ||
        finiteNonNegative(item.overallMatchPercent) !== rankingScore ||
        finiteNonNegative(item.score.finalScore) !== rankingScore
      );
    });
    if (invalidExternalScore) return { ok: false, code: "invalid_response" };
  }

  if (
    has(summary, "visibleTotal") &&
    finiteNonNegative(summary.visibleTotal) === null
  )
    return { ok: false, code: "invalid_response" };
  if (
    has(summary, "eligibleTotal") &&
    finiteNonNegative(summary.eligibleTotal) === null
  )
    return { ok: false, code: "invalid_response" };
  if (
    has(summary, "totalMatched") &&
    finiteNonNegative(summary.totalMatched) === null
  )
    return { ok: false, code: "invalid_response" };
  if (
    has(value, "visibleTotal") &&
    finiteNonNegative(value.visibleTotal) === null
  )
    return { ok: false, code: "invalid_response" };

  const legacyTotal = finiteNonNegative(summary.totalMatched);
  const visibleTotal =
    finiteNonNegative(summary.visibleTotal) ??
    legacyTotal ??
    finiteNonNegative(value.visibleTotal) ??
    (initialization ? 0 : null);
  const eligibleTotal =
    finiteNonNegative(summary.eligibleTotal) ?? (initialization ? 0 : null);
  const page = nonNegativeInteger(summary.page);
  const pageSize = nonNegativeInteger(summary.pageSize);
  const returned = nonNegativeInteger(summary.returned);
  if (
    visibleTotal === null ||
    eligibleTotal === null ||
    page === null ||
    page < 1 ||
    pageSize === null ||
    pageSize < 1 ||
    returned === null
  )
    return { ok: false, code: "invalid_response" };
  if (legacyTotal !== null && legacyTotal !== visibleTotal)
    return { ok: false, code: "invalid_response" };
  if (
    eligibleTotal < visibleTotal ||
    returned !== results.length ||
    returned > pageSize
  )
    return { ok: false, code: "invalid_response" };
  const totalPages = Math.max(1, Math.ceil(visibleTotal / pageSize));
  if (
    page > totalPages ||
    (visibleTotal === 0 && (page !== 1 || returned !== 0))
  )
    return { ok: false, code: "invalid_response" };
  const remaining = Math.max(0, visibleTotal - (page - 1) * pageSize);
  if (returned > Math.min(pageSize, remaining))
    return { ok: false, code: "invalid_response" };

  const totalDocuments = finiteNonNegative(summary.totalDocuments);
  const verifiedVisible = finiteNonNegative(summary.verifiedVisible);
  const supportedVisible = finiteNonNegative(summary.supportedVisible);
  const relatedVisible = finiteNonNegative(summary.relatedVisible);
  const appliedMinimumScore = finiteNonNegative(summary.appliedMinimumScore);
  const appliedMatchQuality = summary.appliedMatchQuality;
  if (
    totalDocuments === null ||
    verifiedVisible === null ||
    supportedVisible === null ||
    relatedVisible === null ||
    appliedMinimumScore === null ||
    !["any", "relevant", "strong"].includes(String(appliedMatchQuality))
  )
    return { ok: false, code: "invalid_response" };
  if (verifiedVisible + supportedVisible + relatedVisible > visibleTotal)
    return { ok: false, code: "invalid_response" };

  const requestPage = nonNegativeInteger(request.page);
  const requestPageSize = nonNegativeInteger(request.pageSize);
  const requestMinimumScore = finiteNonNegative(request.minimumScore);
  if (
    typeof request.query !== "string" ||
    typeof request.mode !== "string" ||
    requestPage !== page ||
    requestPageSize !== pageSize ||
    requestMinimumScore === null
  )
    return { ok: false, code: "invalid_response" };

  return {
    ok: true,
    response: {
      ...(value as NormalizedSearchV2Response),
      generatedAt:
        typeof value.generatedAt === "string" ? value.generatedAt : "",
      request: {
        query: request.query,
        mode: request.mode,
        page,
        pageSize,
        minimumScore: requestMinimumScore,
      },
      summary: {
        totalDocuments,
        totalMatched: visibleTotal,
        eligibleTotal,
        visibleTotal,
        verifiedVisible,
        supportedVisible,
        relatedVisible,
        appliedMinimumScore,
        appliedMatchQuality:
          appliedMatchQuality as SearchV2ClientSummary["appliedMatchQuality"],
        returned,
        page,
        pageSize,
      },
      results,
    },
  };
}

export function reconcileSearchV2Response({
  payload,
  requestId,
  latestRequestId,
  aborted,
  requestTalentPool,
  activeTalentPool,
  requestSourceRevision,
  activeSourceRevision,
}: {
  payload: unknown;
  requestId: number;
  latestRequestId: number;
  aborted: boolean;
  requestTalentPool: "internal_profiles" | "linkedin_talent_pool";
  activeTalentPool: "internal_profiles" | "linkedin_talent_pool";
  requestSourceRevision: number;
  activeSourceRevision: number;
}): SearchV2ResponseReconciliation {
  if (
    aborted ||
    requestId !== latestRequestId ||
    requestTalentPool !== activeTalentPool ||
    requestSourceRevision !== activeSourceRevision
  )
    return { status: "stale" };

  const normalized = normalizeSearchV2Response(payload);
  return normalized.ok
    ? { status: "accepted", response: normalized.response }
    : { status: "invalid", code: normalized.code };
}

export function searchV2RenderVisibility(
  hasCommittedSnapshot: boolean,
  loading: boolean,
) {
  return {
    showReadyState: false,
    showResults: hasCommittedSnapshot,
  };
}

export function buildExternalSearchV2ClientResponse<
  ExternalItem,
  Result,
  ExternalResult extends {
    items: ExternalItem[];
    evaluatedTotal: number;
    eligibleEvaluatedTotal: number;
  },
>({
  externalResult,
  results,
  generatedAt,
  requestId,
  request,
}: {
  externalResult: ExternalResult;
  results: Result[];
  generatedAt: string;
  requestId: string;
  request: {
    query: string;
    mode: string;
    page: number;
    pageSize: number;
    minimumScore: number;
    matchQuality: SearchV2ClientSummary["appliedMatchQuality"];
  };
}) {
  return {
    ...externalResult,
    externalItems: externalResult.items,
    items: results,
    results,
    generatedAt,
    request: {
      query: request.query,
      mode: request.mode,
      page: request.page,
      pageSize: request.pageSize,
      minimumScore: request.minimumScore,
    },
    summary: {
      totalDocuments: externalResult.evaluatedTotal,
      totalMatched: externalResult.eligibleEvaluatedTotal,
      eligibleTotal: externalResult.eligibleEvaluatedTotal,
      visibleTotal: externalResult.eligibleEvaluatedTotal,
      verifiedVisible: 0,
      supportedVisible: 0,
      relatedVisible: 0,
      appliedMinimumScore: request.minimumScore,
      appliedMatchQuality: request.matchQuality,
      returned: results.length,
      page: request.page,
      pageSize: request.pageSize,
    },
    safety: {
      readOnly: true,
      candidateWrites: 0,
      workflowWrites: 0,
      automaticShortlists: 0,
      emailSends: 0,
    },
    source: "external_talent_network" as const,
    requestId,
    wording: `${externalResult.evaluatedTotal} external profiles sampled; ${externalResult.eligibleEvaluatedTotal} matched current criteria`,
  };
}

export function emptySearchV2Response(): NormalizedSearchV2Response {
  return {
    generatedAt: "",
    request: {
      query: "",
      mode: "hybrid",
      page: 1,
      pageSize: 20,
      minimumScore: 0,
    },
    summary: {
      totalDocuments: 0,
      totalMatched: 0,
      eligibleTotal: 0,
      visibleTotal: 0,
      verifiedVisible: 0,
      supportedVisible: 0,
      relatedVisible: 0,
      appliedMinimumScore: 0,
      appliedMatchQuality: "any",
      returned: 0,
      page: 1,
      pageSize: 20,
    },
    results: [],
    safety: {
      readOnly: true,
      candidateWrites: 0,
      workflowWrites: 0,
      automaticShortlists: 0,
      emailSends: 0,
    },
  };
}
