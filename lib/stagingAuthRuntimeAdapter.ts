import type { StagingAuthAdapter } from "./stagingAuthAdapterTypes";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";

export function createAsyncRuntimeAdapter(
  adapter: StagingAuthAdapter,
): StagingAuthRuntimeAdapter {
  return {
    getSession: async () => adapter.getSession(),
    getUser: async () => adapter.getUser(),
    getProfile: async () => adapter.getProfile(),

    signIn: async (input) => adapter.signIn(input),
    signOut: async () => adapter.signOut(),

    requestPasswordReset: async (input) =>
      adapter.requestPasswordReset(input),

    acceptInvitation: async (input) =>
      adapter.acceptInvitation(input),

    refreshSession: async () => adapter.refreshSession(),
  };
}