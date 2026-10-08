/** Callback inputs cannot select a role, candidate record or redirect target. */
export function candidateConfirmationCode(url: URL): string | null {
  if (url.hash || [...url.searchParams.keys()].some((key) => key !== "code"))
    return null;
  const codes = url.searchParams.getAll("code");
  if (codes.length !== 1 || !/^[A-Za-z0-9_-]{16,2048}$/.test(codes[0]))
    return null;
  return codes[0];
}

type VerifiedUser = {
  id: string;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
};

/** Fresh Auth readback, rather than exchange response or editable metadata. */
export async function verifyCandidateConfirmation(
  code: string,
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>;
    getUser: () => Promise<{
      data: { user: VerifiedUser | null };
      error: unknown;
    }>;
  },
): Promise<{ verified: true; userId: string } | { verified: false }> {
  try {
    const exchange = await auth.exchangeCodeForSession(code);
    if (exchange.error) return { verified: false };
    const result = await auth.getUser();
    const user = result.data.user;
    if (
      result.error ||
      !user ||
      user.is_anonymous ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        user.id,
      ) ||
      !user.email_confirmed_at ||
      !Number.isFinite(Date.parse(user.email_confirmed_at))
    )
      return { verified: false };
    return { verified: true, userId: user.id };
  } catch {
    return { verified: false };
  }
}
