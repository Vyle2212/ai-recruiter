import { maskAuthEmail } from "./stagingAuthDisabledAdapter";
import type {
  StagingAuthActorRole,
  StagingAuthOperationKey,
  StagingInvitationInput,
  StagingPasswordResetInput,
  StagingSignInInput,
} from "./stagingAuthAdapterTypes";
import type {
  StagingAuthRuntimeAdapter,
  StagingAuthRuntimeIdentity,
  StagingAuthRuntimeOperationResult,
  StagingAuthRuntimeSessionSnapshot,
} from "./stagingAuthRuntimeAdapterTypes";

type SupabaseUserLike = {
  id: string;
  email?: string | null;
};

type SupabaseSessionLike = {
  user: SupabaseUserLike;
  expires_at?: number | null;
};

type SupabaseAuthResponse<T> = {
  data: T;
  error: {
    message?: string;
    code?: string;
    status?: number;
  } | null;
};

type UserProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  role: string;
  status: string;
  organization_id: string | null;
  client_id: string | null;
  candidate_id: string | null;
};

export type SupabaseStagingAuthClient = {
  auth: {
    getSession(): Promise<
      SupabaseAuthResponse<{ session: SupabaseSessionLike | null }>
    >;

    getUser(): Promise<
      SupabaseAuthResponse<{ user: SupabaseUserLike | null }>
    >;

    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<
      SupabaseAuthResponse<{
        user: SupabaseUserLike | null;
        session: SupabaseSessionLike | null;
      }>
    >;

    signOut(): Promise<SupabaseAuthResponse<Record<string, never>>>;

    resetPasswordForEmail(
      email: string,
    ): Promise<SupabaseAuthResponse<Record<string, never>>>;

    refreshSession(): Promise<
      SupabaseAuthResponse<{
        user: SupabaseUserLike | null;
        session: SupabaseSessionLike | null;
      }>
    >;
  };

  from(table: "user_profiles"): {
    select(columns: string): {
      eq(column: "auth_user_id", value: string): {
        maybeSingle(): Promise<{
          data: UserProfileRow | null;
          error: {
            message?: string;
            code?: string;
          } | null;
        }>;
      };
    };
  };
};

export type SupabaseStagingRuntimeAdapterOptions = {
  explicitlyEnabled?: boolean;
  createClient?: () => Promise<SupabaseStagingAuthClient>;
};

const allowedRoles = new Set<StagingAuthActorRole>([
  "admin",
  "recruiter_manager",
  "recruiter",
  "client",
  "candidate",
  "guest",
]);

function safeErrorCode(value: unknown): string {
  const raw =
    value && typeof value === "object"
      ? String(
          (value as { code?: unknown }).code ||
            (value as { status?: unknown }).status ||
            "",
        )
      : "";

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized || "supabase_auth_failed_safe";
}

function normalizeRole(value: unknown): StagingAuthActorRole {
  const role = String(value || "")
    .trim()
    .toLowerCase() as StagingAuthActorRole;

  return allowedRoles.has(role) ? role : "guest";
}

function failed<T>(
  operation: StagingAuthOperationKey,
  errorCode: string,
  blockerKeys: string[] = ["supabase_auth_operation_failed"],
  data?: T,
): StagingAuthRuntimeOperationResult<T> {
  return {
    operation,
    ok: false,
    status: "failed_safe",
    ...(data === undefined ? {} : { data }),
    blockerKeys,
    warningKeys: [],
    errorCode,
    sensitiveInputReturned: false,
    tokenReturned: false,
    realActionExecuted: true,
    productionBlocked: true,
  };
}

function blocked<T>(
  operation: StagingAuthOperationKey,
  blockerKeys: string[],
  data?: T,
): StagingAuthRuntimeOperationResult<T> {
  return {
    operation,
    ok: false,
    status: "blocked",
    ...(data === undefined ? {} : { data }),
    blockerKeys,
    warningKeys: [],
    sensitiveInputReturned: false,
    tokenReturned: false,
    realActionExecuted: false,
    productionBlocked: true,
  };
}

