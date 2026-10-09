import {
  acceptanceRegistrationEmail,
  acceptanceRegistrationFullName,
} from "./acceptanceCandidateRegistrationOwnership";

const RUN_HASH = /^[0-9a-f]{16}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AcceptanceCandidateRegistrationIntent = {
  schemaVersion: 1;
  runHash: string;
  email: string;
  fullName: string;
  authUserId?: string;
};

export function acceptanceCandidateRegistrationIntentPath(
  credentialBundlePath: string,
) {
  const value = String(credentialBundlePath || "").trim();
  if (!value) throw new Error("acceptance_registration_intent_path_invalid");
  return `${value}.candidate-registration-intent.json`;
}

export function createAcceptanceCandidateRegistrationIntent(
  runHash: string,
  captureEmail: string,
): AcceptanceCandidateRegistrationIntent {
  const normalizedRunHash = String(runHash || "")
    .trim()
    .toLowerCase();
  if (!RUN_HASH.test(normalizedRunHash))
    throw new Error("acceptance_registration_intent_run_hash_invalid");
  return {
    schemaVersion: 1,
    runHash: normalizedRunHash,
    email: acceptanceRegistrationEmail(captureEmail, normalizedRunHash),
    fullName: acceptanceRegistrationFullName(normalizedRunHash),
  };
}

export function bindAcceptanceCandidateRegistrationAuthUser(
  intent: AcceptanceCandidateRegistrationIntent,
  authUserId: string,
): AcceptanceCandidateRegistrationIntent {
  const normalizedAuthUserId = String(authUserId || "")
    .trim()
    .toLowerCase();
  if (!UUID.test(normalizedAuthUserId))
    throw new Error("acceptance_registration_intent_auth_user_invalid");
  if (intent.authUserId && intent.authUserId !== normalizedAuthUserId)
    throw new Error("acceptance_registration_intent_auth_user_mismatch");
  return { ...intent, authUserId: normalizedAuthUserId };
}

export function serializeAcceptanceCandidateRegistrationIntent(
  intent: AcceptanceCandidateRegistrationIntent,
) {
  return `${JSON.stringify(intent)}\n`;
}

export function parseAcceptanceCandidateRegistrationIntent(
  contents: string,
  expectedRunHash: string,
  captureEmail: string,
): AcceptanceCandidateRegistrationIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("acceptance_registration_intent_invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("acceptance_registration_intent_invalid");
  const record = parsed as Record<string, unknown>;
  const allowedKeys = new Set([
    "schemaVersion",
    "runHash",
    "email",
    "fullName",
    "authUserId",
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key)))
    throw new Error("acceptance_registration_intent_invalid");
  const expected = createAcceptanceCandidateRegistrationIntent(
    expectedRunHash,
    captureEmail,
  );
  if (
    record.schemaVersion !== 1 ||
    record.runHash !== expected.runHash ||
    record.email !== expected.email ||
    record.fullName !== expected.fullName
  )
    throw new Error("acceptance_registration_intent_mismatch");
  if (record.authUserId === undefined) return expected;
  if (typeof record.authUserId !== "string")
    throw new Error("acceptance_registration_intent_invalid");
  return bindAcceptanceCandidateRegistrationAuthUser(
    expected,
    record.authUserId,
  );
}

export function acceptanceRegistrationIntentOwnsAuthUser(
  intent: AcceptanceCandidateRegistrationIntent,
  user: {
    id?: unknown;
    email?: unknown;
    user_metadata?: unknown;
  },
) {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  return (
    typeof user.email === "string" &&
    user.email.trim().toLowerCase() === intent.email &&
    metadata.registration_full_name === intent.fullName &&
    (!intent.authUserId ||
      (typeof user.id === "string" &&
        user.id.trim().toLowerCase() === intent.authUserId))
  );
}
