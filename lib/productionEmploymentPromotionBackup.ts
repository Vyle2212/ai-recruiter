import { createHash } from "node:crypto";
import {
  buildEmploymentPromotionBackupEvidenceFromReadback,
  type EmploymentPromotionBackupEvidence,
  type EmploymentPromotionCandidateState,
} from "./productionEmploymentPromotionBatch";
import {
  prepareEmploymentPromotionOperatorRun,
  type EmploymentPromotionOperatorBundle,
} from "./productionEmploymentPromotionOperator";
import { buildEmploymentReviewInputsFromCandidateRows } from "./productionEmploymentReviewPack";

type CandidateRow = Record<string, unknown>;

export type PrivateEmploymentPromotionBackupSnapshot = {
  artifact: "private_production_candidate_snapshot_v1";
  capturedAt: string;
  rows: CandidateRow[];
};

export type PrivateEmploymentPromotionBackupArtifact = {
  artifact: "private_employment_promotion_backup_v1";
  capturedAt: string;
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  candidateCount: number;
  candidates: EmploymentPromotionCandidateState[];
  backupFingerprint: string;
};

export type EmploymentPromotionBackupReport = {
  artifact: "employment_promotion_backup_report_v1";
  targetCommitSha: string;
  manifestFingerprint: string;
  preflightFingerprint: string;
  backupFingerprint: string;
  candidateSetFingerprint: string;
  sourceStateFingerprint: string;
  candidateCount: number;
  backupVerified: true;
  readyForAuthorization: true;
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

function withoutBackupFingerprint(
  backup: PrivateEmploymentPromotionBackupArtifact,
) {
  const { backupFingerprint: _backupFingerprint, ...contents } = backup;
  return contents;
}

function candidateStatesFromSnapshot(
  snapshot: PrivateEmploymentPromotionBackupSnapshot,
  candidateIds: readonly string[],
) {
  if (
    snapshot.artifact !== "private_production_candidate_snapshot_v1" ||
    !Array.isArray(snapshot.rows)
  )
    throw new Error("Employment promotion backup refused: snapshot mismatch");
  const candidates = buildEmploymentReviewInputsFromCandidateRows(
    snapshot.rows,
  ).map(({ candidateId, sourceUpdatedAt, employmentHistory }) => ({
    candidateId,
    sourceUpdatedAt,
    employmentHistory,
  }));
  if (
    new Set(candidates.map(({ candidateId }) => candidateId)).size !==
    candidates.length
  )
    throw new Error(
      "Employment promotion backup refused: snapshot contains duplicate candidate IDs",
    );
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  return candidateIds.map((candidateId) => {
    const candidate = candidateById.get(candidateId);
    if (!candidate)
      throw new Error(
        "Employment promotion backup refused: approved candidate missing from snapshot",
      );
    return candidate;
  });
}

export function buildPrivateEmploymentPromotionBackup(input: {
  bundle: EmploymentPromotionOperatorBundle;
  snapshot: PrivateEmploymentPromotionBackupSnapshot;
  expectedCommitSha: string;
}): {
  backup: PrivateEmploymentPromotionBackupArtifact;
  report: EmploymentPromotionBackupReport;
} {
  if (input.bundle.backup || input.bundle.authorization)
    throw new Error(
      "Employment promotion backup refused: bundle already has backup or authorization",
    );
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  const readback = buildEmploymentPromotionBackupEvidenceFromReadback({
    preflight: prepared.preflight,
    candidates: candidateStatesFromSnapshot(
      input.snapshot,
      prepared.preflight.operations.map(({ candidateId }) => candidateId),
    ),
    capturedAt: input.snapshot.capturedAt,
    expectedCommitSha: input.expectedCommitSha,
  });
  const withoutFingerprint: Omit<
    PrivateEmploymentPromotionBackupArtifact,
    "backupFingerprint"
  > = {
    artifact: "private_employment_promotion_backup_v1",
    capturedAt: readback.evidence.capturedAt,
    targetCommitSha: prepared.preflight.targetCommitSha,
    manifestFingerprint: prepared.preflight.manifestFingerprint,
    preflightFingerprint: prepared.preflight.preflightFingerprint,
    candidateSetFingerprint: prepared.preflight.candidateSetFingerprint,
    sourceStateFingerprint: prepared.preflight.sourceStateFingerprint,
    candidateCount: readback.candidates.length,
    candidates: readback.candidates,
  };
  const backup: PrivateEmploymentPromotionBackupArtifact = {
    ...withoutFingerprint,
    backupFingerprint: fingerprint(withoutFingerprint),
  };
  return { backup, report: backupReport(backup) };
}

function verifyBackupArtifact(input: {
  backup: PrivateEmploymentPromotionBackupArtifact;
  bundle: EmploymentPromotionOperatorBundle;
  expectedCommitSha: string;
}): EmploymentPromotionBackupEvidence {
  const { backup } = input;
  if (backup.artifact !== "private_employment_promotion_backup_v1")
    throw new Error("Employment promotion backup refused: artifact mismatch");
  if (
    fingerprint(withoutBackupFingerprint(backup)) !== backup.backupFingerprint
  )
    throw new Error(
      "Employment promotion backup refused: persisted backup content changed",
    );
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle: input.bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (
    backup.targetCommitSha !== prepared.preflight.targetCommitSha ||
    backup.manifestFingerprint !== prepared.preflight.manifestFingerprint ||
    backup.preflightFingerprint !== prepared.preflight.preflightFingerprint ||
    backup.candidateSetFingerprint !==
      prepared.preflight.candidateSetFingerprint ||
    backup.sourceStateFingerprint !== prepared.preflight.sourceStateFingerprint
  )
    throw new Error(
      "Employment promotion backup refused: backup does not match operator preflight",
    );
  if (backup.candidateCount !== backup.candidates.length)
    throw new Error(
      "Employment promotion backup refused: backup candidate count changed",
    );
  return buildEmploymentPromotionBackupEvidenceFromReadback({
    preflight: prepared.preflight,
    candidates: backup.candidates,
    capturedAt: backup.capturedAt,
    expectedCommitSha: input.expectedCommitSha,
  }).evidence;
}

export function attachVerifiedEmploymentPromotionBackup(input: {
  backup: PrivateEmploymentPromotionBackupArtifact;
  bundle: EmploymentPromotionOperatorBundle;
  expectedCommitSha: string;
}): {
  bundle: EmploymentPromotionOperatorBundle;
  report: EmploymentPromotionBackupReport;
} {
  if (input.bundle.backup || input.bundle.authorization)
    throw new Error(
      "Employment promotion backup refused: bundle already has backup or authorization",
    );
  const evidence = verifyBackupArtifact(input);
  const bundle: EmploymentPromotionOperatorBundle = {
    ...structuredClone(input.bundle),
    backup: evidence,
  };
  const prepared = prepareEmploymentPromotionOperatorRun({
    bundle,
    expectedCommitSha: input.expectedCommitSha,
  });
  if (!prepared.report.backupVerified || prepared.report.authorizationVerified)
    throw new Error(
      "Employment promotion backup refused: operator backup phase mismatch",
    );
  return { bundle, report: backupReport(input.backup) };
}

function backupReport(
  backup: PrivateEmploymentPromotionBackupArtifact,
): EmploymentPromotionBackupReport {
  return {
    artifact: "employment_promotion_backup_report_v1",
    targetCommitSha: backup.targetCommitSha,
    manifestFingerprint: backup.manifestFingerprint,
    preflightFingerprint: backup.preflightFingerprint,
    backupFingerprint: backup.backupFingerprint,
    candidateSetFingerprint: backup.candidateSetFingerprint,
    sourceStateFingerprint: backup.sourceStateFingerprint,
    candidateCount: backup.candidateCount,
    backupVerified: true,
    readyForAuthorization: true,
    readyForWrite: false,
    privacy: {
      candidateIdentifiersSerialized: 0,
      employmentRowsSerialized: 0,
    },
    databaseWrites: 0,
  };
}
