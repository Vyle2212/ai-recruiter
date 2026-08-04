import "server-only";

import { buildStagingAuthAdapterForGate } from "./stagingAuthAdapterFactory";
import { buildCurrentStagingAuthExecutionGate } from "./stagingAuthExecutionGateRuntime";
import { buildStagingAuthRuntimeAdapter } from "./stagingAuthRuntimeFactory";
import type { SupabaseStagingAuthClient } from "./stagingAuthSupabaseRuntimeAdapter";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";
import { createClient as createSupabaseServerClient } from "../utils/supabase/server";

async function createInjectedSupabaseClient():
  Promise<SupabaseStagingAuthClient> {
  const client = await createSupabaseServerClient();

  // The runtime provider deliberately exposes only the narrow auth/profile
  // surface it needs. The Supabase SSR client implements that surface.
  return client as unknown as SupabaseStagingAuthClient;
}

export function buildCurrentStagingAuthRuntimeAdapter():
  StagingAuthRuntimeAdapter {
  const gate = buildCurrentStagingAuthExecutionGate();
  const fallbackAdapter =
    buildStagingAuthAdapterForGate(gate);

  return buildStagingAuthRuntimeAdapter({
    gate,
    fallbackAdapter,
    createSupabaseClient: createInjectedSupabaseClient,
  });
}