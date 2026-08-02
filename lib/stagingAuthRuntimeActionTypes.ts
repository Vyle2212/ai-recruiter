import type {
  StagingAuthActorRole,
  StagingAuthOperationKey,
} from "./stagingAuthAdapterTypes";
import type {
  StagingAuthRuntimeProvider,
  StagingAuthRuntimeStatus,
} from "./stagingAuthRuntimeAdapterTypes";

export type StagingAuthRuntimeActionInput =
  | {
      operation: "sign_in";
      email: string;
      password: string;
    }
  | {
      operation: "request_password_reset";
      email: string;
    }
  | {
      operation: "accept_invitation";
      invitationToken: string;
    }
  | {
      operation:
        | "sign_out"
        | "get_session"
        | "get_user"
        | "get_profile"
        | "refresh_session";
    };

export type StagingAuthRuntimeActionResult = {
  operation: StagingAuthOperationKey;
  provider: StagingAuthRuntimeProvider;
  status: StagingAuthRuntimeStatus;
  ok: boolean;
  safeMessage: string;
  blockerKeys: string[];
  warningKeys: string[];
  errorCode?: string;
  emailMasked?: string;
  role?: StagingAuthActorRole;
  authenticated?: boolean;
  sessionStatus?: "no_session" | "blocked" | "authenticated" | "expired";
  sensitiveInputReturned: false;
  passwordReturned: false;
  invitationTokenReturned: false;
  tokenReturned: false;
  stackTraceReturned: false;
  realActionExecuted: boolean;
  productionBlocked: true;
};