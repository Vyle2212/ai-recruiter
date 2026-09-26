import path from "node:path";

import {
  verifySearchIndexExactSetRepairRequest,
  type SearchIndexExactSetRepairRequest,
} from "./searchIndexExactSetRepair";

export const SEARCH_INDEX_EXACT_SET_REPAIR_SQL =
  "supabase/manual/202609250000_candidate_search_index_exact_set_repair.sql";

const SHA256 = /^[0-9a-f]{64}$/;
const MAX_PLAN_AGE_MS = 24 * 60 * 60 * 1000;

export type SearchIndexRepairCutoverPlan = {
  artifact: "production_cutover_plan_v1";
  targetCommitSha: string;
  planFingerprint: string;
  generatedAt: string;
  recoveryVerified: true;
  databaseRestoreVerified: true;
  originalCvCollectionVerified: true;
  readyForSupervisedCutover: true;
  readyForBulkUpload: false;
  steps: Array<{ path: string; sha256: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function projectRefFromSupabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("search_index_repair_supabase_url_invalid");
  }
  const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (url.protocol !== "https:" || !match)
    throw new Error("search_index_repair_project_ref_unverified");
  return match[1].toLowerCase();
}

export function assertPrivateSearchIndexRepairArtifactPath(input: {
  repositoryRoot: string;
  artifactPath: string;
  requiredSuffix: string;
}) {
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const artifactPath = path.resolve(input.artifactPath);
  const relative = path.relative(repositoryRoot, artifactPath);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error("search_index_repair_private_artifact_inside_repository");
  if (!artifactPath.endsWith(input.requiredSuffix))
    throw new Error("search_index_repair_private_artifact_suffix_invalid");
  return artifactPath;
}

export function prepareSearchIndexExactSetRepairOperator(input: {
  request: unknown;
  cutoverPlan: SearchIndexRepairCutoverPlan;
  currentCommitSha: string;
  sqlSha256: string;
  now?: Date;
}) {
  const request = verifySearchIndexExactSetRepairRequest(
    input.request,
    input.currentCommitSha,
  );
  const plan = input.cutoverPlan;
  if (
    plan.artifact !== "production_cutover_plan_v1" ||
    plan.targetCommitSha !== input.currentCommitSha ||
    !SHA256.test(plan.planFingerprint) ||
    plan.recoveryVerified !== true ||
    plan.databaseRestoreVerified !== true ||
    plan.originalCvCollectionVerified !== true ||
    plan.readyForSupervisedCutover !== true ||
    plan.readyForBulkUpload !== false ||
    !Array.isArray(plan.steps)
  )
    throw new Error("search_index_repair_cutover_plan_invalid");

  const generatedAt = Date.parse(plan.generatedAt);
  const now = (input.now || new Date()).getTime();
  if (
    !Number.isFinite(generatedAt) ||
    generatedAt > now + 5 * 60 * 1000 ||
    now - generatedAt > MAX_PLAN_AGE_MS
  )
    throw new Error("search_index_repair_cutover_plan_stale");

  const sqlSteps = plan.steps.filter(
    (step) => step.path === SEARCH_INDEX_EXACT_SET_REPAIR_SQL,
  );
  if (
    !SHA256.test(input.sqlSha256) ||
    sqlSteps.length !== 1 ||
    sqlSteps[0].sha256 !== input.sqlSha256
  )
    throw new Error("search_index_repair_sql_fingerprint_mismatch");

  return {
    request,
    report: {
      artifact: "candidate_search_index_exact_set_repair_operator_preflight_v1",
      targetCommitSha: request.targetCommitSha,
      planFingerprint: request.planFingerprint,
      cutoverPlanFingerprint: plan.planFingerprint,
      rowsPlannedForDeletion: request.expectedDeleteCount,
      rowsExpectedAfterRepair: request.expectedRemainingIndexCount,
      recoveryVerified: true,
      sqlFingerprintVerified: true,
      readyForSupervisedExecution: true,
      databaseWrites: 0,
      privacy: {
        candidateIdentifiersSerialized: 0,
        candidateContactsSerialized: 0,
        cvContentsSerialized: 0,
      },
    } as const,
  };
}

export function validateSearchIndexExactSetRepairWriteControls(input: {
  writeRequested: boolean;
  writeEnabled: boolean;
  currentCommitSha: string;
  request: SearchIndexExactSetRepairRequest;
  expectedProjectRef: string;
  supabaseUrl: string;
  serviceRoleKeyAvailable: boolean;
  confirmation: string;
}) {
  if (!input.writeRequested) {
    if (input.writeEnabled || clean(input.confirmation))
      throw new Error("search_index_repair_write_controls_without_write");
    return { mode: "dry_run" as const };
  }
  if (!input.writeEnabled)
    throw new Error("search_index_repair_write_enablement_missing");
  verifySearchIndexExactSetRepairRequest(input.request, input.currentCommitSha);
  const expectedProjectRef = clean(input.expectedProjectRef).toLowerCase();
  if (!/^[a-z0-9-]{8,64}$/.test(expectedProjectRef))
    throw new Error("search_index_repair_expected_project_ref_missing");
  if (projectRefFromSupabaseUrl(input.supabaseUrl) !== expectedProjectRef)
    throw new Error("search_index_repair_project_ref_mismatch");
  if (!input.serviceRoleKeyAvailable)
    throw new Error("search_index_repair_service_role_missing");
  const expectedConfirmation = [
    "authorize-search-index-exact-set-repair",
    input.request.targetCommitSha,
    input.request.planFingerprint,
    expectedProjectRef,
    input.request.expectedDeleteCount,
    input.request.expectedRemainingIndexCount,
  ].join(":");
  if (input.confirmation !== expectedConfirmation)
    throw new Error("search_index_repair_confirmation_mismatch");
  return { mode: "write" as const, projectRef: expectedProjectRef };
}

export function verifySearchIndexExactSetRepairExecution(input: {
  result: unknown;
  request: SearchIndexExactSetRepairRequest;
  observedRemainingIndexCount: number;
}) {
  if (!input.result || typeof input.result !== "object")
    throw new Error("search_index_repair_execution_result_invalid");
  const result = input.result as Record<string, unknown>;
  if (
    result.artifact !==
      "candidate_search_index_exact_set_repair_execution_v1" ||
    result.targetCommitSha !== input.request.targetCommitSha ||
    result.planFingerprint !== input.request.planFingerprint ||
    result.rowsDeleted !== input.request.expectedDeleteCount ||
    result.rowsRemaining !== input.request.expectedRemainingIndexCount ||
    result.exactReadbackVerified !== true ||
    result.transactionCommitted !== true ||
    input.observedRemainingIndexCount !==
      input.request.expectedRemainingIndexCount
  )
    throw new Error("search_index_repair_execution_readback_mismatch");
  return {
    artifact: "candidate_search_index_exact_set_repair_operator_result_v1",
    targetCommitSha: input.request.targetCommitSha,
    planFingerprint: input.request.planFingerprint,
    rowsDeleted: input.request.expectedDeleteCount,
    rowsRemaining: input.observedRemainingIndexCount,
    exactReadbackVerified: true,
    productionAcceptanceComplete: false,
    privacy: {
      candidateIdentifiersSerialized: 0,
      candidateContactsSerialized: 0,
      cvContentsSerialized: 0,
    },
  } as const;
}
