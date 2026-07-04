import { parseSearchIntent, type SearchIntent } from "./searchIntentParser";
import { rankCandidatesBySearchIntent, type RankedCandidate } from "./candidateVectorRanking";

export type SemanticSearchResult = {
  intent: SearchIntent;
  results: RankedCandidate[];
  summary: {
    total: number;
    topScore: number;
    primaryModule?: string;
    country?: string;
  };
};

export function semanticCandidateSearch(candidates: Record<string, any>[], query: string): SemanticSearchResult {
  const intent = parseSearchIntent(query);
  const results = rankCandidatesBySearchIntent(candidates, intent);

  return {
    intent,
    results,
    summary: {
      total: results.length,
      topScore: results[0]?.semanticScore || 0,
      primaryModule: intent.primaryModule,
      country: intent.country,
    },
  };
}
