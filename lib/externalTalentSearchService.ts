import { createHash } from "node:crypto";
import type { CandidateSearchV2Request } from "@/lib/candidateSearchV2Types";
import type { CommittedSearchRequirements } from "@/lib/searchV2CommittedRequirements";
import {
  ExternalSourceError,
  mapSearchV2ToExternalProvider,
  type ExternalProviderSearchRequest,
} from "@/lib/externalCandidateSourceProvider";
import { deterministicExternalSearchPlan } from "@/lib/externalTalentSearchPlan";
import { buildExternalMarketMapping } from "@/lib/externalMarketMapping";
import { externalTalentProvider } from "@/lib/externalTalentProviderRegistry";
import { validateExternalProfileUrl } from "@/lib/externalProfileUrl";
import {
  EXTERNAL_RANKING_VERSION,
  evaluateExternalCandidate,
  sortExternalCandidates,
} from "@/lib/externalTalentScoring";
import type {
  ExternalTalentCandidate,
  ExternalTalentSearchResponse,
} from "@/lib/externalTalentTypes";

type ExternalSnapshot = {
  items: ExternalTalentCandidate[];
  sourceRequestId: string;
  sourceRequestIds: string[];
  windowId: string;
  plan: ReturnType<typeof deterministicExternalSearchPlan>;
  providerFilters: ExternalProviderSearchRequest["filters"];
  providerPagination: "cursor" | "page" | "none";
  providerRequestSize: number;
  providerCursor: string | null;
  loadMoreToken: string | null;
  providerExhausted: boolean;
  loadingBatch: boolean;
  seenProviderCursors: Set<string>;
  seenCandidateKeys: Set<string>;
  completedBatchTokens: Set<string>;
  loadedExternalTotal: number;
  providerRecordsFetched: number;
  recordsNormalized: number;
  invalidRecords: number;
  duplicateRecords: number;
  batchCount: number;
  lastBatch: ExternalTalentSearchResponse["aggregation"]["lastBatch"];
  committedSearchId: string;
  marketMapping: ReturnType<typeof buildExternalMarketMapping>;
  marketQueryIndex: number;
  minimumScore: number;
  rejectionSummary: ExternalTalentSearchResponse["rejectionSummary"];
};
const snapshots = new Map<string, ExternalSnapshot>();
const identity = (
  request: CandidateSearchV2Request,
  authorizationScopeHash: string,
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        query: request.query,
        filters: request.filters,
        criteria: request.criteria,
        minimumScore: Math.max(0, Number(request.minimumScore) || 0),
        includeRelocationRemote: request.includeRelocationRemote,
        externalVerifiedOnly: request.externalVerifiedOnly === true,
        authorizationScopeHash,
        version: EXTERNAL_RANKING_VERSION,
      }),
    )
    .digest("hex")
    .slice(0, 24);
const windowIdentity = (items: ExternalTalentCandidate[]) =>
  createHash("sha256")
    .update(
      items
        .map((item) => `${item.externalCandidateId}:${item.overallMatchScore}`)
        .join("|"),
    )
    .digest("hex")
    .slice(0, 16);
const continuationToken = (snapshot: ExternalSnapshot) =>
  createHash("sha256")
    .update(
      [
        snapshot.committedSearchId,
        snapshot.marketQueryIndex + 1,
        snapshot.providerCursor || "next-market-segment",
        EXTERNAL_RANKING_VERSION,
      ].join(":"),
    )
    .digest("base64url")
    .slice(0, 32);
const candidateKeys = (candidate: {
  externalCandidateId: string;
  profileUrl?: string;
}) => {
  let canonicalUrl = "";
  if (candidate.profileUrl) {
    try {
      const url = new URL(candidate.profileUrl);
      canonicalUrl =
        url.hostname.toLocaleLowerCase().replace(/^www\./, "") +
        url.pathname.normalize("NFKC").replace(/\/+$/, "").toLocaleLowerCase();
    } catch {
      canonicalUrl = candidate.profileUrl
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase()
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "");
    }
  }
  return [
    `id:${candidate.externalCandidateId.normalize("NFKC").trim().toLocaleLowerCase()}`,
    ...(canonicalUrl ? [`url:${canonicalUrl}`] : []),
  ];
};

