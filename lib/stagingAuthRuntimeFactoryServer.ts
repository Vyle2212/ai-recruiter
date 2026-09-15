import "server-only";
import { acceptanceAuthConfigured } from "./acceptanceAuthConfiguration";
import { createSupabaseStagingRuntimeAdapter } from "./stagingAuthSupabaseRuntimeAdapter";

import { buildStagingAuthAdapterForGate } from "./stagingAuthAdapterFactory";
import { buildCurrentStagingAuthExecutionGate } from "./stagingAuthExecutionGateRuntime";
import { buildStagingAuthRuntimeAdapter } from "./stagingAuthRuntimeFactory";
import type { SupabaseStagingAuthClient } from "./stagingAuthSupabaseRuntimeAdapter";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";
import { createClient as createSupabaseServerClient } from "../utils/supabase/server";

async function createInjectedSupabaseClient(): Promise<SupabaseStagingAuthClient> {
  const client = await createSupabaseServerClient();

  // The runtime provider deliberately exposes only the narrow auth/profile
  // surface it needs. The Supabase SSR client implements that surface.
  return client as unknown as SupabaseStagingAuthClient;
}

export function buildCurrentStagingAuthRuntimeAdapter(): StagingAuthRuntimeAdapter {
  if (process.env.APP_ENV === "acceptance" && acceptanceAuthConfigured()) {
    const adapter = createSupabaseStagingRuntimeAdapter({
      explicitlyEnabled: true,
      createClient: createInjectedSupabaseClient,
    });
    // Acceptance identities are provisioned by the test harness. No reset emails.
    adapter.requestPasswordReset = async () => ({
      operation: "request_password_reset",
      ok: false,
      status: "blocked",
      data: null,
      blockerKeys: ["acceptance_password_reset_disabled"],
      warningKeys: [],
      sensitiveInputReturned: false,
      tokenReturned: false,
      realActionExecuted: false,
      productionBlocked: true,
    });
    return adapter;
  }
  const gate = buildCurrentStagingAuthExecutionGate();
  const fallbackAdapter = buildStagingAuthAdapterForGate(gate);

  return buildStagingAuthRuntimeAdapter({
    gate,
    fallbackAdapter,
    createSupabaseClient: createInjectedSupabaseClient,
  });
}
