import { scoreCandidateForJob } from "./match-score";

export function calculateScore(jd: any, cv: any) {
  return scoreCandidateForJob(jd, cv).score;
}

export { scoreCandidateForJob };
