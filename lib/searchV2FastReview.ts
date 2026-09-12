import type { CandidateSearchV2Request } from "./candidateSearchV2Types";
import {
  buildCommittedSearchRequirements,
  type CommittedSearchRequirements,
} from "./searchV2CommittedRequirements";
import { generatedCriteriaForRequirementLabels } from "./searchV2Criteria";
import { preparationIdentity } from "./searchV2Preparation";
import { normalizeSearchV2Query } from "./searchV2QueryNormalization";

export const SEARCH_V2_FAST_REVIEW_VERSION = "search-v2-fast-review-v1";

export type SearchV2FastReviewTiming = Readonly<{
  normalizationMs: number;
  requirementConstructionMs: number;
  totalMs: number;
  externalRequestCount: 0;
  cacheHit: boolean;
}>;

export type SearchV2FastReview = Readonly<{
  version: typeof SEARCH_V2_FAST_REVIEW_VERSION;
  identity: string;
  preview: CommittedSearchRequirements;
  timing: SearchV2FastReviewTiming;
}>;

const cache = new Map<string, Omit<SearchV2FastReview, "timing">>();
const now = () => performance.now();
const stableKey = (request: CandidateSearchV2Request) =>
  JSON.stringify({
    version: SEARCH_V2_FAST_REVIEW_VERSION,
    query: normalizeSearchV2Query(request.query).normalizedQuery,
    minimumScore: request.minimumScore ?? null,
    filters: request.filters || {},
    criteria: request.criteria || [],
    clarificationAnswers: request.clarificationAnswers || {},
    talentPool: request.talentPool || "internal_profiles",
    includeRelocationRemote: Boolean(request.includeRelocationRemote),
  });

/** Builds the initial review entirely in-process. It deliberately has no
 * provider, model, fetch, storage, or candidate-dataset dependency. */
export function buildSearchV2FastReview(
  request: CandidateSearchV2Request,
): SearchV2FastReview {
  const started = now();
  const normalizationStarted = now();
  const key = stableKey(request);
  const normalizationMs = now() - normalizationStarted;
  const found = cache.get(key);
  if (found)
    return {
      ...found,
      timing: {
        normalizationMs,
        requirementConstructionMs: 0,
        totalMs: now() - started,
        externalRequestCount: 0,
        cacheHit: true,
      },
    };

  const constructionStarted = now();
  const initial = buildCommittedSearchRequirements(request);
  const criteria = request.criteria?.length
    ? request.criteria
    : generatedCriteriaForRequirementLabels(
        initial.requirements.map((requirement) => requirement.label),
      );
  const preview = criteria.length
    ? buildCommittedSearchRequirements({ ...request, criteria })
    : initial;
  const requirementConstructionMs = now() - constructionStarted;
  const value = {
    version: SEARCH_V2_FAST_REVIEW_VERSION,
    identity: preparationIdentity(request.query),
    preview,
  } as const;
  if (cache.size >= 250) cache.clear();
  cache.set(key, value);
  return {
    ...value,
    timing: {
      normalizationMs,
      requirementConstructionMs,
      totalMs: now() - started,
      externalRequestCount: 0,
      cacheHit: false,
    },
  };
}

export function clearSearchV2FastReviewCacheForTests() {
  cache.clear();
}
