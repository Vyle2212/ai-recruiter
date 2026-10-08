type Profile = {
  id: string;
  auth_user_id: string;
  role: string;
  status: string;
  candidate_id: string | null;
};
type Account = {
  user_profile_id: string;
  candidate_id: string;
  status: string;
};

/** Readback policy only. It never claims imported CVs or repairs partial links. */
export function candidateRegistrationOwnership(
  verifiedUserId: string,
  snapshot: {
    profiles: Profile[];
    accounts: Account[];
    candidateIds: string[];
    readError: boolean;
  },
): "create_new" | "already_owned" | "review_required" {
  if (!verifiedUserId || snapshot.readError) return "review_required";
  if (snapshot.profiles.length === 0)
    return snapshot.accounts.length === 0 && snapshot.candidateIds.length === 0
      ? "create_new"
      : "review_required";
  if (
    snapshot.profiles.length !== 1 ||
    snapshot.accounts.length !== 1 ||
    snapshot.candidateIds.length !== 1
  )
    return "review_required";
  const profile = snapshot.profiles[0];
  const account = snapshot.accounts[0];
  return profile.auth_user_id === verifiedUserId &&
    profile.role === "candidate" &&
    profile.status === "active" &&
    !!profile.candidate_id &&
    account.status === "active" &&
    account.user_profile_id === profile.id &&
    account.candidate_id === profile.candidate_id &&
    snapshot.candidateIds[0] === profile.candidate_id
    ? "already_owned"
    : "review_required";
}
