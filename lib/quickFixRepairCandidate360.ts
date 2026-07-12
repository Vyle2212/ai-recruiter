import { loadQuickFixRepairSuggestions } from "./quickFixRepairReview";
import type { QuickFixCandidate360Panel } from "./quickFixRepairTypes";

function clean(value: any) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function buildQuickFixCandidate360Panel(candidateId: string, suggestionsPath?: string): QuickFixCandidate360Panel {
  const file = loadQuickFixRepairSuggestions(suggestionsPath);
  const suggestions = file.suggestions.filter((item) => clean(item.candidateId) === clean(candidateId));
  const candidateName = suggestions[0]?.candidateName || clean(candidateId);
  const safe = suggestions.filter((item) => item.validationStatus === "safe_suggestion").length;
  const blocked = suggestions.filter((item) => item.validationStatus === "blocked").length;
  const suggestedNextAction = suggestions.length ? `${safe} suggestions ready for recruiter approval, ${blocked} blocked` : "No quick fix suggestions for this candidate yet";
  return {
    candidateId: clean(candidateId),
    candidateName,
    suggestions,
    suggestedNextAction,
    safetyNote: "QUICK FIX REPAIR IS REVIEW-FIRST. Candidate records are not updated.",
  };
}
