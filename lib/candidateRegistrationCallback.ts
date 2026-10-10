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
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown> | null;
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
): Promise<
  | { verified: true; userId: string; email: string; fullName: string }
  | { verified: false }
> {
  try {
    const exchange = await auth.exchangeCodeForSession(code);
    if (exchange.error) return { verified: false };
    return readVerifiedCandidateRegistrationIdentity(auth.getUser);
  } catch {
    return { verified: false };
  }
}

/** Shared with password-authenticated recovery after a failed PKCE callback. */
export async function readVerifiedCandidateRegistrationIdentity(
  getUser: () => Promise<{
    data: { user: VerifiedUser | null };
    error: unknown;
  }>,
): Promise<
  | { verified: true; userId: string; email: string; fullName: string }
  | { verified: false }
> {
  try {
    const result = await getUser();
    const user = result.data.user;
    const email = user?.email?.trim().toLowerCase() || "";
    const fullName =
      typeof user?.user_metadata?.registration_full_name === "string"
        ? user.user_metadata.registration_full_name.trim()
        : "";
    if (
      result.error ||
      !user ||
      user.is_anonymous ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        user.id,
      ) ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      fullName.length < 1 ||
      fullName.length > 120 ||
      /[\u0000-\u001f\u007f]/.test(fullName) ||
      !user.email_confirmed_at ||
      !Number.isFinite(Date.parse(user.email_confirmed_at))
    )
      return { verified: false };
    return { verified: true, userId: user.id, email, fullName };
  } catch {
    return { verified: false };
  }
}

export type CandidateProvisioningStatus =
  | "created"
  | "already_owned"
  | "identity_review_required"
  | "retry_required";

/** Only exact, sanitized RPC statuses influence browser routing. */
export async function provisionCandidateRegistration(
  identity: { userId: string; email: string; fullName: string },
  invoke: (args: {
    p_auth_user_id: string;
    p_email: string;
    p_full_name: string;
  }) => Promise<{ data: unknown; error: unknown }>,
): Promise<"ready" | "review_required" | "temporarily_unavailable"> {
  try {
    const result = await invoke({
      p_auth_user_id: identity.userId,
      p_email: identity.email,
      p_full_name: identity.fullName,
    });
    if (result.error || !result.data || typeof result.data !== "object")
      return "temporarily_unavailable";
    const status = (result.data as { status?: unknown }).status;
    if (status === "created" || status === "already_owned") return "ready";
    if (status === "identity_review_required") return "review_required";
    return "temporarily_unavailable";
  } catch {
    return "temporarily_unavailable";
  }
}
