import {
  calculateRecruiterMatch,
  calculateRecruiterGradeMatch,
  extractCandidateSignals,
} from "./recruiterMatchEngine";

export type CandidateLike = Record<string, any>;
export type JobLike = Record<string, any>;

export function scoreSAPCandidate(candidate: CandidateLike, job: JobLike) {
  return calculateRecruiterMatch(job, candidate);
}

export function generateSAPMatches(
  candidates: CandidateLike[],
  job: JobLike,
  limit = 50
) {
  return (candidates || [])
    .map((candidate) => {
      const result = calculateRecruiterMatch(job, candidate);
      const profile = extractCandidateSignals(candidate);

      return {
        candidateId: candidate.id,
        name: result.details?.name || profile.name || candidate.name || "Unknown Candidate",
        title: result.details?.title || candidate.current_title || candidate.title || "",
        company: result.details?.company || candidate.current_company || candidate.company || "",
        email: result.details?.email || candidate.email || "",
        phone: result.details?.phone || candidate.phone || "",
        location: result.details?.location || candidate.location || "",
        score: result.score,
        level: result.label,
        label: result.label,
        strengths: result.strengths || [],
        gaps: result.gaps || [],
        badges: result.details || {},
        debug: result.details || {},
        details: result.details || {},
        confidence: result.confidence,
      };
    })
    .filter((m) => m.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export {
  calculateRecruiterMatch,
  calculateRecruiterGradeMatch,
  extractCandidateSignals,
};