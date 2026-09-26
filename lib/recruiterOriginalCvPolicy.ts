export type RecruiterOriginalCvGrant = {
  candidate_id: string;
  recruiter_profile_id: string;
  approved_by_profile_id: string;
  purpose: "headhunting" | "client_support";
  client_id: string | null;
  approved_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: string;
};

/** Client sharing never overrides admin approval. A support-scoped approval
 * also expires when the assignment, share or subscription feature is removed.
 */
export function recruiterOriginalCvAllowed(input: {
  candidateId: string;
  recruiterProfileId: string;
  grant: RecruiterOriginalCvGrant | null;
  support?: {
    assigned: boolean;
    candidateShared: boolean;
    candidateVisible: boolean;
    featureActive: boolean;
  };
  now?: Date;
}) {
  const grant = input.grant;
  const now = (input.now || new Date()).getTime();
  if (
    !grant ||
    grant.candidate_id !== input.candidateId ||
    grant.recruiter_profile_id !== input.recruiterProfileId ||
    !grant.approved_by_profile_id ||
    grant.status !== "active" ||
    grant.revoked_at ||
    !Number.isFinite(now) ||
    !Number.isFinite(Date.parse(grant.approved_at)) ||
    Date.parse(grant.approved_at) > now ||
    !Number.isFinite(Date.parse(grant.expires_at)) ||
    Date.parse(grant.expires_at) <= now
  )
    return false;
  if (grant.purpose === "headhunting" && !grant.client_id) return true;
  return (
    grant.purpose === "client_support" &&
    Boolean(grant.client_id) &&
    input.support?.assigned === true &&
    input.support.candidateShared === true &&
    input.support.candidateVisible === true &&
    input.support.featureActive === true
  );
}