function success<T>(
  operation: StagingAuthOperationKey,
  data: T,
): StagingAuthRuntimeOperationResult<T> {
  return {
    operation,
    ok: true,
    status: "success",
    data,
    blockerKeys: [],
    warningKeys: [],
    sensitiveInputReturned: false,
    tokenReturned: false,
    realActionExecuted: true,
    productionBlocked: true,
  };
}

function noSession(): StagingAuthRuntimeSessionSnapshot {
  return {
    status: "no_session",
    expiresAt: null,
    tokenExposed: false,
    cookieUsed: true,
    realSession: false,
  };
}

function sessionSnapshot(
  session: SupabaseSessionLike,
  identity?: StagingAuthRuntimeIdentity,
): StagingAuthRuntimeSessionSnapshot {
  return {
    status: "authenticated",
    ...(identity ? { identity } : {}),
    expiresAt:
      typeof session.expires_at === "number"
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    tokenExposed: false,
    cookieUsed: true,
    realSession: true,
  };
}

async function loadIdentity(
  client: SupabaseStagingAuthClient,
  user: SupabaseUserLike,
): Promise<StagingAuthRuntimeIdentity | null> {
  const { data, error } = await client
    .from("user_profiles")
    .select(
      "id,auth_user_id,email,role,status,organization_id,client_id,candidate_id",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    return null;
  }

  return {
    userId: user.id,
    emailMasked: maskAuthEmail(user.email || data.email),
    role: normalizeRole(data.role),
    ...(data.organization_id
      ? { organizationId: data.organization_id }
      : {}),
    ...(data.client_id ? { clientId: data.client_id } : {}),
    ...(data.candidate_id
      ? { candidateId: data.candidate_id }
      : {}),
    source: "supabase_staging",
    authenticated: true,
    realUser: true,
  };
}

