import { NextRequest, NextResponse } from "next/server";

import { adaptCandidatesToSearchV2Documents } from "@/lib/candidateSearchV2Adapter";

import {
  paginateRankedCandidatesV2,
  rankCandidatesV2,
  searchCanonicalCandidatesByIntent,
  type SearchV2EngineTimings,
} from "@/lib/candidateSearchV2Engine";

import { dedupeCandidateSearchV2Documents } from "@/lib/candidateSearchV2Projection";
import {
  hasContextualImplementationProjectEvidence,
  hasContextualSapModuleEvidence,
} from "@/lib/sapModuleEvidenceContext";
import { parseRecruiterSearchIntent } from "@/lib/recruiterSearchPresentation";
import {
  SEARCH_V2_CACHE_VERSION,
  SEARCH_V2_VERSION,
} from "@/lib/searchV2Shared";
import {
  searchV2DiagnosticHeaders,
  searchV2ExecutionProfileHash,
  searchV2ServerHash,
} from "@/lib/searchV2Server";
import {
  fetchCandidateSourceByIdentityToken,
  fetchCandidateSource,
  prewarmCandidateSearchV2Dataset,
  searchV2ProjectionReadiness,
} from "@/lib/searchV2Dataset";
import { searchV2ReadinessHttpContract } from "@/lib/searchV2ReadinessContract";
import {
  buildSearchExecutionProfile,
  executionProfileRequest,
  inferSearchMatchQuality,
  searchV2TierCounts,
  visibleSearchV2Results,
  type SearchExecutionProfile,
  type SearchMatchQuality,
} from "@/lib/searchV2ExecutionProfile";
import {
  applySearchIntegrity,
  SEARCH_INTEGRITY_VERSION,
} from "@/lib/searchIntegrityV20";
import type { GuidedSearchHandoff } from "@/lib/guidedSourcingTypes";

import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
  CandidateSearchV2Result,
} from "@/lib/candidateSearchV2Types";
import {
  buildCommittedSearchRequirements,
  type SearchV2EligibilityDiagnostic,
} from "@/lib/searchV2CommittedRequirements";
import { ExternalSourceError } from "@/lib/externalCandidateSourceProvider";
import { externalTalentProvider } from "@/lib/externalTalentProviderRegistry";
import { executeExternalTalentSearch } from "@/lib/externalTalentSearchService";
import { buildExternalSearchV2ClientResponse } from "@/lib/searchV2ResponseContract";
import { externalCanonicalResultProjection } from "@/lib/externalTalentProjection";
import type { ExternalTalentCandidate } from "@/lib/externalTalentTypes";
import { cleanCandidatePresentationText } from "@/lib/candidatePresentationText";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";
import { sanitizeSearchV2RecruiterResponse } from "@/lib/searchV2RecruiterResponse";
import {
  canonicalLookupMatches,
  confirmSearchV2IdentityIntent,
  detectSearchV2UnifiedIntent,
  identityOnlyCandidateProjection,
} from "@/lib/searchV2UnifiedIntent";
import { normalizeSearchV2Query } from "@/lib/searchV2QueryNormalization";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

type SearchV2Body = CandidateSearchV2Request & {
  documents?: CandidateSearchV2Document[];

  candidates?: unknown[];

  matchQuality?: SearchMatchQuality;
  integrityPlan?: GuidedSearchHandoff["integrityPlan"];
};

const SEARCH_RANKING_CACHE_VERSION = SEARCH_V2_CACHE_VERSION;
const SEARCH_RANKING_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_RANKING_CACHE_MAX_ENTRIES = 25;
type CanonicalDatasetProjection = ReturnType<
  typeof dedupeCandidateSearchV2Documents
