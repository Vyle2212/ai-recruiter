const RUN_HASH = /^[0-9a-f]{16}$/;

function runHash(value: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!RUN_HASH.test(normalized))
    throw new Error("acceptance_registration_run_hash_invalid");
  return normalized;
}

function splitEmail(value: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (
    at < 1 ||
    at !== normalized.indexOf("@") ||
    at === normalized.length - 1 ||
    /\s/.test(normalized)
  )
    return null;
  return { local: normalized.slice(0, at), domain: normalized.slice(at + 1) };
}

export function acceptanceRegistrationFullName(run: string) {
  return `PTF public signup ${runHash(run)}`;
}

export function acceptanceRegistrationEmail(baseEmail: string, run: string) {
  const email = splitEmail(baseEmail);
  if (!email || email.local.includes("+"))
    throw new Error("acceptance_registration_capture_email_invalid");
  return `${email.local}+ptf1c2-${runHash(run)}@${email.domain}`;
}

export function acceptanceRegistrationEmailOwned(email: string, run: string) {
  const parsed = splitEmail(email);
  return Boolean(parsed?.local.endsWith(`+ptf1c2-${runHash(run)}`));
}

export function acceptanceRegistrationAuthIdentityOwned(
  user: {
    email?: unknown;
    email_confirmed_at?: unknown;
    user_metadata?: unknown;
  },
  run: string,
) {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  return (
    typeof user.email === "string" &&
    acceptanceRegistrationEmailOwned(user.email, run) &&
    metadata.registration_full_name === acceptanceRegistrationFullName(run)
  );
}

export function acceptanceRegistrationAuthOwned(
  user: {
    email?: unknown;
    email_confirmed_at?: unknown;
    user_metadata?: unknown;
  },
  run: string,
) {
  return (
    acceptanceRegistrationAuthIdentityOwned(user, run) &&
    typeof user.email_confirmed_at === "string" &&
    user.email_confirmed_at.length > 0
  );
}

export function acceptanceRegistrationProfileOwned(
  profile: {
    auth_user_id?: unknown;
    email?: unknown;
    full_name?: unknown;
    role?: unknown;
    status?: unknown;
    candidate_id?: unknown;
  },
  run: string,
  authUserIds: readonly string[],
) {
  return (
    typeof profile.auth_user_id === "string" &&
    authUserIds.includes(profile.auth_user_id) &&
    typeof profile.email === "string" &&
    acceptanceRegistrationEmailOwned(profile.email, run) &&
    profile.full_name === acceptanceRegistrationFullName(run) &&
    profile.role === "candidate" &&
    profile.status === "active" &&
    typeof profile.candidate_id === "string" &&
    /^[0-9a-f-]{36}$/i.test(profile.candidate_id)
  );
}

export function acceptanceRegistrationCandidateOwned(
  candidate: {
    email?: unknown;
    normalized_email?: unknown;
    name?: unknown;
    status?: unknown;
    profile_source_state?: unknown;
    profile_confirmation_status?: unknown;
  },
  run: string,
) {
  const source =
    candidate.profile_source_state &&
    typeof candidate.profile_source_state === "object"
      ? (candidate.profile_source_state as Record<string, unknown>)
      : {};
  return (
    typeof candidate.email === "string" &&
    acceptanceRegistrationEmailOwned(candidate.email, run) &&
    typeof candidate.normalized_email === "string" &&
    candidate.normalized_email.trim().toLowerCase() ===
      candidate.email.trim().toLowerCase() &&
    candidate.name === acceptanceRegistrationFullName(run) &&
    candidate.status === "New" &&
    candidate.profile_confirmation_status === "not_claimed" &&
    source.origin === "candidate_signup"
  );
}
