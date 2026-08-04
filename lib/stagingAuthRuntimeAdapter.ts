import type {
  StagingAuthAdapter,
  StagingAuthOperationResult,
  StagingAuthSessionSnapshot,
  StagingAuthIdentity,
} from "./stagingAuthAdapterTypes";
import type {
  StagingAuthRuntimeAdapter,
  StagingAuthRuntimeIdentity,
  StagingAuthRuntimeOperationResult,
  StagingAuthRuntimeSessionSnapshot,
} from "./stagingAuthRuntimeAdapterTypes";

function mapIdentity(
  identity: StagingAuthIdentity | null | undefined,
): StagingAuthRuntimeIdentity | null {
  if (!identity) {
    return null;
  }

  return {
    ...identity,
    source: "preview_bridge",
    realUser: false,
  };
}

function mapSession(
  session: StagingAuthSessionSnapshot,
): StagingAuthRuntimeSessionSnapshot {
  return {
    status:
      (session.status === "preview_session" || session.status === "future_real_session") ? "authenticated" : session.status,
    ...(session.identity
      ? { identity: mapIdentity(session.identity) ?? undefined }
      : {}),
    expiresAt: session.expiresAt,
    tokenExposed: false,
    cookieUsed: false,
    realSession: false,
  };
}

function mapResult<TInput, TOutput>(
  result: StagingAuthOperationResult<TInput>,
  mapData: (data: TInput) => TOutput,
): StagingAuthRuntimeOperationResult<TOutput> {
  return {
    operation: result.operation,
    ok: result.ok,
    status:
      result.status === "success_preview"
        ? "success"
        : result.status === "preview_only"
          ? "provider_not_implemented"
          : result.status,
    ...(result.data === undefined
      ? {}
      : { data: mapData(result.data) }),
    blockerKeys: [...result.blockerKeys],
    warningKeys: [...result.warningKeys],
    ...(result.errorCode
      ? { errorCode: result.errorCode }
      : {}),
    sensitiveInputReturned: false,
    tokenReturned: false,
    realActionExecuted: false,
    productionBlocked: true,
  };
}

export function createAsyncRuntimeAdapter(
  adapter: StagingAuthAdapter,
): StagingAuthRuntimeAdapter {
  return {
    provider:
      adapter.provider === "disabled"
        ? "disabled"
        : "preview_bridge",

    getSession: async () =>
      mapResult(adapter.getSession(), mapSession),

    getUser: async () =>
      mapResult(adapter.getUser(), mapIdentity),

    getProfile: async () =>
      mapResult(adapter.getProfile(), (data) => data),

    signIn: async (input) =>
      mapResult(adapter.signIn(input), mapSession),

    signOut: async () =>
      mapResult(adapter.signOut(), (data) => data),

    requestPasswordReset: async (input) =>
      mapResult(
        adapter.requestPasswordReset(input),
        (data) => data,
      ),

    acceptInvitation: async (input) =>
      mapResult(
        adapter.acceptInvitation(input),
        (data) => data,
      ),

    refreshSession: async () =>
      mapResult(adapter.refreshSession(), mapSession),
  };
}