>;
const globalCanonicalDataset = globalThis as typeof globalThis & {
  __searchV2CanonicalDatasetV1?: {
    version: string;
    datasetRevision: string;
    projection: CanonicalDatasetProjection;
  };
};
function canonicalDatasetProjection(
  documents: CandidateSearchV2Document[],
  datasetRevision: string,
) {
  const cached = globalCanonicalDataset.__searchV2CanonicalDatasetV1;
  if (
    cached?.version === SEARCH_RANKING_CACHE_VERSION &&
    cached.datasetRevision === datasetRevision
  )
    return { projection: cached.projection, cacheHit: true };
  const projection = dedupeCandidateSearchV2Documents(documents);
  globalCanonicalDataset.__searchV2CanonicalDatasetV1 = {
    version: SEARCH_RANKING_CACHE_VERSION,
    datasetRevision,
    projection,
  };
  return { projection, cacheHit: false };
}
let engineReadinessPromise: Promise<void> | null = null;
function ensureSearchV2EngineReady() {
  if (engineReadinessPromise) return engineReadinessPromise;
  engineReadinessPromise = fetchCandidateSource()
    .then((dataset) => {
      const canonical = canonicalDatasetProjection(
        dataset.documents,
        dataset.revision,
      ).projection.documents;
      rankCandidatesV2(
        canonical,
        {
          query:
            "Senior SAP FICO Consultant in Malaysia with Mandarin and at least 8 years of experience",
          mode: "hybrid",
          talentPool: "internal_profiles",
          filters: { deliveryExperience: ["Implementation"] },
          criteria: [
            {
              id: "prewarm-delivery",
              label: "Demonstrated SAP FICO implementation depth",
              conceptId: "FICO",
              importance: "most_important",
              source: "ai_suggestion",
            },
            {
              id: "prewarm-leadership",
              label: "Delivery ownership and stakeholder leadership",
              importance: "important",
              source: "ai_suggestion",
            },
          ],
          page: 1,
          pageSize: 1,
        },
        undefined,
        true,
      );
    })
    .catch((error) => {
      engineReadinessPromise = null;
      throw error;
    });
  return engineReadinessPromise;
}
type RankedSearchCacheEntry = {
  createdAt: number;
  generatedAt: string;
  rankedResults: CandidateSearchV2Result[];
  totalDocuments: number;
  eligibleTotal: number;
  eligibilityDiagnostic?: SearchV2EligibilityDiagnostic;
  source: Record<string, unknown>;
};
const globalSearchCache = globalThis as typeof globalThis & {
  __candidateSearchV2RankedCache?: Map<string, RankedSearchCacheEntry>;
};
const rankedSearchCache = (globalSearchCache.__candidateSearchV2RankedCache ||=
  new Map<string, RankedSearchCacheEntry>());
const removeRankedSearch = (key: string) =>
  Reflect.apply(Map.prototype.delete, rankedSearchCache, [key]);

function normalizedCacheList(value: unknown) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .map((item) => String(item).normalize("NFKC").trim().toLowerCase())
            .filter(Boolean),
        ),
      ].sort()
    : [];
}

function hashCacheValue(value: string) {
  return searchV2ServerHash(value);
}

function authorizationScopeHash(request: NextRequest) {
  const scope = [
    request.headers.get("authorization"),
    request.headers.get("cookie"),
    request.headers.get("x-tenant-id"),
    request.headers.get("x-user-id"),
  ]
    .filter(Boolean)
    .join("|");
  return hashCacheValue(scope || "anonymous");
}

function searchCacheKey(profile: SearchExecutionProfile) {
  return hashCacheValue(
    JSON.stringify({ version: SEARCH_RANKING_CACHE_VERSION, profile }),
  );
}
function freshRankedSearch(key: string) {
  const entry = rankedSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SEARCH_RANKING_CACHE_TTL_MS) {
    removeRankedSearch(key);
    return null;
  }
  removeRankedSearch(key);
  rankedSearchCache.set(key, entry);
  return entry;
}

