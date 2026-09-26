import "server-only";

import {
  assertEmploymentPromotionExecutionGate,
  type EmploymentPromotionExecutionGateInput,
  type EmploymentPromotionExecutionReport,
} from "./productionEmploymentPromotionBatch";

const rpcName = "apply_reviewed_employment_promotion_batch";

type SupabaseRpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type EmploymentPromotionSupabaseClient = {
  rpc(
    functionName: typeof rpcName,
    parameters: { p_request: unknown },
  ): PromiseLike<SupabaseRpcResult>;
};

export type EmploymentPromotionSupabaseExecutionReport =
  EmploymentPromotionExecutionReport & {
    searchIndexRowsInvalidated: number;
  };

function integer(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseExecutionReport(
  value: unknown,
  gate: EmploymentPromotionExecutionGateInput,
): EmploymentPromotionSupabaseExecutionReport {
  if (!value || typeof value !== "object")
    throw new Error("Employment promotion RPC returned no aggregate report");
  const report = value as Record<string, unknown>;
  if (
    report.artifact !== "reviewed_employment_promotion_execution_v1" ||
    report.targetCommitSha !== gate.preflight.targetCommitSha ||
    report.manifestFingerprint !== gate.preflight.manifestFingerprint ||
    report.candidatesUpdated !== gate.preflight.entries ||
    report.additionsWritten !== gate.preflight.additions ||
    report.readbacksVerified !== gate.preflight.entries ||
    report.transactionCommitted !== true ||
    !integer(report.searchIndexRowsInvalidated) ||
    (report.searchIndexRowsInvalidated as number) > gate.preflight.entries
  )
    throw new Error("Employment promotion RPC aggregate readback mismatch");
  const privacy = report.privacy as Record<string, unknown> | undefined;
  if (
    privacy?.candidateIdentifiersSerialized !== 0 ||
    privacy?.employmentRowsSerialized !== 0
  )
    throw new Error("Employment promotion RPC privacy contract mismatch");
  return report as EmploymentPromotionSupabaseExecutionReport;
}

export async function executeEmploymentPromotionBatchViaSupabase(
  input: EmploymentPromotionExecutionGateInput & {
    client: EmploymentPromotionSupabaseClient;
  },
): Promise<EmploymentPromotionSupabaseExecutionReport> {
  assertEmploymentPromotionExecutionGate(input);
  const request = {
    artifact: "reviewed_employment_promotion_rpc_v1",
    targetCommitSha: input.preflight.targetCommitSha,
    manifestFingerprint: input.preflight.manifestFingerprint,
    preflightFingerprint: input.preflight.preflightFingerprint,
    candidateSetFingerprint: input.preflight.candidateSetFingerprint,
    sourceStateFingerprint: input.preflight.sourceStateFingerprint,
    entries: input.preflight.entries,
    additions: input.preflight.additions,
    operations: input.preflight.operations,
  };
  const { data, error } = await input.client.rpc(rpcName, {
    p_request: request,
  });
  if (error)
    throw new Error(
      `Employment promotion RPC failed: ${error.message || "database refused the transaction"}`,
    );
  return parseExecutionReport(data, input);
}
