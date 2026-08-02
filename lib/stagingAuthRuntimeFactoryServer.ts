import "server-only";

import { buildCurrentStagingAuthAdapter } from "./stagingAuthAdapterFactoryServer";
import { createAsyncRuntimeAdapter } from "./stagingAuthRuntimeAdapter";
import type { StagingAuthRuntimeAdapter } from "./stagingAuthRuntimeAdapterTypes";

export function buildCurrentStagingAuthRuntimeAdapter():
  StagingAuthRuntimeAdapter {
  return createAsyncRuntimeAdapter(
    buildCurrentStagingAuthAdapter(),
  );
}