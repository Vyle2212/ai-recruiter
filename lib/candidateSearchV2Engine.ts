import {
  candidatePassesSearchV2Filters,
} from "./candidateSearchV2Filters";

import {
  normalizeCandidateSearchV2Request,
} from "./candidateSearchV2Request";

import {
  candidateHasSearchV2PrimaryModuleRelevance,
  prepareCandidateSearchV2ModuleRelevance,
} from "./candidateSearchV2ModuleRelevance";

import {
  scoreCandidateSearchV2Document,
} from "./candidateSearchV2Scoring";
import { dedupeCandidateSearchV2Documents } from "./candidateSearchV2Projection";
import { parseRecruiterSearchIntent } from "./recruiterSearchPresentation";
import { compareCanonicalSearchResults, searchV2MatchBucketCounts, SEARCH_V2_RANKING_VERSION } from "./searchV2Match";
import { applyCommittedRequirements, buildCommittedSearchRequirements, evaluateCommittedPopulation } from "./searchV2CommittedRequirements";
import type { SearchV2EligibilityDiagnostic,SearchV2HardFilterProfile } from "./searchV2CommittedRequirements";

import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
  CandidateSearchV2Response,
  CandidateSearchV2Result,
} from "./candidateSearchV2Types";
import type { SearchV2UnifiedIntent } from "./searchV2UnifiedIntent";
import { canonicalLookupMatches } from "./searchV2UnifiedIntent";

const implementationFitRank = (value: string) =>
  value === "verified_domain_implementation" ? 4 : value === "supported_domain_implementation" ? 3
    : value === "generic_implementation" ? 2 : value === "implementation_exposure" ? 1 : value === "not_verified" ? 0 : -1;
const seniorityFitRank = (value: string) =>
  value === "verified" ? 3 : value === "supported" ? 2 : value === "unverified" ? 1 : 0;
const targetEvidenceTierRank = (value: CandidateSearchV2Result) => {
  const tier = value.targetEvidence?.tier;
  return tier === "exact_verified" ? 4 : tier === "exact_supported" ? 3 : tier === "related" ? 2 : 1;
};
const locationFitRank = (value: string) =>
  value === "verified" ? 3 : value === "supported" ? 2 : value === "not_verified" ? 1 : 0;

export type SearchV2EngineTimings = { queryParsingMs?: number; retrievalFilteringMs?: number; qualificationScoringMs?: number; sortingMs?: number; eligibilityDiagnostic?:SearchV2EligibilityDiagnostic; hardFilterProfile?:SearchV2HardFilterProfile };

export function rankCandidatesV2(
  documents:
    CandidateSearchV2Document[],
  rawRequest:
    CandidateSearchV2Request,
  timings?: SearchV2EngineTimings,
  documentsAreCanonical = false,
): CandidateSearchV2Result[] {
  const request =
    normalizeCandidateSearchV2Request(
      rawRequest,
    );
  const parsingStartedAt = performance.now();
  const searchIntent = parseRecruiterSearchIntent(request.query);
  const committedRequirements = buildCommittedSearchRequirements(request);
  if (timings) timings.queryParsingMs = performance.now() - parsingStartedAt;
  const relevanceContext = prepareCandidateSearchV2ModuleRelevance(request);

  // This invariant belongs at the engine boundary, not only in one API route:
  // canonical entities are collapsed before filtering, scoring and pagination.
  const filteringStartedAt = performance.now();
  const canonicalDocuments = documentsAreCanonical ? documents : dedupeCandidateSearchV2Documents(documents).documents;
  const profileOutput:{profile?:SearchV2HardFilterProfile}={};
  const populationEvaluation=evaluateCommittedPopulation(canonicalDocuments,committedRequirements,profileOutput);
  const committedEvaluations = populationEvaluation.evaluations;
  const filtered =
    canonicalDocuments.filter(
      (candidate) => {
        return populationEvaluation.eligibleCandidateIds.has(candidate.candidateId) &&
        candidatePassesSearchV2Filters(
          candidate,
          {
            ...request,
            filters: {
              ...request.filters,
              countries: [],
              locations: [],
              skills: [],
              sapModules: [],
              languages: [],
            },
          },
        ) &&
        candidateHasSearchV2PrimaryModuleRelevance(candidate,request,relevanceContext);
      },
    );
  if (timings) timings.retrievalFilteringMs = performance.now() - filteringStartedAt;
  if (timings) timings.eligibilityDiagnostic=populationEvaluation.diagnostic;
  if (timings) timings.hardFilterProfile=profileOutput.profile;

  const scoringStartedAt = performance.now();
  const scored =
    filtered
      .map(
        (candidate) =>
          scoreCandidateSearchV2Document(
            candidate,
            request,
          ),
      )
      .filter(
        (result) => result.score.roleDomainEligible,
      );
  if (timings) timings.qualificationScoringMs = performance.now() - scoringStartedAt;
  const sortingStartedAt = performance.now();
  const committedScored = applyCommittedRequirements(
    scored,
    filtered,
    committedRequirements,
    committedEvaluations,
  ).filter((result) => result.overallMatchScore >= request.minimumScore);
  committedScored.sort(compareCanonicalSearchResults);
  if (timings) timings.sortingMs = performance.now() - sortingStartedAt;

  return committedScored;
}

