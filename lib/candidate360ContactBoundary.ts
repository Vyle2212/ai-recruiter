import type { Candidate360Profile } from "./candidate360Types";

// Contact unlock must be backed by a reviewed database decision. Until that
// exists, the recruiter profile response cannot return direct contact fields.
export function redactCandidate360Contact<T extends Candidate360Profile>(
  profile: T,
): T {
  return {
    ...profile,
    contactInfo: {
      email: { ...profile.contactInfo.email, value: "", evidence: "" },
      phone: { ...profile.contactInfo.phone, value: "", evidence: "" },
    },
  };
}
