import type {
  StagingAuthActorRole,
  StagingAuthOperationKey,
  StagingSignInInput,
  StagingPasswordResetInput,
  StagingInvitationInput,
} from "./stagingAuthAdapterTypes";

export type StagingAuthRuntimeProvider =
  | "disabled"
  | "preview_bridge"
  | "supabase_staging";

export type StagingAuthRuntimeStatus =
  | "blocked"
  | "disabled"
  | "provider_not_implemented"
  | "success"
  | "failed_safe";

export type StagingAuthRuntimeIdentity = {
  userId: string;
  emailMasked: string;
  role: StagingAuthActorRole;
  organizationId?: string;
  clientId?: string;
  candidateId?: string;
  source: StagingAuthRuntimeProvider;
  authenticated: boolean;
  realUser: boolean;
};

export type StagingAuthRuntimeSessionSnapshot = {
  status:
    | "no_session"
    | "blocked"
    | "authenticated"
    | "expired";
  identity?: StagingAuthRuntimeIdentity;
  expiresAt: string | null;
  tokenExposed: false;
  cookieUsed: boolean;
  realSession: boolean;
};

export type StagingAuthRuntimeOperationResult<T> = {
  operation: StagingAuthOperationKey;
  ok: boolean;
  status: StagingAuthRuntimeStatus;
  data?: T;
  blockerKeys: string[];
  warningKeys: string[];
  errorCode?: string;
  sensitiveInputReturned: false;
  tokenReturned: false;
  realActionExecuted: boolean;
  productionBlocked: true;
};

export type StagingAuthRuntimeAdapter = {
  provider: StagingAuthRuntimeProvider;

  getSession(): Promise<
    StagingAuthRuntimeOperationResult<StagingAuthRuntimeSessionSnapshot>
  >;

  getUser(): Promise<
    StagingAuthRuntimeOperationResult<StagingAuthRuntimeIdentity | null>
  >;

  getProfile(): Promise<
    StagingAuthRuntimeOperationResult<Record<string, unknown> | null>
  >;

  signIn(
    input: StagingSignInInput,
  ): Promise<
    StagingAuthRuntimeOperationResult<StagingAuthRuntimeSessionSnapshot>
  >;

  signOut(): Promise<
    StagingAuthRuntimeOperationResult<null>
  >;

  requestPasswordReset(
    input: StagingPasswordResetInput,
  ): Promise<
    StagingAuthRuntimeOperationResult<null>
  >;

  acceptInvitation(
    input: StagingInvitationInput,
  ): Promise<
    StagingAuthRuntimeOperationResult<null>
  >;

  refreshSession(): Promise<
    StagingAuthRuntimeOperationResult<StagingAuthRuntimeSessionSnapshot>
  >;
};