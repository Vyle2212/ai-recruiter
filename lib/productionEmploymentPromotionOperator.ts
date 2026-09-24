import path from "node:path";
import {
  assertEmploymentPromotionBackupEvidence,
  assertEmploymentPromotionExecutionGate,
  preflightEmploymentPromotionBatch,
  type EmploymentPromotionBackupEvidence,
  type EmploymentPromotionCandidateState,
  type EmploymentPromotionExecutionAuthorization,
  type EmploymentPromotionManifest,
} from "./productionEmploymentPromotionBatch";

export type EmploymentPromotionOperatorBundle = {
  artifact: "reviewed_employment_promotion_operator_bundle_v1";
  manifest: EmploymentPromotionManifest;
  currentCandidates: EmploymentPromotionCandidateState[];
  backup?: EmploymentPromotionBackupEvidence;
  authorization?: EmploymentPromotionExecutionAuthorization;
};

export type EmploymentPromotionOperatorPreflightReport = {
  artifact: "reviewed_employment_promotion_operator_preflight_v1";
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  entries: number;
  additions: number;
  emptyToPopulated: number;
  existingAdditive: number;
  backupVerified: boolean;
  authorizationVerified: boolean;
  readyForSingleTransactionRpc: boolean;
  searchIndexRebuildRequiredAfterWrite: true;
  privacy: {
    candidateIdentifiersSerialized: 0;
    employmentRowsSerialized: 0;
  };
  databaseWrites: 0;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function assertSha(value: string, label: string) {
  if (!/^[a-f0-9]{40}$/i.test(value))
    throw new Error(`${label} must be a full commit SHA`);
}

export function prepareEmploymentPromotionOperatorRun(input: {
  bundle: EmploymentPromotionOperatorBundle;
  expectedCommitSha: string;
}) {
  if (
    input.bundle.artifact !== "reviewed_employment_promotion_operator_bundle_v1"
  )
    throw new Error("Employment promotion operator bundle artifact mismatch");
  const preflight = preflightEmploymentPromotionBatch({
    manifest: input.bundle.manifest,
    currentCandidates: input.bundle.currentCandidates,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (input.bundle.authorization && !input.bundle.backup)
    throw new Error(
      "Employment promotion operator refused: authorization cannot precede backup",
    );
  if (input.bundle.backup)
    assertEmploymentPromotionBackupEvidence({
      preflight,
      backup: input.bundle.backup,
      expectedCommitSha: input.expectedCommitSha,
    });
  if (input.bundle.backup && input.bundle.authorization)
    assertEmploymentPromotionExecutionGate({
      preflight,
      backup: input.bundle.backup,
      authorization: input.bundle.authorization,
      expectedCommitSha: input.expectedCommitSha,
    });
  const report: EmploymentPromotionOperatorPreflightReport = {
    artifact: "reviewed_employment_promotion_operator_preflight_v1",
    targetCommitSha: preflight.targetCommitSha,
    manifestFingerprint: preflight.manifestFingerprint,
    preflightFingerprint: preflight.preflightFingerprint,
    candidateSetFingerprint: preflight.candidateSetFingerprint,
    sourceStateFingerprint: preflight.sourceStateFingerprint,
    entries: preflight.entries,
    additions: preflight.additions,
    emptyToPopulated: preflight.emptyToPopulated,
    existingAdditive: preflight.existingAdditive,
    backupVerified: Boolean(input.bundle.backup),
    authorizationVerified: Boolean(input.bundle.authorization),
    readyForSingleTransactionRpc: Boolean(
      input.bundle.backup && input.bundle.authorization,
    ),
    searchIndexRebuildRequiredAfterWrite: true,
    privacy: {
      candidateIdentifiersSerialized: 0,
      employmentRowsSerialized: 0,
    },
    databaseWrites: 0,
  };
  return { preflight, report };
}

export function assertPrivateEmploymentPromotionBundlePath(input: {
  bundlePath: string;
  repositoryRoot: string;
}) {
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const bundlePath = path.resolve(input.bundlePath);
  const relative = path.relative(repositoryRoot, bundlePath);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
    throw new Error(
      "Employment promotion operator refused: private bundle must be outside the repository",
    );
  return bundlePath;
}

function projectRefFromSupabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Employment promotion operator refused: invalid Supabase URL",
    );
  }
  const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (url.protocol !== "https:" || !match)
    throw new Error(
      "Employment promotion operator refused: Supabase project ref cannot be verified",
    );
  return match[1].toLowerCase();
}

export function validateEmploymentPromotionWriteControls(input: {
  writeRequested: boolean;
  writeEnabled: boolean;
  currentCommitSha: string;
  preflightFingerprint: string;
  targetCommitSha: string;
  expectedProjectRef: string;
  supabaseUrl: string;
  serviceRoleKeyAvailable: boolean;
  confirmation: string;
}) {
  if (!input.writeRequested) {
    if (input.writeEnabled || clean(input.confirmation))
      throw new Error(
        "Employment promotion operator refused: write controls supplied without --write",
      );
    return { mode: "dry_run" as const };
  }
  if (!input.writeEnabled)
    throw new Error(
      "Employment promotion operator refused: explicit write enablement missing",
    );
  assertSha(input.currentCommitSha, "currentCommitSha");
  assertSha(input.targetCommitSha, "targetCommitSha");
  if (input.currentCommitSha !== input.targetCommitSha)
    throw new Error(
      "Employment promotion operator refused: checked-out commit does not match reviewed target",
    );
  if (!/^[a-f0-9]{64}$/.test(input.preflightFingerprint))
    throw new Error(
      "Employment promotion operator refused: invalid preflight fingerprint",
    );
  const expectedProjectRef = clean(input.expectedProjectRef).toLowerCase();
  if (!/^[a-z0-9-]{8,64}$/.test(expectedProjectRef))
    throw new Error(
      "Employment promotion operator refused: expected project ref missing",
    );
  if (projectRefFromSupabaseUrl(input.supabaseUrl) !== expectedProjectRef)
    throw new Error(
      "Employment promotion operator refused: Supabase project ref mismatch",
    );
  if (!input.serviceRoleKeyAvailable)
    throw new Error(
      "Employment promotion operator refused: server service-role credential missing",
    );
  const expectedConfirmation = [
    "authorize-reviewed-additive-backfill",
    input.targetCommitSha,
    input.preflightFingerprint,
    expectedProjectRef,
  ].join(":");
  if (input.confirmation !== expectedConfirmation)
    throw new Error(
      "Employment promotion operator refused: exact write confirmation mismatch",
    );
  return { mode: "write" as const, projectRef: expectedProjectRef };
}
