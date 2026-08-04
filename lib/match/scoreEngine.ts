import { calculateConfidence, type MatchConfidence } from "./confidence";
import { buildScoreBreakdown, type ScoreBreakdownInput, type ScoreBreakdownItem } from "./scoreBreakdown";

export type MatchScore = {
  score: number;
  searchFit: number;
  confidence: MatchConfidence;
  breakdown: ScoreBreakdownItem[];
  algorithm: "canonical_sap_search_v1";
  details: {
    baseScore: number;
    moduleMatchType?: string;
    why: string[];
    tokens: string[];
  };
};

export type SearchFitInput = {
  base: number;
  quality: number;
  years: number;
  implementation: number;
  rollout: number;
  s4: number;
  ams: number;
};

export function calculateSearchFit(input: SearchFitInput) {
  // This is the existing Search API formula moved into a reusable module.
  // Keep this byte-for-byte equivalent in behavior to preserve ranking and displayed fit values.
  let score = Math.min(96, Math.max(55, Math.round(input.base || 0)));
  if (input.years >= 8) score += 1;
  if (input.years >= 15) score += 1;
  if (input.implementation > 0) score += 1;
  if (input.rollout > 0) score += 1;
  if (input.s4 > 0) score += 1;
  if (input.quality < 70) score -= 6;
  else if (input.quality < 80) score -= 3;
  if (input.implementation <= 0 && input.rollout <= 0 && input.s4 <= 0 && input.ams <= 0) score -= 5;
  return Math.max(55, Math.min(99, Math.round(score)));
}

export type BuildMatchScoreInput = SearchFitInput &
  Pick<ScoreBreakdownInput, "consultingLevel" | "consultingCompanies" | "certifications" | "keywordTerms" | "matchedTokens" | "moduleMatchType"> & {
    contactable: boolean;
    primaryModuleMatched: boolean;
    why: string[];
    tokens: string[];
  };

export function buildMatchScore(input: BuildMatchScoreInput): MatchScore {
  const searchFit = calculateSearchFit(input);
  return {
    score: searchFit,
    searchFit,
    confidence: calculateConfidence({
      searchFit,
      quality: input.quality,
      contactable: input.contactable,
      primaryModuleMatched: input.primaryModuleMatched,
      years: input.years,
      implementation: input.implementation,
      s4: input.s4,
      keywordMatched: Boolean((input.keywordTerms || []).length || (input.matchedTokens || []).length),
    }),
    breakdown: buildScoreBreakdown({
      baseScore: input.base,
      years: input.years,
      implementation: input.implementation,
      rollout: input.rollout,
      s4: input.s4,
      ams: input.ams,
      quality: input.quality,
      consultingLevel: input.consultingLevel,
      consultingCompanies: input.consultingCompanies,
      certifications: input.certifications,
      keywordTerms: input.keywordTerms,
      matchedTokens: input.matchedTokens,
      moduleMatchType: input.moduleMatchType,
    }),
    algorithm: "canonical_sap_search_v1",
    details: {
      baseScore: input.base,
      moduleMatchType: input.moduleMatchType,
      why: input.why || [],
      tokens: input.tokens || [],
    },
  };
}