function normalizeExternalBatch(
  raw: Awaited<ReturnType<ReturnType<typeof externalTalentProvider>["search"]>>,
  snapshot: ExternalSnapshot,
) {
  const accepted: ExternalTalentCandidate[] = [];
  let uniqueLoaded = 0;
  let invalidRecords = 0;
  let duplicateRecords = 0;
  let confirmedExclusions = 0;
  for (const candidate of raw.candidates) {
    if (
      snapshot.loadedExternalTotal + uniqueLoaded >=
      snapshot.marketMapping.profileLimit
    )
      break;
    const checkedUrl = validateExternalProfileUrl(candidate.profileUrl);
    if (!checkedUrl) {
      invalidRecords += 1;
      continue;
    }
    const keys = candidateKeys({
      externalCandidateId: candidate.externalCandidateId,
      profileUrl: checkedUrl.url,
    });
    if (keys.some((key) => snapshot.seenCandidateKeys.has(key))) {
      duplicateRecords += 1;
      continue;
    }
    keys.forEach((key) => snapshot.seenCandidateKeys.add(key));
    uniqueLoaded += 1;
    const evidence = candidate.providerEvidence.map((item) => ({
      ...item,
      label:
        item.requirementId === "source"
          ? "Provider evidence"
          : item.requirementId,
      sourceUrl: checkedUrl.url,
    }));
    const evaluated = evaluateExternalCandidate(
      {
        source: "external_talent_network",
        provider: "exa",
        externalCandidateId: candidate.externalCandidateId,
        displayName: candidate.displayName,
        profileTitle: candidate.profileTitle,
        headline: candidate.headline,
        currentTitle: candidate.currentTitle,
        location: candidate.location,
        currentEmployer: candidate.currentEmployer,
        skills: candidate.skills || [],
        experienceSummary: candidate.experienceSummary,
        employmentText: candidate.employmentText || [],
        projectText: candidate.projectText || [],
        education: candidate.education || [],
        certifications: candidate.certifications || [],
        totalYearsExperience: candidate.totalYearsExperience ?? null,
        employmentRecords: candidate.employmentRecords || [],
        experienceCalculation: candidate.experienceCalculation,
        profileProvenance: candidate.profileProvenance,
        profileUrl: checkedUrl.url,
        profileUrlDomain: checkedUrl.domain,
        providerEvidence: evidence,
        sourceRequestId: raw.sourceRequestId,
        providerRank: snapshot.loadedExternalTotal + uniqueLoaded,
        explanationStatus: "grounded",
        duplicateReviewStatus: "not_reviewed",
      },
      snapshot.plan,
    );
    snapshot.rejectionSummary.evaluated += 1;
    if (evaluated.eligible) snapshot.rejectionSummary.eligible += 1;
    if (evaluated.candidate.eligibilityState === "evidence_supported")
      snapshot.rejectionSummary.evidenceSupported += 1;
    else if (
      evaluated.candidate.eligibilityState === "potential_needs_verification"
    )
      snapshot.rejectionSummary.needsVerification += 1;
    else {
      snapshot.rejectionSummary.confirmedExcluded += 1;
      confirmedExclusions += 1;
    }
    for (const requirement of evaluated.candidate.requirementEvaluations) {
      const aggregate = snapshot.rejectionSummary.requirements.find(
        (item) => item.requirementId === requirement.id,
      );
      if (!aggregate) continue;
      if (requirement.state === "confirmed_fail") {
        aggregate.contradictedCount += 1;
        aggregate.confirmedFailCount += 1;
      } else if (requirement.state === "needs_verification") {
        aggregate.unverifiedCount += 1;
        aggregate.needsVerificationCount += 1;
      } else {
        aggregate.supportedCount += 1;
        aggregate.confirmedPassCount += 1;
      }
    }
    // Eligibility and match quality are independent gates. Missing provider
    // evidence may keep a candidate eligible for review, but it must never
    // bypass the recruiter-selected score threshold.
    const passesScoreThreshold =
      evaluated.candidate.overallMatchScore >= snapshot.minimumScore;
    if (evaluated.eligible && passesScoreThreshold)
      accepted.push(evaluated.candidate);
  }
  const providerRecordsFetched =
    typeof raw.providerResultCount === "number" &&
    Number.isFinite(raw.providerResultCount)
      ? Math.max(raw.candidates.length, Math.round(raw.providerResultCount))
      : raw.candidates.length;
  snapshot.providerRecordsFetched += providerRecordsFetched;
  snapshot.recordsNormalized += raw.candidates.length;
  snapshot.invalidRecords += invalidRecords;
  snapshot.duplicateRecords += duplicateRecords;
  snapshot.loadedExternalTotal += uniqueLoaded;
  snapshot.items = sortExternalCandidates([...snapshot.items, ...accepted]);
  snapshot.sourceRequestId = raw.sourceRequestId;
  snapshot.sourceRequestIds.push(raw.sourceRequestId);
  snapshot.windowId = windowIdentity(snapshot.items);
  const next =
    typeof raw.nextCursor === "string" && raw.nextCursor.trim()
      ? raw.nextCursor
      : null;
  const profileLimitReached =
    snapshot.loadedExternalTotal >= snapshot.marketMapping.profileLimit;
  const hasNextMarketSegment =
    snapshot.providerPagination === "none" &&
    snapshot.marketQueryIndex + 1 < snapshot.marketMapping.queries.length;
  snapshot.providerExhausted =
    snapshot.providerPagination === "none"
      ? profileLimitReached || !hasNextMarketSegment
      : raw.candidates.length === 0 ||
        !next ||
        snapshot.seenProviderCursors.has(next);
  snapshot.providerCursor =
    snapshot.providerPagination === "none" || snapshot.providerExhausted
      ? null
      : next;
  if (next) snapshot.seenProviderCursors.add(next);
  snapshot.loadMoreToken = snapshot.providerExhausted
    ? null
    : continuationToken(snapshot);
  snapshot.batchCount += 1;
  snapshot.lastBatch = {
    batchNumber: snapshot.batchCount,
    segmentIndex: snapshot.marketQueryIndex,
    providerRecordsFetched,
    recordsNormalized: raw.candidates.length,
    invalidRecords,
    duplicateRecords,
    newUniqueProfiles: uniqueLoaded,
    confirmedExclusions,
    eligibleProfilesAdded: accepted.length,
    replayed: false,
  };
}