export function paginateRankedCandidatesV2(
  rankedResults: CandidateSearchV2Result[],
  totalDocuments: number,
  rawRequest: CandidateSearchV2Request,
  committedSearchId = "",
): CandidateSearchV2Response {
  const request = normalizeCandidateSearchV2Request(rawRequest);
  let startIndex =
    (
      request.page -
      1
    ) *
    request.pageSize;
  if (rawRequest.cursor) {
    try {
      const cursor=JSON.parse(Buffer.from(rawRequest.cursor,"base64url").toString("utf8")) as {v?:string;search?:string;score?:number;id?:string};
      if(cursor.v===SEARCH_V2_RANKING_VERSION&&(!committedSearchId||cursor.search===committedSearchId)){
        const boundaryIndex=rankedResults.findIndex(item=>item.candidateId===cursor.id&&item.overallMatchScore===cursor.score);
        if(boundaryIndex>=0)startIndex=boundaryIndex+1;
      }
    } catch { /* Invalid cursors fail closed to the requested page boundary. */ }
  }

  const results =
    rankedResults.slice(
      startIndex,
      startIndex +
        request.pageSize,
    );

  const bucketCounts = searchV2MatchBucketCounts(rankedResults);
  return {
    generatedAt:
      new Date().toISOString(),

    request: {
      query:
        request.query,

      mode:
        request.mode,

      page:
        request.page,

      pageSize:
        request.pageSize,

      minimumScore:
        request.minimumScore,
    },

    summary: {
      totalDocuments:
        totalDocuments,

      totalMatched:
        rankedResults.length,

      returned:
        results.length,

      page:
        request.page,

      pageSize:
        request.pageSize,
    },

    results,
    items: results,
    eligibleTotal: rankedResults.length,
    bucketCounts,
    nextCursor: startIndex + results.length < rankedResults.length ? Buffer.from(JSON.stringify({ v: SEARCH_V2_RANKING_VERSION, search: committedSearchId, score: results.at(-1)?.overallMatchScore || 0, id: results.at(-1)?.candidateId || "" })).toString("base64url") : null,
    rankingVersion: SEARCH_V2_RANKING_VERSION,

    safety: {
      readOnly: true,
      candidateWrites: 0,
      workflowWrites: 0,
      automaticShortlists: 0,
      emailSends: 0,
    },
  };
}

export function searchCandidatesV2(
  documents: CandidateSearchV2Document[],
  rawRequest: CandidateSearchV2Request,
): CandidateSearchV2Response {
  return paginateRankedCandidatesV2(
    rankCandidatesV2(documents, rawRequest),
    documents.length,
    rawRequest,
  );
}

/** Direct identity/company retrieval scores only the bounded lookup matches.
 * Explicitly requested people remain visible even when fit evidence is weak or
 * a requested evaluation criterion is unverified. */
export function searchCanonicalCandidatesByIntent(
  documents: CandidateSearchV2Document[],
  rawRequest: CandidateSearchV2Request,
  intent: SearchV2UnifiedIntent,
) {
  const matches = canonicalLookupMatches(documents, intent);
  const evaluationQuery = intent.evaluationQuery;
  const evaluationRequest = normalizeCandidateSearchV2Request({
    ...rawRequest,
    query: evaluationQuery,
    minimumScore: 0,
  });
  const committed = buildCommittedSearchRequirements(evaluationRequest);
  const scored = matches.map(({ document, matchRank }) => ({
    result: scoreCandidateSearchV2Document(document, evaluationRequest),
    document,
    matchRank,
  }));
  const evaluated = applyCommittedRequirements(
    scored.map((item) => item.result),
    scored.map((item) => item.document),
    committed,
    undefined,
    { preserveIneligible: true },
  );
  const rankById = new Map(scored.map((item) => [item.result.candidateId, item.matchRank]));
  evaluated.sort((left, right) =>
    (rankById.get(left.candidateId) || 0) - (rankById.get(right.candidateId) || 0)
    || compareCanonicalSearchResults(left, right));
  return evaluated;
}