export function createSupabaseStagingRuntimeAdapter(
  options: SupabaseStagingRuntimeAdapterOptions = {},
): StagingAuthRuntimeAdapter {
  if (
    options.explicitlyEnabled !== true ||
    !options.createClient
  ) {
    return {
      provider: "disabled",

      getSession: async () =>
        blocked("get_session", [
          "supabase_staging_runtime_disabled",
        ], noSession()),

      getUser: async () =>
        blocked("get_user", [
          "supabase_staging_runtime_disabled",
        ], null),

      getProfile: async () =>
        blocked("get_profile", [
          "supabase_staging_runtime_disabled",
        ], null),

      signIn: async () =>
        blocked("sign_in", [
          "supabase_staging_runtime_disabled",
        ], noSession()),

      signOut: async () =>
        blocked("sign_out", [
          "supabase_staging_runtime_disabled",
        ], null),

      requestPasswordReset: async () =>
        blocked("request_password_reset", [
          "supabase_staging_runtime_disabled",
        ], null),

      acceptInvitation: async () =>
        blocked("accept_invitation", [
          "supabase_invitation_runtime_not_implemented",
        ], null),

      refreshSession: async () =>
        blocked("refresh_session", [
          "supabase_staging_runtime_disabled",
        ], noSession()),
    };
  }

  const createClient = options.createClient;

  return {
    provider: "supabase_staging",

    getSession: async () => {
      try {
        const client = await createClient();
        const { data, error } = await client.auth.getSession();

        if (error) {
          return failed(
            "get_session",
            safeErrorCode(error),
            ["supabase_get_session_failed"],
            noSession(),
          );
        }

        if (!data.session) {
          return success("get_session", noSession());
        }

        const identity = await loadIdentity(
          client,
          data.session.user,
        );

        return success(
          "get_session",
          sessionSnapshot(
            data.session,
            identity || undefined,
          ),
        );
      } catch (error) {
        return failed(
          "get_session",
          safeErrorCode(error),
          ["supabase_get_session_failed"],
          noSession(),
        );
      }
    },

    getUser: async () => {
      try {
        const client = await createClient();
        const { data, error } = await client.auth.getUser();

        if (error) {
          return failed(
            "get_user",
            safeErrorCode(error),
            ["supabase_get_user_failed"],
            null,
          );
        }

        if (!data.user) {
          return success("get_user", null);
        }

        const identity = await loadIdentity(
          client,
          data.user,
        );

        if (!identity) {
          return failed(
            "get_user",
            "active_profile_not_found",
            ["active_profile_required"],
            null,
          );
        }

        return success("get_user", identity);
      } catch (error) {
        return failed(
          "get_user",
          safeErrorCode(error),
          ["supabase_get_user_failed"],
          null,
        );
      }
    },

    getProfile: async () => {
      try {
        const client = await createClient();
        const { data, error } = await client.auth.getUser();

        if (error || !data.user) {
          return failed(
            "get_profile",
            safeErrorCode(error),
            ["authenticated_user_required"],
            null,
          );
        }

        const identity = await loadIdentity(
          client,
          data.user,
        );

        if (!identity) {
          return failed(
            "get_profile",
            "active_profile_not_found",
            ["active_profile_required"],
            null,
          );
        }

        return success("get_profile", {
          userId: identity.userId,
          role: identity.role,
          organizationId:
            identity.organizationId || null,
          clientId: identity.clientId || null,
          candidateId: identity.candidateId || null,
        });
      } catch (error) {
        return failed(
          "get_profile",
          safeErrorCode(error),
          ["supabase_get_profile_failed"],
          null,
        );
      }
    },

    signIn: async (input: StagingSignInInput) => {
      try {
        const client = await createClient();

        const { data, error } =
          await client.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });

        if (error || !data.session || !data.user) {
          return failed(
            "sign_in",
            safeErrorCode(error),
            ["supabase_sign_in_failed"],
            noSession(),
          );
        }

        const identity = await loadIdentity(
          client,
          data.user,
        );

        if (!identity) {
          await client.auth.signOut();

          return failed(
            "sign_in",
            "active_profile_not_found",
            ["active_profile_required"],
            noSession(),
          );
        }

        return success(
          "sign_in",
          sessionSnapshot(data.session, identity),
        );
      } catch (error) {
        return failed(
          "sign_in",
          safeErrorCode(error),
          ["supabase_sign_in_failed"],
          noSession(),
        );
      }
    },

    signOut: async () => {
      try {
        const client = await createClient();
        const { error } = await client.auth.signOut();

        return error
          ? failed(
              "sign_out",
              safeErrorCode(error),
              ["supabase_sign_out_failed"],
              null,
            )
          : success("sign_out", null);
      } catch (error) {
        return failed(
          "sign_out",
          safeErrorCode(error),
          ["supabase_sign_out_failed"],
          null,
        );
      }
    },

    requestPasswordReset: async (
      input: StagingPasswordResetInput,
    ) => {
      try {
        const client = await createClient();
        const { error } =
          await client.auth.resetPasswordForEmail(
            input.email,
          );

        return error
          ? failed(
              "request_password_reset",
              safeErrorCode(error),
              ["supabase_password_reset_failed"],
              null,
            )
          : success("request_password_reset", null);
      } catch (error) {
        return failed(
          "request_password_reset",
          safeErrorCode(error),
          ["supabase_password_reset_failed"],
          null,
        );
      }
    },

    acceptInvitation: async (
      _input: StagingInvitationInput,
    ) =>
      blocked(
        "accept_invitation",
        ["supabase_invitation_runtime_not_implemented"],
        null,
      ),

    refreshSession: async () => {
      try {
        const client = await createClient();
        const { data, error } =
          await client.auth.refreshSession();

        if (error || !data.session || !data.user) {
          return failed(
            "refresh_session",
            safeErrorCode(error),
            ["supabase_refresh_session_failed"],
            noSession(),
          );
        }

        const identity = await loadIdentity(
          client,
          data.user,
        );

        return success(
          "refresh_session",
          sessionSnapshot(
            data.session,
            identity || undefined,
          ),
        );
      } catch (error) {
        return failed(
          "refresh_session",
          safeErrorCode(error),
          ["supabase_refresh_session_failed"],
          noSession(),
        );
      }
    },
  };
}