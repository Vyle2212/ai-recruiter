export const ACCEPTANCE_IDENTITY_CASES = [
  { key: "recruiter", role: "recruiter", status: "active", profile: true },
  {
    key: "recruiter_manager",
    role: "recruiter_manager",
    status: "active",
    profile: true,
  },
  { key: "admin", role: "admin", status: "active", profile: true },
  { key: "client", role: "client", status: "active", profile: true },
  { key: "candidate", role: "candidate", status: "active", profile: true },
  {
    key: "inactive_recruiter",
    role: "recruiter",
    status: "inactive",
    profile: true,
  },
  {
    key: "missing_profile",
    role: null,
    status: null,
    profile: false,
  },
] as const;

export type AcceptanceIdentityKey =
  (typeof ACCEPTANCE_IDENTITY_CASES)[number]["key"];

export type AcceptanceCredentialBundle = {
  schemaVersion: "production-trust-authenticated-acceptance-v2";
  runId: string;
  expiresAt: string;
  identities: Record<
    AcceptanceIdentityKey,
    {
      email: string;
      password: string;
      authUserId: string;
      role: string | null;
      status: string | null;
    }
  >;
  unknownRoleControl: {
    attempted: true;
    constraintRejected: true;
  };
};
