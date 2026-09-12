import { createHash, randomUUID } from "node:crypto";
import type { CandidateSearchV2Request } from "@/lib/candidateSearchV2Types";
import type { CommittedSearchRequirements } from "@/lib/searchV2CommittedRequirements";
import {
  ExternalSourceError,
  mapSearchV2ToExternalProvider,
  type ExternalProviderSearchRequest,
} from "@/lib/externalCandidateSourceProvider";
import { deterministicExternalSearchPlan } from "@/lib/externalTalentSearchPlan";
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
  providerCursor: string | null;
  loadMoreToken: string | null;
  providerExhausted: boolean;
  loadingBatch: boolean;
  seenProviderCursors: Set<string>;
  seenCandidateKeys: Set<string>;
  loadedExternalTotal: number;
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
const candidateKeys = (candidate: {
  externalCandidateId: string;
  profileUrl?: string;
}) => [
  `id:${candidate.externalCandidateId.normalize("NFKC").trim().toLocaleLowerCase()}`,
  ...(candidate.profileUrl
    ? [
        `url:${candidate.profileUrl.normalize("NFKC").trim().toLocaleLowerCase().replace(/\/$/, "")}`,
      ]
    : []),
];

function normalizeExternalBatch(
  raw: Awaited<ReturnType<ReturnType<typeof externalTalentProvider>["search"]>>,
  snapshot: ExternalSnapshot,
) {
  const accepted: ExternalTalentCandidate[] = [];
  let uniqueLoaded = 0;
  for (const candidate of raw.candidates) {
    const checkedUrl = validateExternalProfileUrl(candidate.profileUrl);
    if (!checkedUrl) continue;
    const keys = candidateKeys({
      externalCandidateId: candidate.externalCandidateId,
      profileUrl: checkedUrl.url,
    });
    if (keys.some((key) => snapshot.seenCandidateKeys.has(key))) continue;
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
    for (const requirement of evaluated.candidate.requirementEvaluations) {
      const aggregate = snapshot.rejectionSummary.requirements.find(
        (item) => item.requirementId === requirement.id,
      );
      if (!aggregate) continue;
      if (requirement.state === "conflicting") aggregate.contradictedCount += 1;
      else if (requirement.state === "unverified") aggregate.unverifiedCount += 1;
      else aggregate.supportedCount += 1;
    }
    if (
      evaluated.eligible &&
      evaluated.candidate.overallMatchScore >= snapshot.minimumScore
    )
      accepted.push(evaluated.candidate);
  }
  snapshot.loadedExternalTotal += uniqueLoaded;
  snapshot.items = sortExternalCandidates([...snapshot.items, ...accepted]);
  snapshot.sourceRequestId = raw.sourceRequestId;
  snapshot.sourceRequestIds.push(raw.sourceRequestId);
  snapshot.windowId = windowIdentity(snapshot.items);
  const next =
    typeof raw.nextCursor === "string" && raw.nextCursor.trim()
      ? raw.nextCursor
      : null;
  snapshot.providerExhausted =
    raw.candidates.length === 0 ||
    !next ||
    snapshot.seenProviderCursors.has(next);
  snapshot.providerCursor = snapshot.providerExhausted ? null : next;
  if (next) snapshot.seenProviderCursors.add(next);
  snapshot.loadMoreToken = snapshot.providerExhausted ? null : randomUUID();
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
    const providerStart = performance.now();
    const raw = await provider.search(
      {
        source: "linkedin_talent_pool",
        committedSearchId,
        query: plan.semanticQuery,
        filters: mappedRequest.filters,
        pageSize: 50,
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
      providerCursor: null,
      loadMoreToken: null,
      providerExhausted: false,
      loadingBatch: false,
      seenProviderCursors: new Set(),
      seenCandidateKeys: new Set(),
      loadedExternalTotal: 0,
      minimumScore: Math.max(0, Number(request.minimumScore) || 0),
      rejectionSummary: {
        evaluated: 0,
        eligible: 0,
        requirements: plan.requirements.map((requirement) => ({
          requirementId: requirement.id,
          label: requirement.label,
          contradictedCount: 0,
          unverifiedCount: 0,
          supportedCount: 0,
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
    if (
      snapshot.providerExhausted ||
      !snapshot.providerCursor ||
      request.externalBatchCursor !== snapshot.loadMoreToken
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
    try {
      const provider = externalTalentProvider();
      const providerStart = performance.now();
      const raw = await provider.search(
        {
          source: "linkedin_talent_pool",
          committedSearchId,
          query: snapshot.plan.semanticQuery,
          filters: snapshot.providerFilters,
          pageSize: 50,
          providerCursor,
        },
        signal,
      );
      providerMs = performance.now() - providerStart;
      const normalizeStart = performance.now();
      normalizeExternalBatch(raw, snapshot);
      normalizationMs = performance.now() - normalizeStart;
    } finally {
      snapshot.loadingBatch = false;
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
        ? "All available external profiles for this search have been loaded."
        : `${snapshot.loadedExternalTotal} external profiles loaded and evaluated.`,
    ],
    unsupportedRequirements: snapshot.plan.unsupportedRequirements,
    rejectionSummary: snapshot.rejectionSummary,
  };
}
