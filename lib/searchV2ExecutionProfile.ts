import type { CandidateSearchV2Request, CandidateSearchV2Result } from "./candidateSearchV2Types";
import { normalizeCandidateSearchV2Request } from "./candidateSearchV2Request";
import { parseRecruiterSearchIntent } from "./recruiterSearchPresentation";
import { SEARCH_V2_QUALIFICATION_VERSION, SEARCH_V2_VERSION } from "./searchV2Shared";
import { buildCommittedSearchRequirements, type CommittedSearchRequirements } from "./searchV2CommittedRequirements";
export type SearchMatchQuality = "any" | "relevant" | "strong";
export const SEARCH_V2_SCORING_WEIGHT_VERSION = "search-v2-overall-match-v2";
export const SEARCH_V2_MATCH_QUALITY_SCORES: Readonly<Record<SearchMatchQuality, number>> = { any: 0, relevant: 50, strong: 85 };
export type SearchExecutionProfile = {
  normalizedQuery: string; parsedIntent: ReturnType<typeof parseRecruiterSearchIntent>; matchQuality: SearchMatchQuality; minimumScore: number;
  filters: ReturnType<typeof normalizeCandidateSearchV2Request>["filters"]; locationRequirements: string[]; mode: ReturnType<typeof normalizeCandidateSearchV2Request>["mode"];
  scoringWeights: { semantic: number; keyword: number; quality: number; recency: number }; scoringWeightVersion: string; qualificationVersion: string;
  searchVersion: string; datasetRevision: string; authorizationScopeHash: string;
  includeRelocationRemote: boolean;
  committedRequirements: CommittedSearchRequirements;
};
export function matchQualityMinimumScore(value: SearchMatchQuality) { return SEARCH_V2_MATCH_QUALITY_SCORES[value]; }
export function inferSearchMatchQuality(minimumScore: number | undefined): SearchMatchQuality {
  const value = Number(minimumScore ?? 0);
  return value >= SEARCH_V2_MATCH_QUALITY_SCORES.strong ? "strong" : value >= SEARCH_V2_MATCH_QUALITY_SCORES.relevant ? "relevant" : "any";
}
export function buildSearchV2BrowserRequest(input: { query: string; matchQuality: SearchMatchQuality; filters?: CandidateSearchV2Request["filters"]; page?: number; pageSize?: number; mode?: CandidateSearchV2Request["mode"]; talentPool?:CandidateSearchV2Request["talentPool"];criteria?:CandidateSearchV2Request["criteria"];clarificationAnswers?:CandidateSearchV2Request["clarificationAnswers"]; }): CandidateSearchV2Request & { matchQuality: SearchMatchQuality } {
  return { query: input.query, mode: input.mode || "hybrid", filters: input.filters || {}, page: input.page || 1, pageSize: input.pageSize || 20,
    minimumScore: matchQualityMinimumScore(input.matchQuality), matchQuality: input.matchQuality,talentPool:input.talentPool||"internal_profiles",criteria:input.criteria||[],clarificationAnswers:input.clarificationAnswers||{} } as CandidateSearchV2Request & { matchQuality: SearchMatchQuality };
}
export function buildSearchExecutionProfile(request: CandidateSearchV2Request & { matchQuality?: SearchMatchQuality }, context: { datasetRevision: string; authorizationScopeHash: string }): SearchExecutionProfile {
  const normalized = normalizeCandidateSearchV2Request(request); const parsedIntent = parseRecruiterSearchIntent(normalized.query);
  const committedRequirements = buildCommittedSearchRequirements(normalized);
  const matchQuality = request.matchQuality || inferSearchMatchQuality(request.minimumScore);
  const minimumScore = request.minimumScore === undefined ? matchQualityMinimumScore(matchQuality) : normalized.minimumScore;
  if (request.matchQuality && request.minimumScore !== undefined && normalized.minimumScore !== matchQualityMinimumScore(request.matchQuality)) {
    throw new Error("Search match quality and minimum score do not describe the same execution profile.");
  }
  return { normalizedQuery: normalized.query.normalize("NFKC").replace(/\s+/g, " ").trim(), parsedIntent, matchQuality, minimumScore, filters: normalized.filters,
    locationRequirements: [...new Set([...(normalized.filters.countries || []), ...(normalized.filters.locations || []), ...parsedIntent.countries.map((value) => value.toLowerCase())])].sort(),
    mode: normalized.mode, scoringWeights: { semantic: normalized.semanticWeight, keyword: normalized.keywordWeight, quality: normalized.qualityWeight, recency: normalized.recencyWeight },
    scoringWeightVersion: SEARCH_V2_SCORING_WEIGHT_VERSION, qualificationVersion: SEARCH_V2_QUALIFICATION_VERSION, searchVersion: SEARCH_V2_VERSION,
    datasetRevision: context.datasetRevision, authorizationScopeHash: context.authorizationScopeHash,
    includeRelocationRemote: normalized.includeRelocationRemote, committedRequirements };
}
export function executionProfileRequest(profile: SearchExecutionProfile, page = 1, pageSize = 20): CandidateSearchV2Request {
  return { query: profile.normalizedQuery, mode: profile.mode, filters: profile.filters, page, pageSize, minimumScore: profile.minimumScore, includeRelocationRemote: profile.includeRelocationRemote,
    semanticWeight: profile.scoringWeights.semantic, keywordWeight: profile.scoringWeights.keyword, qualityWeight: profile.scoringWeights.quality, recencyWeight: profile.scoringWeights.recency,talentPool:profile.committedRequirements.talentPool,criteria:[...profile.committedRequirements.criteria],clarificationAnswers:{...profile.committedRequirements.clarificationAnswers} };
}
export function visibleSearchV2Results(eligibleResults: readonly CandidateSearchV2Result[], profile: SearchExecutionProfile) { return eligibleResults.filter((result) => (result.overallMatchScore ?? result.score.finalScore) >= profile.minimumScore); }
export function searchV2TierCounts(results: readonly CandidateSearchV2Result[]) {
  const counts = { exact_verified: 0, exact_supported: 0, related: 0, none: 0 }; for (const result of results) counts[result.targetEvidence.tier] += 1; return counts;
}
