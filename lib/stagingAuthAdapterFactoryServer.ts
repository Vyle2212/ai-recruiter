import "server-only";
import {buildCurrentStagingAuthExecutionGate} from "./stagingAuthExecutionGateRuntime";
import {buildStagingAuthAdapterForGate,getStagingAuthAdapterDecision as describeStagingAuthAdapter} from "./stagingAuthAdapterFactory";
export {assertStagingAuthAdapterNotProduction,buildStagingAuthAdapterForGate} from "./stagingAuthAdapterFactory";
export function buildCurrentStagingAuthAdapter(){return buildStagingAuthAdapterForGate(buildCurrentStagingAuthExecutionGate())}
export function getStagingAuthAdapterDecision(){return describeStagingAuthAdapter(buildCurrentStagingAuthAdapter())}
