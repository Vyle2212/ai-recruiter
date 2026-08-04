import { maskAuthEmail } from "./stagingAuthDisabledAdapter";
import type {
  StagingAuthRuntimeAdapter,
  StagingAuthRuntimeOperationResult,
} from "./stagingAuthRuntimeAdapterTypes";
import type {
  StagingAuthRuntimeActionInput,
  StagingAuthRuntimeActionResult,
} from "./stagingAuthRuntimeActionTypes";

function safeCode(value: unknown): string | undefined {
  if (
    typeof value === "string" &&
    /^[a-z0-9_]{1,64}$/.test(value)
  ) {
    return value;
  }

  return undefined;
}

function validEmail(value: string): boolean {
  return (
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function safeMessage(
  status: StagingAuthRuntimeOperationResult<unknown>["status"],
  ok: boolean,
): string {
  if (ok) {
    return "The staging authentication operation completed successfully.";
  }

  if (status === "blocked") {
    return "The staging authentication operation is blocked by the current safety configuration.";
  }

  if (status === "provider_not_implemented") {
    return "The staging authentication provider is not available.";
  }

  return "The staging authentication operation failed safely.";
}

function mapResult(
  adapter: StagingAuthRuntimeAdapter,
  result: StagingAuthRuntimeOperationResult<unknown>,
  emailMasked?: string,
): StagingAuthRuntimeActionResult {
  const data =
    result.data && typeof result.data === "object"
      ? result.data as Record<string, unknown>
      : {};

  const identity =
    data.identity && typeof data.identity === "object"
      ? data.identity as Record<string, unknown>
      : data;

  const role =
    typeof identity.role === "string"
      ? identity.role as StagingAuthRuntimeActionResult["role"]
      : undefined;

  const authenticated =
    typeof identity.authenticated === "boolean"
      ? identity.authenticated
      : undefined;

  const sessionStatus =
    typeof data.status === "string" &&
    ["no_session", "blocked", "authenticated", "expired"].includes(
      data.status,
    )
      ? data.status as StagingAuthRuntimeActionResult["sessionStatus"]
      : undefined;

  return {
    operation: result.operation,
    provider: adapter.provider,
    status: result.status,
    ok: result.ok,
    safeMessage: safeMessage(result.status, result.ok),
    blockerKeys: result.blockerKeys.filter((key) =>
      /^[a-z0-9_]+$/.test(key),
    ),
    warningKeys: result.warningKeys.filter((key) =>
      /^[a-z0-9_]+$/.test(key),
    ),
    ...(safeCode(result.errorCode)
      ? { errorCode: safeCode(result.errorCode) }
      : {}),
    ...(emailMasked ? { emailMasked } : {}),
    ...(role ? { role } : {}),
    ...(authenticated === undefined
      ? {}
      : { authenticated }),
    ...(sessionStatus ? { sessionStatus } : {}),
    sensitiveInputReturned: false,
    passwordReturned: false,
    invitationTokenReturned: false,
    tokenReturned: false,
    stackTraceReturned: false,
    realActionExecuted: result.realActionExecuted,
    productionBlocked: true,
  };
}

function invalidInput(
  adapter: StagingAuthRuntimeAdapter,
  input: StagingAuthRuntimeActionInput,
  errorCode: string,
  emailMasked?: string,
): StagingAuthRuntimeActionResult {
  return {
    operation: input.operation,
    provider: adapter.provider,
    status: "failed_safe",
    ok: false,
    safeMessage: "Review the authentication input and try again.",
    blockerKeys: ["invalid_auth_input"],
    warningKeys: [],
    errorCode,
    ...(emailMasked ? { emailMasked } : {}),
    sensitiveInputReturned: false,
    passwordReturned: false,
    invitationTokenReturned: false,
    tokenReturned: false,
    stackTraceReturned: false,
    realActionExecuted: false,
    productionBlocked: true,
  };
}

export async function executeStagingAuthRuntimeAction(
  adapter: StagingAuthRuntimeAdapter,
  input: StagingAuthRuntimeActionInput,
): Promise<StagingAuthRuntimeActionResult> {
  try {
    switch (input.operation) {
      case "sign_in": {
        const email = input.email.trim().toLowerCase();
        const emailMasked = maskAuthEmail(email);

        if (!validEmail(email) || input.password.length < 1) {
          return invalidInput(
            adapter,
            input,
            "invalid_sign_in_input",
            emailMasked,
          );
        }

        const result = await adapter.signIn({
          email,
          password: input.password,
        });

        return mapResult(adapter, result, emailMasked);
      }

      case "request_password_reset": {
        const email = input.email.trim().toLowerCase();
        const emailMasked = maskAuthEmail(email);

        if (!validEmail(email)) {
          return invalidInput(
            adapter,
            input,
            "invalid_password_reset_input",
            emailMasked,
          );
        }

        const result = await adapter.requestPasswordReset({
          email,
        });

        return mapResult(adapter, result, emailMasked);
      }

      case "accept_invitation": {
        if (!input.invitationToken.trim()) {
          return invalidInput(
            adapter,
            input,
            "invalid_invitation_input",
          );
        }

        return mapResult(
          adapter,
          await adapter.acceptInvitation({
            invitationToken: input.invitationToken,
          }),
        );
      }

      case "sign_out":
        return mapResult(adapter, await adapter.signOut());

      case "get_session":
        return mapResult(adapter, await adapter.getSession());

      case "get_user":
        return mapResult(adapter, await adapter.getUser());

      case "get_profile":
        return mapResult(adapter, await adapter.getProfile());

      case "refresh_session":
        return mapResult(adapter, await adapter.refreshSession());
    }
  } catch {
    return {
      operation: input.operation,
      provider: adapter.provider,
      status: "failed_safe",
      ok: false,
      safeMessage: "The staging authentication operation failed safely.",
      blockerKeys: ["runtime_action_failed_safe"],
      warningKeys: [],
      errorCode: "runtime_action_failed_safe",
      sensitiveInputReturned: false,
      passwordReturned: false,
      invitationTokenReturned: false,
      tokenReturned: false,
      stackTraceReturned: false,
      realActionExecuted: false,
      productionBlocked: true,
    };
  }
}