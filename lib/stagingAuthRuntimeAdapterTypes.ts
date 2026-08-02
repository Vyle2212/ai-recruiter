import type {
  StagingAuthOperationResult,
  StagingAuthSessionSnapshot,
  StagingAuthIdentity,
  StagingSignInInput,
  StagingPasswordResetInput,
  StagingInvitationInput,
} from "./stagingAuthAdapterTypes";

export type StagingAuthRuntimeAdapter = {
  getSession(): Promise<
    StagingAuthOperationResult<StagingAuthSessionSnapshot>
  >;

  getUser(): Promise<
    StagingAuthOperationResult<StagingAuthIdentity | null>
  >;

  getProfile(): Promise<
    StagingAuthOperationResult<Record<string, never> | null>
  >;

  signIn(
    input: StagingSignInInput,
  ): Promise<StagingAuthOperationResult<StagingAuthSessionSnapshot>>;

  signOut(): Promise<StagingAuthOperationResult<null>>;

  requestPasswordReset(
    input: StagingPasswordResetInput,
  ): Promise<StagingAuthOperationResult<null>>;

  acceptInvitation(
    input: StagingInvitationInput,
  ): Promise<StagingAuthOperationResult<null>>;

  refreshSession(): Promise<
    StagingAuthOperationResult<StagingAuthSessionSnapshot>
  >;
};