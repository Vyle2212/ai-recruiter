import type { CandidateSearchV2Result } from "./candidateSearchV2Types";

export const SEARCH_V2_RANKING_VERSION = "search-v2-overall-match-v7-grounded-employment";
export type SearchV2MatchLabel = "Strong Match" | "Good Match" | "Potential Match";
const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
export function canonicalOverallMatchScore(input: { criteriaScore: number; hasCriteria: boolean; professionalRelevance: number; deliveryDepth: number; evidenceConfidence: number }): number {
  const professional = clamp(input.professionalRelevance), delivery = clamp(input.deliveryDepth), evidence = clamp(input.evidenceConfidence), criteria = clamp(input.criteriaScore);
  // When Criteria exist they already own their grounded evidence dimension;
  // adding delivery again would double-count the same project assignment.
  return Math.round(input.hasCriteria ? criteria * .55 + professional * .35 + evidence * .1 : professional * .65 + delivery * .2 + evidence * .15);
}
export function canonicalMatchLabel(score: number): SearchV2MatchLabel { const normalized=Math.round(clamp(score)); return normalized>=85?"Strong Match":normalized>=70?"Good Match":"Potential Match"; }
export function compareCanonicalSearchResults(left: CandidateSearchV2Result, right: CandidateSearchV2Result): number { return (right.overallMatchScore||0)-(left.overallMatchScore||0)||(right.evidenceConfidencePercent||0)-(left.evidenceConfidencePercent||0)||(right.supportedProfessionalEvidenceDepth||0)-(left.supportedProfessionalEvidenceDepth||0)||right.score.recencyScore-left.score.recencyScore||(right.profileCompletenessPercent||0)-(left.profileCompletenessPercent||0)||Number(Boolean(right.candidateName))-Number(Boolean(left.candidateName))||left.candidateId.localeCompare(right.candidateId); }
export function searchV2MatchBucketCounts(results: readonly CandidateSearchV2Result[]){const counts={strong:0,good:0,potential:0};for(const result of results){const label=result.matchLabel||canonicalMatchLabel(result.overallMatchScore||0);if(label==="Strong Match")counts.strong++;else if(label==="Good Match")counts.good++;else counts.potential++;}return counts;}
