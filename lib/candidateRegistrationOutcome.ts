type SignupResult = {
  data: { session: unknown };
  error: { status?: number } | null;
};

// Return no Auth identifiers, provider messages or account-existence evidence.
export async function candidateRegistrationOutcome(
  signup: () => Promise<SignupResult>,
) {
  try {
    const { data, error } = await signup();
    if (error)
      return {
        status: error.status === 429 ? 429 : 503,
        body: { error: "candidate_registration_temporarily_unavailable" },
      };
    if (data.session)
      return {
        status: 503,
        body: { error: "candidate_email_confirmation_required" },
      };
    return { status: 202, body: { status: "verification_pending" } };
  } catch {
    return {
      status: 503,
      body: { error: "candidate_registration_temporarily_unavailable" },
    };
  }
}