export async function executeExternalTalentSearch(
  request: CandidateSearchV2Request,
  signal?: AbortSignal,
  context: {
    authorizationScopeHash?: string;
    committedRequirements?: CommittedSearchRequirements;
  } = {},
): Promise<ExternalTalentSearchResponse> {
  const started = performance.now();
  const committedSearchId = identity(
    request,
    context.authorizationScopeHash || "anonymous",
  );
  let snapshot = snapshots.get(committedSearchId);
  let replayedBatch = false;
  let queryMappingMs = 0,
    providerMs = 0,
    normalizationMs = 0,
    eligibilityMs = 0,
    scoringMs = 0;
  const warnings: string[] = [];
  if (!snapshot && request.externalBatchCursor)
    throw new ExternalSourceError(
      "INVALID_PROVIDER_CURSOR",
      "This External Talent Network batch cursor does not belong to the current search.",
    );
  if (!snapshot) {
    const planStart = performance.now();
    const plan = deterministicExternalSearchPlan(
      request,
      context.committedRequirements,
    );
    queryMappingMs = performance.now() - planStart;
    const provider = externalTalentProvider();
    const capability = await provider.capability();
    if (!capability.ready)
      throw new ExternalSourceError(
        capability.reason || "SOURCE_NOT_CONFIGURED",
        "External Talent Network is not configured.",
      );
    const mappedRequest = mapSearchV2ToExternalProvider(request, capability);
    if (mappedRequest.unsupportedRequiredFilters.length)
      warnings.push(
        `Provider retrieval does not natively filter ${mappedRequest.unsupportedRequiredFilters.join(", ")}; grounded eligibility evaluation was applied locally.`,
      );
    const marketMapping = buildExternalMarketMapping({ plan });
    const providerStart = performance.now();
    const raw = await provider.search(
      {
        source: "linkedin_talent_pool",
        committedSearchId,
        query: marketMapping.queries[0],
        filters: mappedRequest.filters,
        pageSize:
          capability.pagination === "none" ? marketMapping.requestSize : 50,
      },
      signal,
    );
    providerMs = performance.now() - providerStart;
    const normalizeStart = performance.now();
    snapshot = {
      items: [],
      sourceRequestId: raw.sourceRequestId,
      sourceRequestIds: [],
      windowId: "",
      plan,
      providerFilters: mappedRequest.filters,
      providerPagination: capability.pagination,
      providerRequestSize:
        capability.pagination === "none" ? marketMapping.requestSize : 50,
      providerCursor: null,
      loadMoreToken: null,
      providerExhausted: false,
      loadingBatch: false,
      seenProviderCursors: new Set(),
      seenCandidateKeys: new Set(),
      completedBatchTokens: new Set(),
      loadedExternalTotal: 0,
      providerRecordsFetched: 0,
      recordsNormalized: 0,
      invalidRecords: 0,
      duplicateRecords: 0,
      batchCount: 0,
      lastBatch: {
        batchNumber: 0,
        segmentIndex: 0,
        providerRecordsFetched: 0,
        recordsNormalized: 0,
        invalidRecords: 0,
        duplicateRecords: 0,
        newUniqueProfiles: 0,
        confirmedExclusions: 0,
        eligibleProfilesAdded: 0,
        replayed: false,
      },
      committedSearchId,
      marketMapping,
      marketQueryIndex: 0,
      minimumScore: Math.max(0, Number(request.minimumScore) || 0),
      rejectionSummary: {
        evaluated: 0,
        eligible: 0,
        evidenceSupported: 0,
        needsVerification: 0,
        confirmedExcluded: 0,
        requirements: plan.requirements.map((requirement) => ({
          requirementId: requirement.id,
          label: requirement.label,
          contradictedCount: 0,
          unverifiedCount: 0,
          supportedCount: 0,
          confirmedPassCount: 0,
          needsVerificationCount: 0,
          confirmedFailCount: 0,
          providerCapability: requirement.providerCapability,
        })),
      },
    };
    normalizeExternalBatch(raw, snapshot);
    normalizationMs = performance.now() - normalizeStart;
    const scoreStart = performance.now();
    snapshot.items = sortExternalCandidates(snapshot.items);
    snapshot.windowId = windowIdentity(snapshot.items);
    scoringMs = performance.now() - scoreStart;
    snapshots.set(committedSearchId, snapshot);
  }
  if (request.externalBatchCursor) {
    const requestedBatchToken = request.externalBatchCursor;
    if (snapshot.completedBatchTokens.has(requestedBatchToken)) {
      replayedBatch = true;
    } else {
      if (
        snapshot.providerExhausted ||
        (!snapshot.providerCursor &&
          !(
            snapshot.providerPagination === "none" &&
            snapshot.marketQueryIndex + 1 <
              snapshot.marketMapping.queries.length
          )) ||
        requestedBatchToken !== snapshot.loadMoreToken
      )
        throw new ExternalSourceError(
          "INVALID_PROVIDER_CURSOR",
          "This External Talent Network batch cursor is no longer valid.",
        );
      if (snapshot.loadingBatch)
        throw new ExternalSourceError(
          "RATE_LIMITED",
          "The next External Talent Network batch is already loading.",
        );
      snapshot.loadingBatch = true;
      const providerCursor = snapshot.providerCursor;
      const nextMarketQueryIndex = providerCursor
        ? snapshot.marketQueryIndex
        : snapshot.marketQueryIndex + 1;
      try {
        const provider = externalTalentProvider();
        const providerStart = performance.now();
        const raw = await provider.search(
          {
            source: "linkedin_talent_pool",
            committedSearchId,
            query:
              snapshot.marketMapping.queries[nextMarketQueryIndex] ||
              snapshot.plan.semanticQuery,
            filters: snapshot.providerFilters,
            pageSize: snapshot.providerRequestSize,
            ...(providerCursor ? { providerCursor } : {}),
          },
          signal,
        );
        providerMs = performance.now() - providerStart;
        const normalizeStart = performance.now();
        snapshot.marketQueryIndex = nextMarketQueryIndex;
        normalizeExternalBatch(raw, snapshot);
        normalizationMs = performance.now() - normalizeStart;
        snapshot.completedBatchTokens.add(requestedBatchToken);
      } finally {
        snapshot.loadingBatch = false;
      }
    }
  }
  const requestedPage = Math.max(1, Number(request.page) || 1);
  const requestedOffset = (requestedPage - 1) * 20;
  let offset = requestedOffset;
  if (request.cursor) {
    try {
      const parsed = JSON.parse(
        Buffer.from(request.cursor, "base64url").toString("utf8"),
      );
      if (
        parsed.version !== EXTERNAL_RANKING_VERSION ||
        parsed.search !== committedSearchId ||
        parsed.window !== snapshot.windowId ||
        !Number.isInteger(parsed.offset) ||
        parsed.offset !== requestedOffset
      )
        throw new Error();
      offset = parsed.offset;
    } catch {
      throw new ExternalSourceError(
        "INVALID_PROVIDER_CURSOR",
        "This External Talent Network cursor is no longer valid.",
      );
    }
  }
  if (
    (snapshot.items.length === 0 && requestedPage !== 1) ||
    (snapshot.items.length > 0 && offset >= snapshot.items.length)
  )
    throw new ExternalSourceError(
      "INVALID_PROVIDER_CURSOR",
      "This External Talent Network result page is no longer available.",
    );
  const items = snapshot.items.slice(offset, offset + 20);
  const nextOffset = offset + 20;
  const nextCursor =
    nextOffset < snapshot.items.length
      ? Buffer.from(
          JSON.stringify({
            version: EXTERNAL_RANKING_VERSION,
            search: committedSearchId,
            window: snapshot.windowId,
            offset: nextOffset,
          }),
          "utf8",
        ).toString("base64url")
      : null;
  const classifiedTotal =
    snapshot.rejectionSummary.evidenceSupported +
    snapshot.rejectionSummary.needsVerification +
    snapshot.rejectionSummary.confirmedExcluded;
  if (classifiedTotal !== snapshot.loadedExternalTotal)
    throw new ExternalSourceError(
      "INVALID_PROVIDER_RESPONSE",
      "External Talent Network aggregation counts did not reconcile.",
    );
  const remainingLoadedResults = Math.max(
    0,
    snapshot.items.length - (offset + items.length),
  );
  return {
    items,
    evaluatedTotal: snapshot.loadedExternalTotal,
    eligibleEvaluatedTotal: snapshot.items.length,
    loadedExternalTotal: snapshot.loadedExternalTotal,
    bucketCounts: {
      strong: snapshot.items.filter((item) => item.matchTier === "Strong Match")
        .length,
      good: snapshot.items.filter((item) => item.matchTier === "Good Match")
        .length,
      potential: snapshot.items.filter(
        (item) => item.matchTier === "Potential Match",
      ).length,
    },
    nextCursor,
    nextProviderBatchCursor: snapshot.loadMoreToken,
    providerExhausted: snapshot.providerExhausted,
    committedSearchId,
    rankingVersion: EXTERNAL_RANKING_VERSION,
    evaluatedWindowId: snapshot.windowId,
    provider: "exa",
    sourceRequestId: snapshot.sourceRequestId,
    timing: {
      requestReceivedMs: 0,
      queryMappingMs,
      providerMs,
      normalizationMs,
      eligibilityMs,
      scoringMs,
      serializationMs: 0,
      optionalClaudeMs: null,
      totalMs: performance.now() - started,
    },
    warnings: [
      ...warnings,
      snapshot.providerExhausted
        ? snapshot.providerPagination === "none"
          ? `Broad market mapping completed across ${snapshot.marketQueryIndex + 1} provider query segments. Results are evidence-grounded provider data, not an exhaustive LinkedIn market list.`
          : "The connected provider returned no continuation cursor. Results are a provider sample, not an exhaustive market list."
        : `${snapshot.loadedExternalTotal} unique external profiles mapped; more market segments are available.`,
    ],
    unsupportedRequirements: snapshot.plan.unsupportedRequirements,
    providerCapabilityWarnings: snapshot.plan.providerCapabilityWarnings,
    strictVerifiedOnly: snapshot.plan.strictVerifiedOnly,
    poolCounts: {
      evidenceSupported: snapshot.rejectionSummary.evidenceSupported,
      needsVerification: snapshot.rejectionSummary.needsVerification,
      confirmedExcluded: snapshot.rejectionSummary.confirmedExcluded,
    },
    rejectionSummary: snapshot.rejectionSummary,
    marketMapping: {
      version: snapshot.marketMapping.version,
      segmentsCompleted: snapshot.marketQueryIndex + 1,
      segmentsPlanned: snapshot.marketMapping.queries.length,
      profileLimit: snapshot.marketMapping.profileLimit,
      requestSize: snapshot.providerRequestSize,
    },
    aggregation: {
      providerRecordsFetched: snapshot.providerRecordsFetched,
      recordsNormalized: snapshot.recordsNormalized,
      invalidRecords: snapshot.invalidRecords,
      duplicateRecords: snapshot.duplicateRecords,
      uniqueProfiles: snapshot.loadedExternalTotal,
      evidenceSupported: snapshot.rejectionSummary.evidenceSupported,
      needsVerification: snapshot.rejectionSummary.needsVerification,
      confirmedExclusions: snapshot.rejectionSummary.confirmedExcluded,
      eligibleVisibleResults: snapshot.items.length,
      currentlyRenderedResults: items.length,
      remainingLoadedResults,
      additionalProviderSegmentsAvailable: Boolean(snapshot.loadMoreToken),
      lastBatch: {
        ...snapshot.lastBatch,
        replayed: replayedBatch,
      },
    },
  };
}