function rememberRankedSearch(key: string, entry: RankedSearchCacheEntry) {
  rankedSearchCache.set(key, entry);
  while (rankedSearchCache.size > SEARCH_RANKING_CACHE_MAX_ENTRIES)
    removeRankedSearch(rankedSearchCache.keys().next().value!);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readRequestBody(request: NextRequest): Promise<SearchV2Body> {
  const body: unknown = await request.json();

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  return body as SearchV2Body;
}

function externalCapabilityResponse(
  capability: Awaited<
    ReturnType<ReturnType<typeof externalTalentProvider>["capability"]>
  >,
) {
  return {
    available: capability.ready,
    connected: capability.connected,
    population: null,
    reason: capability.reason,
    status: capability.status,
    providerName: capability.providerName,
    supportedFilters: capability.supportedFilters,
    supportsCandidateDetails: capability.supportsCandidateDetails,
    supportsImport: capability.supportsImport,
  };
}

function externalProfilePreview(item: ExternalTalentCandidate) {
  const employment = (item.employment || []).map((record) => ({
    id: record.id,
    title: record.title || null,
    employer: record.employer || null,
    start: record.startDate || null,
    end: record.current ? "Present" : record.endDate || null,
    current: record.current,
    location: record.location || null,
    summary: record.summary
      ? cleanCandidatePresentationText(record.summary).slice(0, 500) || null
      : null,
  }));
  const explicitCurrent = employment.find((record) => record.current) || null;
  const contextualCurrent =
    !explicitCurrent && item.currentTitle && item.currentEmployer
      ? {
          id: `external-current:${item.externalCandidateId}`,
          title: item.currentTitle,
          employer: item.currentEmployer,
          start: null,
          end: null,
          current: true,
          location: item.location || null,
          summary: null,
        }
      : null;
  const visibleEmployment = contextualCurrent
    ? [contextualCurrent, ...employment]
    : employment;
  return {
    employmentCount: visibleEmployment.length,
    projectCount: item.projectText?.length || 0,
    educationCount: item.education?.length || 0,
    certificationCount: item.certifications?.length || 0,
    trainingCount: 0,
    skillCount: item.skills.length,
    currentEmployment: explicitCurrent || contextualCurrent,
    latestEmployment: visibleEmployment[0] || null,
    employment: visibleEmployment.slice(0, 12),
    projects: [],
    education: item.education?.[0]
      ? {
          qualification: item.education[0],
          fieldOfStudy: null,
          institution: null,
        }
      : null,
    certifications: item.certifications || [],
    training: [],
    skills: item.skills,
  };
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("source") === "linkedin_talent_pool") {
    const capability = await externalTalentProvider().capability();
    return NextResponse.json(
      {
        ready: capability.ready,
        status: capability.status,
        version: SEARCH_V2_VERSION,
        sources: {
          external_talent_network: externalCapabilityResponse(capability),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Search-Version": SEARCH_V2_VERSION,
          "X-Search-Readiness": capability.status,
          "X-Search-Source": "external_talent_network",
        },
      },
    );
  }

  let readiness = searchV2ProjectionReadiness();
  if (
    readiness.status === "cold" ||
    (readiness.status === "failed" &&
      request.nextUrl.searchParams.get("retry") === "1")
  ) {
    // The process-owned promise is deliberately not connected to the request
    // signal. A disconnected readiness probe cannot cancel the shared rebuild.
    void prewarmCandidateSearchV2Dataset().catch(() => undefined);
    readiness = searchV2ProjectionReadiness();
  }
  if (readiness.status === "ready") {
    // Recruiter-visible readiness follows the valid dataset. Ranking prewarm is
    // intentionally detached so an exact identity request cannot queue behind
    // a synchronous full-population scoring pass in this request.
    void ensureSearchV2EngineReady().catch(() => undefined);
  }
  const readyDataset =
    readiness.status === "ready"
      ? await fetchCandidateSource().catch(() => null)
      : null;
  const internalPopulation =
    readyDataset?.documents.filter(
      (document) =>
        (document.talentPool || "internal_profiles") === "internal_profiles",
    ).length || 0;
  const readinessContract = searchV2ReadinessHttpContract(
    readiness,
    internalPopulation,
  );
  return NextResponse.json(
    {
      ...readinessContract.body,
      version: SEARCH_V2_VERSION,
    },
    {
      status: readinessContract.status,
      headers: {
        ...readinessContract.headers,
        "Cache-Control": "no-store",
        "X-Search-Version": SEARCH_V2_VERSION,
        "X-Search-Dataset-Revision": readiness.datasetRevision || "unavailable",
        "X-Search-Readiness": readiness.status,
        "X-Search-Dataset-Cache": readiness.datasetCache,
        "X-Search-Prewarm-Duration":
          readiness.prewarmMs === null
            ? "unavailable"
            : readiness.prewarmMs.toFixed(1),
        "Server-Timing":
          readiness.prewarmMs === null
            ? "prewarm;desc=unavailable"
            : `prewarm;dur=${readiness.prewarmMs.toFixed(1)}`,
      },
    },
  );
}
export async function POST(request: NextRequest) {
  try {
    const startedAt = performance.now();
    const requestCorrelationId =
      request.headers.get("x-search-request-id") || "server-generated";
    const parseStartedAt = performance.now();
    const rawBody = await readRequestBody(request);
    const queryNormalization = normalizeSearchV2Query(
      rawBody.rawQuery ?? rawBody.query,
    );
    const body: SearchV2Body = {
      ...rawBody,
      rawQuery: queryNormalization.rawQuery,
      query: queryNormalization.normalizedQuery,
    };
    if (body.talentPool === "linkedin_talent_pool") {
      const externalCommittedRequirements = buildCommittedSearchRequirements(
        body,
        body.integrityPlan ? "guided" : "query",
      );
      const capability = await externalTalentProvider().capability();
      if (!capability.connected || !capability.ready) {
        return NextResponse.json(
          {
            error:
              "Configure Exa People Search and Claude to search public professional profiles.",
            reason: capability.reason || "SOURCE_NOT_CONNECTED",
            sourceCapability: capability,
            requestId: requestCorrelationId,
          },
          {
            status: capability.reason === "AUTHENTICATION_EXPIRED" ? 401 : 409,
            headers: {
              "Cache-Control": "no-store",
              "X-Search-Request-Id": requestCorrelationId,
            },
          },
        );
      }
      try {
        const externalResult = await executeExternalTalentSearch(
          body,
          request.signal,
          {
            authorizationScopeHash: authorizationScopeHash(request),
            committedRequirements: externalCommittedRequirements,
          },
        );
        const results = externalResult.items.map((item) => ({
          candidateId: item.externalCandidateId,
          canonicalCandidateId: item.externalCandidateId,
          sourceCandidateIds: [item.externalCandidateId],
          talentPool: "linkedin_talent_pool",
          candidateName: item.displayName || null,
          currentTitle: item.currentTitle || item.headline || null,
          currentEmployer: item.currentEmployer || null,
          location: item.location || null,
          country: null,
          totalYearsExperience: item.totalYearsExperience,
          implementationEvidenceCount: item.implementationEvidenceCount,
          implementationEvidenceLevel: item.implementationEvidenceCount
            ? "source_text_evidence"
            : "unverified",
          seniorityEvidenceLevel: item.requirementEvaluations.some(
            (requirement) =>
              requirement.kind === "seniority" &&
              (requirement.state === "verified" ||
                requirement.state === "supported"),
          )
            ? "source_text_evidence"
            : "unverified",
          primaryRoleFit:
            item.targetEvidence.tier === "exact_verified" ||
            item.targetEvidence.tier === "exact_supported"
              ? "exact"
              : item.targetEvidence.tier === "related"
                ? "adjacent"
                : "unknown",
          implementationFit: item.implementationEvidenceCount
            ? "supported_domain_implementation"
            : "not_verified",
          seniorityFit: "unverified",
          locationFit: item.locationScore
            ? "supported"
            : item.requirementEvaluations.some(
                  (requirement) => requirement.kind === "location",
                )
              ? "not_verified"
              : "not_verified",
          specializationEvidenceLevel:
            item.targetEvidence.tier === "none"
              ? "unverified"
              : "source_text_evidence",
          targetEvidence: {
            ...item.targetEvidence,
            sourceRecordId: item.externalCandidateId,
            sourceValueProvenance: item.targetEvidence.trusted
              ? "candidate_record_raw"
              : null,
          },
          score: {
            keywordScore: item.keywordScore,
            semanticScore: item.semanticScore,
            skillScore: item.skillScore,
            titleScore: item.titleScore,
            employerScore: item.employerScore,
            locationScore: item.locationScore,
            industryScore: 0,
            qualityScore: item.evidenceConfidence,
            confidenceScore: item.evidenceConfidence,
            recencyScore: 0,
            finalScore: item.overallMatchScore,
          },
          explanation: {
            matchedTerms: item.requirementEvaluations
              .filter(
                (requirement) =>
                  requirement.state === "verified" ||
                  requirement.state === "supported",
              )
              .map((requirement) => requirement.label),
            matchedSkills: item.skills,
            matchedSapModules:
              item.targetEvidence.tier === "exact_verified" ||
              item.targetEvidence.tier === "exact_supported"
                ? [item.targetEvidence.target]
                : [],
            matchedIndustries: [],
            missingSkills: item.requirementEvaluations
              .filter(
                (requirement) =>
                  requirement.kind === "skill" &&
                  requirement.state === "unverified",
              )
              .map((requirement) => requirement.label),
            reasons: item.providerEvidence.map((evidence) => evidence.excerpt),
            warnings: [],
            confidenceLevel:
              item.evidenceConfidence >= 80
                ? "high"
                : item.evidenceConfidence >= 55
                  ? "medium"
                  : "low",
          },
          evidence: [
            ...item.providerEvidence.map((evidence) => ({
              label: evidence.label,
              value: evidence.excerpt,
              source: "Exa public professional profile",
            })),
            ...(item.employmentText || []).map((value) => ({
              label: "Employment evidence",
              value,
              source: "Exa public professional profile",
            })),
            ...(item.projectText || []).map((value) => ({
              label: "Project evidence",
              value,
              source: "Exa public professional profile",
            })),
            ...(item.education || []).map((value) => ({
              label: "Education evidence",
              value,
              source: "Exa public professional profile",
            })),
            ...(item.certifications || []).map((value) => ({
              label: "Certification evidence",
              value,
              source: "Exa public professional profile",
            })),
          ].filter(
            (evidence, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.value.normalize("NFKC").trim().toLowerCase() ===
                  evidence.value.normalize("NFKC").trim().toLowerCase(),
              ) === index,
          ),
          profileEvidence: {
            name: Boolean(item.displayName),
            title: Boolean(item.currentTitle || item.headline),
            employer: Boolean(item.currentEmployer),
            location: Boolean(item.location),
            experienceDuration: item.totalYearsExperience !== null,
            employmentHistory: Boolean(item.employmentText?.length),
            projectHistory: Boolean(item.projectText?.length),
            education: Boolean(item.education?.length),
            certifications: Boolean(item.certifications?.length),
            skills: Boolean(item.skills.length),
          },
          verifiedSkills: [],
          verifiedSapModules:
            item.targetEvidence.tier === "exact_verified"
              ? [item.targetEvidence.target]
              : [],
          queryRelevantSkills: item.skills,
          profilePreview: externalProfilePreview(item),
          ...externalCanonicalResultProjection(
            item,
            externalCommittedRequirements.version,
          ),
          requiredCoveragePercent: item.requirementCoverage,
          evidenceConfidencePercent: item.evidenceConfidence,
          profileCompletenessPercent: item.profileCompleteness,
          linkedInProfileUrl: item.profileUrl || null,
        }));
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = 20;
        const appliedMinimumScore = Math.max(0, Number(body.minimumScore) || 0);
        const appliedMatchQuality =
          body.matchQuality || inferSearchMatchQuality(appliedMinimumScore);
        return NextResponse.json(
          sanitizeSearchV2RecruiterResponse(
            buildExternalSearchV2ClientResponse({
              externalResult,
              results,
              generatedAt: new Date().toISOString(),
              requestId: requestCorrelationId,
              request: {
                query: body.query,
                mode: body.mode || "hybrid",
                page,
                pageSize,
                minimumScore: appliedMinimumScore,
                matchQuality: appliedMatchQuality,
              },
            }),
          ),
          {
            headers: {
              "Cache-Control": "no-store",
              "X-Search-Request-Id": requestCorrelationId,
            },
          },
        );
      } catch (error) {
        const failure =
          error instanceof ExternalSourceError
            ? error
            : new ExternalSourceError(
                "PROVIDER_ERROR",
                "External Talent Network could not complete this search.",
              );
        return NextResponse.json(
          {
            error: failure.message,
            reason: failure.code,
            retryAfterSeconds: failure.retryAfterSeconds,
            requestId: requestCorrelationId,
          },
          {
            status: failure.code === "RATE_LIMITED" ? 429 : 502,
            headers: {
              "Cache-Control": "no-store",
              "X-Search-Request-Id": requestCorrelationId,
            },
          },
        );
      }
    }
    let unifiedIntent = detectSearchV2UnifiedIntent(body.query);
    if (!unifiedIntent.searchable) {
      return NextResponse.json(
        {
          error: {
            code: "SEARCH_INTENT_UNRECOGNIZED",
            message:
              "No searchable name, title, company, skill or requirement was recognized. Please revise the search.",
            retryable: false,
          },
          searchIntent: unifiedIntent,
          requestId: requestCorrelationId,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
            "X-Search-Request-Id": requestCorrelationId,
          },
        },
      );
    }
    const browserRequest = {
      query: String(body.query || ""),
      mode: body.mode,
      filters: body.filters,
      page: body.page,
      pageSize: body.pageSize,
      semanticWeight: body.semanticWeight,
      keywordWeight: body.keywordWeight,
      qualityWeight: body.qualityWeight,
      recencyWeight: body.recencyWeight,
      minimumScore: body.minimumScore,
      matchQuality: body.matchQuality,
      talentPool: body.talentPool,
      criteria: body.criteria,
      clarificationAnswers: body.clarificationAnswers,
      includeRelocationRemote: body.includeRelocationRemote === true,
      cursor: body.cursor,
    };
    const queryParsingMs = performance.now() - parseStartedAt;
    const lightweightIdentityLookup =
      unifiedIntent.type === "identity_token_lookup";
    if (lightweightIdentityLookup) {
      const authorization = await authorizeRecruiterJobsRead();
      if (!authorization.allowed)
        return NextResponse.json(
          { error: authorization.code },
          {
            status: authorization.status,
            headers: { "Cache-Control": "no-store" },
          },
        );
    }
    const cacheable =
      !Array.isArray(body.documents) && !Array.isArray(body.candidates);
    let retrievalMs = 0,
      sourceEvidenceLoadingMs = 0,
      evidenceProjectionMs = 0,
      datasetRevision = "",
      sourceRows = 0,
      datasetCache: "hit" | "miss" | "request" = "request";
    let documents: CandidateSearchV2Document[];
    if (lightweightIdentityLookup) {
      const retrievalStartedAt = performance.now();
      const dataset = await fetchCandidateSourceByIdentityToken(
        unifiedIntent.lookupValue,
        request.signal,
      );
      documents = dataset.documents;
      datasetRevision = dataset.revision;
      sourceRows = dataset.sourceRows;
      retrievalMs = performance.now() - retrievalStartedAt;
      datasetCache = "request";
    } else if (cacheable) {
      const dataset = await fetchCandidateSource();
      documents = dataset.documents;
      datasetRevision = dataset.revision;
      sourceRows = dataset.sourceRows;
      retrievalMs = dataset.retrievalMs;
      sourceEvidenceLoadingMs = dataset.sourceEvidenceLoadingMs;
      evidenceProjectionMs = dataset.evidenceProjectionMs;
      datasetCache = dataset.cacheHit ? "hit" : "miss";
    } else {
      const projectionStartedAt = performance.now();
      documents = Array.isArray(body.documents)
        ? body.documents
        : adaptCandidatesToSearchV2Documents(body.candidates || []);
      evidenceProjectionMs = performance.now() - projectionStartedAt;
      sourceRows = documents.length;
      datasetRevision =
        "request-" +
        hashCacheValue(
          documents
            .map(
              (document) =>
                document.candidateId + ":" + (document.updatedAt || ""),
            )
            .join("|"),
        ).slice(0, 12);
    }
    unifiedIntent = confirmSearchV2IdentityIntent(
      documents,
      body.query,
      unifiedIntent,
    );
    const identityOnly = [
      "candidate_name_lookup",
      "identity_token_lookup",
    ].includes(unifiedIntent.type);
    const profile = buildSearchExecutionProfile(browserRequest, {
      datasetRevision,
      authorizationScopeHash: authorizationScopeHash(request),
    });
    const profileHash = searchV2ExecutionProfileHash(profile);
    const searchRequest = executionProfileRequest(
      profile,
      Number(body.page) || 1,
      Number(body.pageSize) || 20,
    );
    searchRequest.cursor = body.cursor;
    const profileDiagnostics = {
      hash: profileHash,
      minimumScore: profile.minimumScore,
      matchQuality: profile.matchQuality,
      readiness: searchV2ProjectionReadiness().status,
      datasetCache,
    };
    const integrityPlan =
      body.integrityPlan?.version === SEARCH_INTEGRITY_VERSION
        ? body.integrityPlan
        : null;
    const rankingCacheable = cacheable && !integrityPlan && !identityOnly;
    const cacheReadStartedAt = performance.now();
    const cacheKey = rankingCacheable ? searchCacheKey(profile) : "";
    const cached = rankingCacheable ? freshRankedSearch(cacheKey) : null;
    const cacheReadMs = performance.now() - cacheReadStartedAt;
    if (cached) {
      const result = paginateRankedCandidatesV2(
        cached.rankedResults,
        cached.totalDocuments,
        searchRequest,
        profileHash,
      );
      result.committedSearchId = profileHash;
      result.requestId = requestCorrelationId;
      const tiers = searchV2TierCounts(cached.rankedResults);
      result.summary = {
        ...result.summary,
        eligibleTotal: cached.eligibleTotal,
        visibleTotal: cached.rankedResults.length,
        verifiedVisible: tiers.exact_verified,
        supportedVisible: tiers.exact_supported,
        relatedVisible: tiers.related,
        appliedMinimumScore: profile.minimumScore,
        appliedMatchQuality: profile.matchQuality,
      };
      const totalMs = performance.now() - startedAt;
      const phases = {
        parse: queryParsingMs,
        retrieval: retrievalMs,
        evidence: sourceEvidenceLoadingMs,
        projection: evidenceProjectionMs,
        retrievalFilter: 0,
        qualification: 0,
        sort: 0,
        presentation: 0,
        cacheRead: cacheReadMs,
        cacheWrite: 0,
        total: totalMs,
      };
      return NextResponse.json(
        sanitizeSearchV2RecruiterResponse({
          ...result,
          eligibilityDiagnostic: cached.eligibilityDiagnostic,
          generatedAt: cached.generatedAt,
          executionProfile: {
            hash: profileHash,
            matchQuality: profile.matchQuality,
            minimumScore: profile.minimumScore,
          },
          source: {
            ...cached.source,
            version: SEARCH_RANKING_CACHE_VERSION,
            datasetRevision,
            timing: phases,
            cacheHit: true,
          },
        }),
        {
          status: 200,
          headers: {
            ...searchV2DiagnosticHeaders(
              datasetRevision,
              "hit",
              phases,
              profileDiagnostics,
            ),
            "X-Search-Request-Id": requestCorrelationId,
          },
        },
      );
    }
    const dedupeStartedAt = performance.now();
    const canonicalDataset =
      cacheable && !lightweightIdentityLookup
        ? canonicalDatasetProjection(documents, datasetRevision)
        : {
            projection: dedupeCandidateSearchV2Documents(documents),
            cacheHit: false,
          };
    const dedupe = canonicalDataset.projection;
    unifiedIntent = confirmSearchV2IdentityIntent(
      dedupe.documents,
      body.query,
      unifiedIntent,
    );
    if (!canonicalDataset.cacheHit)
      evidenceProjectionMs += performance.now() - dedupeStartedAt;
    if (identityOnly) {
      const allMatches = canonicalLookupMatches(
        dedupe.documents,
        unifiedIntent,
      );
      if (
        unifiedIntent.type === "identity_token_lookup" &&
        allMatches.length !== 1
      )
        return NextResponse.json(
          {
            error: {
              code:
                allMatches.length > 1
                  ? "IDENTITY_TOKEN_AMBIGUOUS"
                  : "IDENTITY_TOKEN_NOT_FOUND",
              message:
                allMatches.length > 1
                  ? "This candidate token is not unique. Please contact support."
                  : "No candidate was found for this identity token.",
              retryable: false,
            },
            searchIntent: unifiedIntent,
            requestId: requestCorrelationId,
          },
          {
            status: allMatches.length > 1 ? 409 : 404,
            headers: {
              "Cache-Control": "no-store",
              "X-Search-Request-Id": requestCorrelationId,
              "X-Search-Intent": unifiedIntent.type,
            },
          },
        );
      const identityPage = searchRequest.page || 1;
      const identityPageSize = searchRequest.pageSize || 20;
      const startIndex = (identityPage - 1) * identityPageSize;
      const identityResults = allMatches
        .slice(startIndex, startIndex + identityPageSize)
        .map(({ document, matchRank }) =>
          identityOnlyCandidateProjection(
            document,
            matchRank === 0 ? "exact" : matchRank === 1 ? "partial" : "fuzzy",
          ),
        );
      const totalMs = performance.now() - startedAt;
      const phases = {
        parse: queryParsingMs,
        retrieval: retrievalMs,
        evidence: sourceEvidenceLoadingMs,
        projection: evidenceProjectionMs,
        retrievalFilter: 0,
        qualification: 0,
        sort: 0,
        presentation: 0,
        cacheRead: cacheReadMs,
        cacheWrite: 0,
        total: totalMs,
      };
      return NextResponse.json(
        sanitizeSearchV2RecruiterResponse({
          generatedAt: new Date().toISOString(),
          request: {
            query: searchRequest.query,
            mode: searchRequest.mode,
            page: identityPage,
            pageSize: identityPageSize,
            minimumScore: 0,
          },
          summary: {
            totalDocuments: dedupe.documents.length,
            totalMatched: allMatches.length,
            eligibleTotal: allMatches.length,
            visibleTotal: allMatches.length,
            verifiedVisible: 0,
            supportedVisible: 0,
            relatedVisible: 0,
            appliedMinimumScore: 0,
            appliedMatchQuality: "any",
            returned: identityResults.length,
            page: identityPage,
            pageSize: identityPageSize,
          },
          results: identityResults,
          items: identityResults,
          eligibleTotal: allMatches.length,
          nextCursor: null,
          committedSearchId: profileHash,
          requestId: requestCorrelationId,
          searchIntent: unifiedIntent,
          evaluationMode: "identity_only",
          safety: {
            readOnly: true,
            candidateWrites: 0,
            workflowWrites: 0,
            automaticShortlists: 0,
            emailSends: 0,
          },
          source: {
            type: "canonical_person_index",
            sourceRows,
            uniqueCanonicalCandidates: dedupe.documents.length,
            duplicateGroups: dedupe.duplicateGroups,
            duplicateRowsCollapsed: dedupe.duplicateRowsCollapsed,
            version: SEARCH_RANKING_CACHE_VERSION,
            datasetRevision,
            profileHash,
            timing: phases,
            cacheHit: false,
          },
        }),
        {
          status: 200,
          headers: {
            ...searchV2DiagnosticHeaders(
              datasetRevision,
              "miss",
              phases,
              profileDiagnostics,
            ),
            "X-Search-Request-Id": requestCorrelationId,
            "X-Search-Intent": unifiedIntent.type,
          },
        },
      );
    }
    if (
      ["hybrid_candidate_evaluation", "company_search"].includes(
        unifiedIntent.type,
      )
    ) {
      const directRequest = { ...searchRequest, minimumScore: 0 };
      const directResults = searchCanonicalCandidatesByIntent(
        dedupe.documents,
        directRequest,
        unifiedIntent,
      );
      const result = paginateRankedCandidatesV2(
        directResults,
        dedupe.documents.length,
        directRequest,
        profileHash,
      );
      result.committedSearchId = profileHash;
      result.requestId = requestCorrelationId;
      const tiers = searchV2TierCounts(directResults);
      result.summary = {
        ...result.summary,
        eligibleTotal: directResults.length,
        visibleTotal: directResults.length,
        verifiedVisible: tiers.exact_verified,
        supportedVisible: tiers.exact_supported,
        relatedVisible: tiers.related,
        appliedMinimumScore: 0,
        appliedMatchQuality: "any",
      };
      const totalMs = performance.now() - startedAt;
      const phases = {
        parse: queryParsingMs,
        retrieval: retrievalMs,
        evidence: sourceEvidenceLoadingMs,
        projection: evidenceProjectionMs,
        retrievalFilter: 0,
        qualification: 0,
        sort: 0,
        presentation: 0,
        cacheRead: cacheReadMs,
        cacheWrite: 0,
        total: totalMs,
      };
      return NextResponse.json(
        sanitizeSearchV2RecruiterResponse({
          ...result,
          searchIntent: unifiedIntent,
          evaluationMode: "named_candidate_evaluation",
          source: {
            type: "canonical_person_index",
            sourceRows,
            uniqueCanonicalCandidates: dedupe.documents.length,
            duplicateGroups: dedupe.duplicateGroups,
            duplicateRowsCollapsed: dedupe.duplicateRowsCollapsed,
            version: SEARCH_RANKING_CACHE_VERSION,
            datasetRevision,
            profileHash,
            timing: phases,
            cacheHit: false,
          },
        }),
        {
          status: 200,
          headers: {
            ...searchV2DiagnosticHeaders(
              datasetRevision,
              "miss",
              phases,
              profileDiagnostics,
            ),
            "X-Search-Request-Id": requestCorrelationId,
            "X-Search-Intent": unifiedIntent.type,
          },
        },
      );
    }
    const engineTimings: SearchV2EngineTimings = {};
    const eligibleRequest = { ...searchRequest, minimumScore: 0 };
    let eligibleResults = rankCandidatesV2(
      dedupe.documents,
      eligibleRequest,
      engineTimings,
      true,
    );
    if (integrityPlan)
      eligibleResults = applySearchIntegrity(
        eligibleResults,
        dedupe.documents,
        integrityPlan,
      );
    const rankedResults = visibleSearchV2Results(eligibleResults, profile);
    const presentationStartedAt = performance.now();
    const result = paginateRankedCandidatesV2(
      rankedResults,
      dedupe.documents.length,
      searchRequest,
      profileHash,
    );
    result.committedSearchId = profileHash;
    result.requestId = requestCorrelationId;
    const tiers = searchV2TierCounts(rankedResults);
    result.summary = {
      ...result.summary,
      eligibleTotal: eligibleResults.length,
      visibleTotal: rankedResults.length,
      verifiedVisible: tiers.exact_verified,
      supportedVisible: tiers.exact_supported,
      relatedVisible: tiers.related,
      appliedMinimumScore: profile.minimumScore,
      appliedMatchQuality: profile.matchQuality,
    };
    const presentationMs = performance.now() - presentationStartedAt;
    const source = {
      type: Array.isArray(body.documents)
        ? "request_documents"
        : Array.isArray(body.candidates)
          ? "request_candidates"
          : "candidate_api",
      adaptedDocuments: documents.length,
      sourceRows,
      eligibleTotal: eligibleResults.length,
      rawMatchingRows: rankedResults.length,
      uniqueCanonicalCandidates: rankedResults.length,
      duplicateGroups: dedupe.duplicateGroups,
      duplicateRowsCollapsed: documents.length - dedupe.documents.length,
      duplicateGroupDetails: dedupe.duplicateGroupDetails,
      projection: cacheable
        ? "candidate_search_index_plus_candidate_raw"
        : "request_payload",
      version: SEARCH_RANKING_CACHE_VERSION,
      datasetRevision,
      profileHash,
    };
    const cacheWriteStartedAt = performance.now();
    if (rankingCacheable)
      rememberRankedSearch(cacheKey, {
        createdAt: Date.now(),
        generatedAt: result.generatedAt,
        rankedResults,
        eligibleTotal: eligibleResults.length,
        eligibilityDiagnostic: engineTimings.eligibilityDiagnostic,
        totalDocuments: dedupe.documents.length,
        source,
      });
    const cacheWriteMs = performance.now() - cacheWriteStartedAt;
    const totalMs = performance.now() - startedAt;
    const phases = {
      parse: queryParsingMs + (engineTimings.queryParsingMs || 0),
      retrieval: retrievalMs,
      evidence: sourceEvidenceLoadingMs,
      projection: evidenceProjectionMs,
      retrievalFilter: engineTimings.retrievalFilteringMs || 0,
      qualification: engineTimings.qualificationScoringMs || 0,
      sort: engineTimings.sortingMs || 0,
      presentation: presentationMs,
      cacheRead: cacheReadMs,
      cacheWrite: cacheWriteMs,
      total: totalMs,
    };
    return NextResponse.json(
      sanitizeSearchV2RecruiterResponse({
        ...result,
        eligibilityDiagnostic: engineTimings.eligibilityDiagnostic,
        executionProfile: {
          hash: profileHash,
          matchQuality: profile.matchQuality,
          minimumScore: profile.minimumScore,
          version: integrityPlan ? SEARCH_INTEGRITY_VERSION : SEARCH_V2_VERSION,
          planIdentity: integrityPlan?.planIdentity || null,
        },
        source: {
          ...source,
          timing: phases,
          ...(process.env.NODE_ENV !== "production"
            ? { hardFilterProfile: engineTimings.hardFilterProfile }
            : {}),
          cacheHit: false,
        },
      }),
      {
        status: 200,
        headers: {
          ...searchV2DiagnosticHeaders(
            datasetRevision,
            "miss",
            phases,
            profileDiagnostics,
          ),
          "X-Search-Request-Id": requestCorrelationId,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to perform Candidate Search V2.",

        safety: {
          readOnly: true,

          candidateWrites: 0,

          workflowWrites: 0,

          automaticShortlists: 0,

          emailSends: 0,
        },
      },
      {
        status: 400,
      },
    );
  }
}
