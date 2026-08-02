import { createDisabledStagingAuthAdapter } from "./stagingAuthDisabledAdapter";
import { createAsyncRuntimeAdapter } from "./stagingAuthRuntimeAdapter";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";

export type SupabaseStagingRuntimeAdapterOptions = {
  explicitlyEnabled?: boolean;
};

export function createSupabaseStagingRuntimeAdapter(
  options: SupabaseStagingRuntimeAdapterOptions = {},
): StagingAuthRuntimeAdapter {
  if (options.explicitlyEnabled === true) {
    throw new Error(
      "supabase_staging_runtime_provider_not_implemented",
    );
  }

  const disabledAdapter = createDisabledStagingAuthAdapter({
    environment: "staging",
    executionGateStatus: "awaiting_enablement",
    authHelpersAllowed: false,
    simulationOnly: false,
    productionBlocked: true,
  });

  return createAsyncRuntimeAdapter(disabledAdapter);
}