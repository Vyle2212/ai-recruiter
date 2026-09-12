export type CandidateWorkspaceResolution =
  | { status: "linked"; candidateId: string; source: string }
  | { status: "unavailable"; reason: "no_explicit_workspace_link" };

const EXPLICIT_WORKSPACE_KEYS = [
  "primary_candidate_id", "primaryCandidateId", "talent_profile_id", "talentProfileId",
  "candidate_workspace_id", "candidateWorkspaceId",
] as const;

/** Resolve hand-off only from an explicit persisted identity link. */
export function resolveCandidateWorkspaceIdentity(record: Record<string, unknown>): CandidateWorkspaceResolution {
  for (const key of EXPLICIT_WORKSPACE_KEYS) {
    const value = typeof record[key] === "string" ? record[key].trim() : "";
    if (value) return { status: "linked", candidateId: value, source: key };
  }
  return { status: "unavailable", reason: "no_explicit_workspace_link" };
}

export function buildCandidateNotesHref(primaryCandidateId: string, candidate360Id: string): string {
  const returnTo = `/recruiter/candidate360-v2/${encodeURIComponent(candidate360Id)}?tab=notes`;
  return `/candidates/${encodeURIComponent(primaryCandidateId)}?returnTo=${encodeURIComponent(returnTo)}#recruiter-notes`;
}
