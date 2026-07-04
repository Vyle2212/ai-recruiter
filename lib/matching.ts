import {
  calculateRecruiterMatch,
  calculateRecruiterGradeMatch,
  extractCandidateSignals,
} from "./recruiterMatchEngine";
import { parseSearchIntent } from "./searchIntentParser";
import { semanticCandidateSearch } from "./semanticSearch";
import { rankCandidatesBySearchIntent } from "./candidateVectorRanking";
import { explainCandidateMatch } from "./explainableMatch";

export type MatchLabel =
  | "Strong match"
  | "Good match"
  | "Potential match"
  | "Weak match";

export type RecruiterMatchResult = {
  score: number;
  label: MatchLabel;
  strengths: string[];
  gaps: string[];
  confidence: "high" | "medium" | "low";
  details: Record<string, any>;
};

export {
  calculateRecruiterMatch,
  calculateRecruiterGradeMatch,
  extractCandidateSignals,
  parseSearchIntent,
  semanticCandidateSearch,
  rankCandidatesBySearchIntent,
  explainCandidateMatch,
};

export const calculateMatch = calculateRecruiterMatch;
