import { createAsyncRuntimeAdapter } from "./stagingAuthRuntimeAdapter";
import { createSupabaseStagingRuntimeAdapter } from "./stagingAuthSupabaseRuntimeAdapter";
import type { StagingAuthAdapter } from "./stagingAuthAdapterTypes";
import type { StagingAuthExecutionGate } from "./stagingAuthExecutionGateTypes";
import type {
  SupabaseStagingAuthClient,
} from "./stagingAuthSupabaseRuntimeAdapter";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";

export type StagingAuthRuntimeFactoryInput = {
  gate: StagingAuthExecutionGate;
  fallbackAdapter: StagingAuthAdapter;
  createSupabaseClient?: () => Promise<SupabaseStagingAuthClient>;
};

export function canUseSupabaseStagingRuntimeProvider(
  gate: StagingAuthExecutionGate,
): boolean {
  const authHelpers = gate.capabilityDecisions.find(
    (decision) => decision.capability === "auth_helpers",
  );

  return (
    gate.environment === "staging" &&
    gate.mode === "staging_approved" &&
    gate.status === "ready_for_staging_implementation" &&
    gate.globallyAllowed === true &&
    authHelpers?.allowed === true
  );
}

export function buildStagingAuthRuntimeAdapter(
  input: StagingAuthRuntimeFactoryInput,
): StagingAuthRuntimeAdapter {
  const providerAllowed =
    canUseSupabaseStagingRuntimeProvider(input.gate);

  if (providerAllowed && input.createSupabaseClient) {
    return createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: input.createSupabaseClient,
    });
  }

  return createAsyncRuntimeAdapter(input.fallbackAdapter);
}