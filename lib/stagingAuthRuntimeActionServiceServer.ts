import "server-only";

import { buildCurrentStagingAuthRuntimeAdapter } from "./stagingAuthRuntimeFactoryServer";
import { executeStagingAuthRuntimeAction } from "./stagingAuthRuntimeActionService";
import type { StagingAuthRuntimeActionInput } from "./stagingAuthRuntimeActionTypes";

export async function executeCurrentStagingAuthRuntimeAction(
  input: StagingAuthRuntimeActionInput,
) {
  const adapter = buildCurrentStagingAuthRuntimeAdapter();

  return executeStagingAuthRuntimeAction(adapter, input);
}