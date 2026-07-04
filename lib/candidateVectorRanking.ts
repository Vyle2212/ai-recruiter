import { explainCandidateMatch, type MatchExplanation } from "./explainableMatch";
import { parseSearchIntent, type SearchIntent } from "./searchIntentParser";

type AnyRecord = Record<string, any>;

export type RankedCandidate = AnyRecord & {
  semanticScore: number;
  searchScore: number;
  searchRank: number;
  baseMatchScore: number;
  searchExplanation: MatchExplanation;
  whyMatched: string[];
  searchGaps: string[];
};

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function textOf(value: any) {
  try {
    return JSON.stringify(value || "").toLowerCase();
  } catch {
    return String(value || "").toLowerCase();
  }
}

function getCandidateBaseScore(candidate: AnyRecord, fallback = 0) {
  return n(
    candidate.score ??
      candidate.matchScore ??
      candidate.finalScore ??
      candidate.calibratedScore ??
      candidate.aiScore,
    fallback
  );
}

function keywordScore(candidate: AnyRecord, intent: SearchIntent) {
  const keywords = Array.isArray(intent.keywords) ? intent.keywords : [];

  if (!keywords.length) return 76;

  const text = textOf(candidate);
  const hits = keywords.filter((keyword) =>
    text.includes(String(keyword).toLowerCase())
  );

  return Math.round((hits.length / keywords.length) * 100);
}

export function rankCandidatesBySearchIntent(
  candidates: AnyRecord[],
  queryOrIntent: string | SearchIntent
): RankedCandidate[] {
  const intent =
    typeof queryOrIntent === "string"
      ? parseSearchIntent(queryOrIntent)
      : queryOrIntent;

  return candidates
    .map((candidate) => {
      const explanation = explainCandidateMatch(candidate, intent);
      const kw = keywordScore(candidate, intent);
      const baseMatchScore = getCandidateBaseScore(
        candidate,
        explanation.overallScore
      );

      const semanticScore = Math.round(
        n(explanation.overallScore) * 0.7 + kw * 0.15 + baseMatchScore * 0.15
      );

      return {
        ...candidate,
        baseMatchScore,
        semanticScore,
        searchScore: semanticScore,
        searchExplanation: explanation,
        whyMatched: Array.isArray(explanation.reasons)
          ? explanation.reasons
          : [],
        searchGaps: Array.isArray(explanation.gaps) ? explanation.gaps : [],
      };
    })
    .sort(
      (a, b) =>
        n(b.semanticScore) - n(a.semanticScore) ||
        n(b.searchScore) - n(a.searchScore) ||
        n(b.baseMatchScore) - n(a.baseMatchScore)
    )
    .map((candidate, index) => ({ ...candidate, searchRank: index + 1 }));
}
