import { createHash } from "node:crypto";
import {
  verifyPrivateEmploymentPromotionBackup,
  type PrivateEmploymentPromotionBackupArtifact,
} from "./productionEmploymentPromotionBackup";
import {
  buildEmploymentPromotionExecutionAuthorization,
  type EmploymentPromotionExecutionAuthorization,
} from "./productionEmploymentPromotionBatch";
import {
  prepareEmploymentPromotionOperatorRun,
  type EmploymentPromotionOperatorBundle,
} from "./productionEmploymentPromotionOperator";

export type PrivateEmploymentPromotionAuthorizationArtifact = {
  artifact: "private_employment_promotion_authorization_v1";
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  backupFingerprint: string;
  authorization: EmploymentPromotionExecutionAuthorization;
  artifactFingerprint: string;
};

export type EmploymentPromotionAuthorizationReport = {
  artifact: "employment_promotion_authorization_report_v1";
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  backupFingerprint: string;
  authorizationFingerprint: string;
  entries: number;
  additions: number;
  backupVerified: true;
  authorizationVerified: true;
  readyForSingleTransactionRpc: true;
  readyForWrite: false;
  privacy: {
    candidateIdentifiersSerialized: 0;
    employmentRowsSerialized: 0;
  };
  databaseWrites: 0;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function withoutArtifactFingerprint(
  artifact: PrivateEmploymentPromotionAuthorizationArtifact,
) {
  const { artifactFingerprint: _artifactFingerprint, ...contents } = artifact;
  return contents;
}

export function employmentPromotionAuthorizationConfirmation(input: {
  targetCommitSha: string;
  preflightFingerprint: string;
  backupFingerprint: string;
}) {
  return [
    "authorize-reviewed-additive-backfill",
    input.targetCommitSha,
    input.preflightFingerprint,
    input.backupFingerprint,
  ].join(":");
}

function assertAuthorizationPhase(bundle: EmploymentPromotionOperatorBundle) {
  if (!bundle.backup || bundle.authorization)
    throw new Error(
      "Employment promotion authorization refused: verified backup required and prior authorization forbidden",
    );
}

export function buildPrivateEmploymentPromotionAuthorization(input: {
  bundle: EmploymentPromotionOperatorBundle;
  backup: PrivateEmploymentPromotionBackupArtifact;
  expectedCommitSha: string;
  authorizedBy: string;
  authorizedAt: string;
  confirmation: string;
}): {
  authorization: PrivateEmploymentPromotionAuthorizationArtifact;
  report: EmploymentPromotionAuthorizationReport;
} {
  assertAuthorizationPhase(input.bundle);
  const backupEvidence = verifyPrivateEmploymentPromotionBackup({
    backup: input.backup,
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  const expectedConfirmation = employmentPromotionAuthorizationConfirmation({
    targetCommitSha: prepared.preflight.targetCommitSha,
    preflightFingerprint: prepared.preflight.preflightFingerprint,
    backupFingerprint: input.backup.backupFingerprint,
  });
  if (input.confirmation !== expectedConfirmation)
    throw new Error(
      "Employment promotion authorization refused: exact release confirmation mismatch",
    );
  const executionAuthorization = buildEmploymentPromotionExecutionAuthorization(
    {
      preflight: prepared.preflight,
      backup: backupEvidence,
      authorizedBy: input.authorizedBy,
      authorizedAt: input.authorizedAt,
      expectedCommitSha: input.expectedCommitSha,
    },
  );
  const withoutFingerprint: Omit<
    PrivateEmploymentPromotionAuthorizationArtifact,
    "artifactFingerprint"
  > = {
    artifact: "private_employment_promotion_authorization_v1",
    targetCommitSha: prepared.preflight.targetCommitSha,
    manifestFingerprint: prepared.preflight.manifestFingerprint,
    preflightFingerprint: prepared.preflight.preflightFingerprint,
    candidateSetFingerprint: prepared.preflight.candidateSetFingerprint,
    sourceStateFingerprint: prepared.preflight.sourceStateFingerprint,
    backupFingerprint: input.backup.backupFingerprint,
    authorization: executionAuthorization,
  };
  const authorization: PrivateEmploymentPromotionAuthorizationArtifact = {
    ...withoutFingerprint,
    artifactFingerprint: fingerprint(withoutFingerprint),
  };
  return {
    authorization,
    report: authorizationReport({
      authorization,
      entries: prepared.preflight.entries,
      additions: prepared.preflight.additions,
    }),
  };
}

export function attachVerifiedEmploymentPromotionAuthorization(input: {
  bundle: EmploymentPromotionOperatorBundle;
  backup: PrivateEmploymentPromotionBackupArtifact;
  authorization: PrivateEmploymentPromotionAuthorizationArtifact;
  expectedCommitSha: string;
}): {
  bundle: EmploymentPromotionOperatorBundle;
  report: EmploymentPromotionAuthorizationReport;
} {
  assertAuthorizationPhase(input.bundle);
  const { authorization } = input;
  if (
    authorization.artifact !== "private_employment_promotion_authorization_v1"
  )
    throw new Error(
      "Employment promotion authorization refused: artifact mismatch",
    );
  if (
    fingerprint(withoutArtifactFingerprint(authorization)) !==
    authorization.artifactFingerprint
  )
    throw new Error(
      "Employment promotion authorization refused: persisted authorization content changed",
    );
  const backupEvidence = verifyPrivateEmploymentPromotionBackup({
    backup: input.backup,
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (
    authorization.targetCommitSha !== prepared.preflight.targetCommitSha ||
    authorization.manifestFingerprint !==
      prepared.preflight.manifestFingerprint ||
    authorization.preflightFingerprint !==
      prepared.preflight.preflightFingerprint ||
    authorization.candidateSetFingerprint !==
      prepared.preflight.candidateSetFingerprint ||
    authorization.sourceStateFingerprint !==
      prepared.preflight.sourceStateFingerprint ||
    authorization.backupFingerprint !== input.backup.backupFingerprint
  )
    throw new Error(
      "Employment promotion authorization refused: authorization does not match backup-ready preflight",
    );
  const expectedExecutionAuthorization =
    buildEmploymentPromotionExecutionAuthorization({
      preflight: prepared.preflight,
      backup: backupEvidence,
      authorizedBy: authorization.authorization.authorizedBy,
      authorizedAt: authorization.authorization.authorizedAt,
      expectedCommitSha: input.expectedCommitSha,
    });
  if (
    stableJson(expectedExecutionAuthorization) !==
    stableJson(authorization.authorization)
  )
    throw new Error(
      "Employment promotion authorization refused: execution authorization changed",
    );
  const bundle: EmploymentPromotionOperatorBundle = {
    ...structuredClone(input.bundle),
    authorization: structuredClone(authorization.authorization),
  };
  const verified = prepareEmploymentPromotionOperatorRun({
    bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (!verified.report.readyForSingleTransactionRpc)
    throw new Error(
      "Employment promotion authorization refused: operator gate remains closed",
    );
  return {
    bundle,
    report: authorizationReport({
      authorization,
      entries: verified.preflight.entries,
      additions: verified.preflight.additions,
    }),
  };
}

export function verifyPersistedEmploymentPromotionExecutionBundle(input: {
  bundle: EmploymentPromotionOperatorBundle;
  backup: PrivateEmploymentPromotionBackupArtifact;
  authorization: PrivateEmploymentPromotionAuthorizationArtifact;
  expectedCommitSha: string;
}) {
  if (!input.bundle.backup || !input.bundle.authorization)
    throw new Error(
      "Employment promotion execution refused: backup and authorization must be present in the operator bundle",
    );
  const backupReadyBundle: EmploymentPromotionOperatorBundle = {
    ...structuredClone(input.bundle),
    authorization: undefined,
  };
  const verifiedBackup = verifyPrivateEmploymentPromotionBackup({
    backup: input.backup,
    bundle: backupReadyBundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (stableJson(input.bundle.backup) !== stableJson(verifiedBackup))
    throw new Error(
      "Employment promotion execution refused: operator backup differs from the persisted private artifact",
    );
  const verified = attachVerifiedEmploymentPromotionAuthorization({
    bundle: backupReadyBundle,
    backup: input.backup,
    authorization: input.authorization,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (
    stableJson(input.bundle.authorization) !==
    stableJson(verified.bundle.authorization)
  )
    throw new Error(
      "Employment promotion execution refused: operator authorization differs from the persisted private artifact",
    );
  return verified;
}

function authorizationReport(input: {
  authorization: PrivateEmploymentPromotionAuthorizationArtifact;
  entries: number;
  additions: number;
}): EmploymentPromotionAuthorizationReport {
  return {
    artifact: "employment_promotion_authorization_report_v1",
    targetCommitSha: input.authorization.targetCommitSha,
    manifestFingerprint: input.authorization.manifestFingerprint,
    preflightFingerprint: input.authorization.preflightFingerprint,
    candidateSetFingerprint: input.authorization.candidateSetFingerprint,
    sourceStateFingerprint: input.authorization.sourceStateFingerprint,
    backupFingerprint: input.authorization.backupFingerprint,
    authorizationFingerprint:
      input.authorization.authorization.authorizationFingerprint,
    entries: input.entries,
    additions: input.additions,
    backupVerified: true,
    authorizationVerified: true,
    readyForSingleTransactionRpc: true,
    readyForWrite: false,
    privacy: {
      candidateIdentifiersSerialized: 0,
      employmentRowsSerialized: 0,
    },
    databaseWrites: 0,
  };
}
