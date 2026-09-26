import { createHash } from "node:crypto";

export const PRODUCTION_CUTOVER_SQL_SEQUENCE = [
  "supabase/manual/202609240002_reviewed_employment_promotion_transaction.sql",
  "supabase/manual/202609250000_candidate_search_index_exact_set_repair.sql",
  "supabase/manual/202609230000_production_private_data_rls_snapshot.sql",
  "supabase/manual/202609230001_production_private_data_rls_cutover.sql",
  "supabase/manual/202609230002_production_private_data_rls_readback.sql",
  // Installed on production 2026-09-26; its readback remains mandatory.
  "supabase/manual/202609240012_production_initial_owner_bootstrap.sql",
  "supabase/manual/202609240013_production_auth_foundation_readback.sql",
  // Installed on production 2026-09-26; revalidate the private bucket below.
  "supabase/manual/202609260000_private_original_cv_bucket_limit.sql",
  "supabase/manual/202609240004_private_original_cv_archive_readback.sql",
  "supabase/manual/202609240005_candidate_profile_claim_and_provenance.sql",
  "supabase/manual/202609240006_candidate_profile_claim_readback.sql",
  "supabase/manual/202609240007_candidate_full_profile_fields.sql",
  "supabase/manual/202609240008_candidate_full_profile_fields_readback.sql",
  "supabase/manual/202609240009_candidate_upload_review_queue.sql",
  "supabase/manual/202609240010_candidate_upload_review_queue_readback.sql",
  "supabase/manual/202609240014_candidate_owned_cv_update.sql",
  "supabase/manual/202609240015_candidate_owned_cv_update_readback.sql",
  "supabase/manual/202609240016_candidate_profile_confirmation.sql",
  "supabase/manual/202609240017_candidate_profile_confirmation_readback.sql",
] as const;

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
const MINIMUM_PRODUCTION_CANDIDATE_COUNT = 970;
const MINIMUM_VERIFIED_ORIGINAL_CV_COUNT = 892;

export type ProductionCutoverSqlArtifact = {
  path: string;
  sha256: string;
};

export type ProductionRecoveryEvidence = {
  artifact: "production_recovery_evidence_v1";
  targetCommitSha: string;
  backupCapturedAt: string;
  restoreCompletedAt: string;
  verifiedAt: string;
  database: {
    backupType: "supabase_physical" | "logical_dump";
    backupReferenceFingerprint: string;
    restoreTarget: "isolated_non_production";
    sourceSchemaFingerprint: string;
    restoredSchemaFingerprint: string;
    sourceDataFingerprint: string;
    restoredDataFingerprint: string;
    sourceCandidateCount: number;
    restoredCandidateCount: number;
    restoreSucceeded: true;
  };
  originalCvCollection: {
    retainedOutsideSupabase: true;
    manifestFingerprint: string;
    verifiedManifestFingerprint: string;
    sourceFileCount: number;
    verifiedFileCount: number;
    sourceUniqueFileCount: number;
    verifiedUniqueFileCount: number;
  };
};

export type ProductionCutoverPlan = {
  artifact: "production_cutover_plan_v1";
  targetCommitSha: string;
  recoveryEvidenceFingerprint: string;
  sqlSequenceFingerprint: string;
  planFingerprint: string;
  generatedAt: string;
  steps: ProductionCutoverSqlArtifact[];
  recoveryVerified: true;
  databaseRestoreVerified: true;
  originalCvCollectionVerified: true;
  readyForSupervisedCutover: true;
  readyForBulkUpload: false;
  requiredAfterCutover: [
    "all_sql_readbacks",
    "live_synthetic_signup_claim_upload_ocr_confirmation",
    "authenticated_search_visibility",
    "full_population_dry_run",
  ];
  privacy: {
    candidateIdentifiersSerialized: 0;
    candidateContactsSerialized: 0;
    cvFilenamesSerialized: 0;
    cvContentsSerialized: 0;
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

function requireFingerprint(value: string, code: string) {
  if (!SHA256.test(value)) throw new Error(code);
}

function requireTimestamp(value: string, code: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(code);
  return timestamp;
}

function verifySqlArtifacts(artifacts: ProductionCutoverSqlArtifact[]) {
  if (artifacts.length !== PRODUCTION_CUTOVER_SQL_SEQUENCE.length)
    throw new Error("production_cutover_sql_sequence_incomplete");
  for (const [
    index,
    expectedPath,
  ] of PRODUCTION_CUTOVER_SQL_SEQUENCE.entries()) {
    const artifact = artifacts[index];
    if (artifact.path !== expectedPath)
      throw new Error("production_cutover_sql_sequence_mismatch");
    requireFingerprint(
      artifact.sha256,
      "production_cutover_sql_fingerprint_invalid",
    );
  }
}

function verifyRecoveryEvidence(input: {
  evidence: ProductionRecoveryEvidence;
  currentCommitSha: string;
  now: Date;
}) {
  const { evidence } = input;
  if (evidence.artifact !== "production_recovery_evidence_v1")
    throw new Error("production_recovery_evidence_artifact_invalid");
  if (
    !COMMIT_SHA.test(input.currentCommitSha) ||
    evidence.targetCommitSha !== input.currentCommitSha
  )
    throw new Error("production_recovery_evidence_commit_mismatch");

  const backupCapturedAt = requireTimestamp(
    evidence.backupCapturedAt,
    "production_recovery_backup_timestamp_invalid",
  );
  const restoreCompletedAt = requireTimestamp(
    evidence.restoreCompletedAt,
    "production_recovery_restore_timestamp_invalid",
  );
  const verifiedAt = requireTimestamp(
    evidence.verifiedAt,
    "production_recovery_verification_timestamp_invalid",
  );
  const now = input.now.getTime();
  if (
    backupCapturedAt > restoreCompletedAt ||
    restoreCompletedAt > verifiedAt ||
    verifiedAt > now + 5 * 60 * 1000
  )
    throw new Error("production_recovery_evidence_chronology_invalid");
  // A recent verification of an old restore cannot protect writes against
  // changes made to the production database since the backup was captured.
  if (now - backupCapturedAt > MAX_EVIDENCE_AGE_MS)
    throw new Error("production_recovery_backup_stale");
  if (now - verifiedAt > MAX_EVIDENCE_AGE_MS)
    throw new Error("production_recovery_evidence_stale");

  const database = evidence.database;
  if (
    !(["supabase_physical", "logical_dump"] as unknown[]).includes(
      database.backupType,
    )
  )
    throw new Error("production_recovery_database_backup_type_invalid");
  for (const value of [
    database.backupReferenceFingerprint,
    database.sourceSchemaFingerprint,
    database.restoredSchemaFingerprint,
    database.sourceDataFingerprint,
    database.restoredDataFingerprint,
  ])
    requireFingerprint(
      value,
      "production_recovery_database_fingerprint_invalid",
    );
  if (
    database.restoreTarget !== "isolated_non_production" ||
    database.restoreSucceeded !== true
  )
    throw new Error("production_recovery_restore_not_isolated");
  if (
    database.sourceSchemaFingerprint !== database.restoredSchemaFingerprint ||
    database.sourceDataFingerprint !== database.restoredDataFingerprint ||
    !Number.isSafeInteger(database.sourceCandidateCount) ||
    database.sourceCandidateCount < MINIMUM_PRODUCTION_CANDIDATE_COUNT ||
    database.sourceCandidateCount !== database.restoredCandidateCount
  )
    throw new Error("production_recovery_database_readback_mismatch");

  const originals = evidence.originalCvCollection;
  requireFingerprint(
    originals.manifestFingerprint,
    "production_recovery_cv_manifest_fingerprint_invalid",
  );
  requireFingerprint(
    originals.verifiedManifestFingerprint,
    "production_recovery_cv_manifest_fingerprint_invalid",
  );
  if (
    originals.retainedOutsideSupabase !== true ||
    originals.manifestFingerprint !== originals.verifiedManifestFingerprint ||
    !Number.isSafeInteger(originals.sourceFileCount) ||
    !Number.isSafeInteger(originals.verifiedFileCount) ||
    !Number.isSafeInteger(originals.sourceUniqueFileCount) ||
    !Number.isSafeInteger(originals.verifiedUniqueFileCount) ||
    originals.sourceUniqueFileCount < MINIMUM_VERIFIED_ORIGINAL_CV_COUNT ||
    originals.sourceUniqueFileCount > originals.sourceFileCount ||
    originals.verifiedUniqueFileCount > originals.verifiedFileCount ||
    originals.sourceFileCount !== originals.verifiedFileCount ||
    originals.sourceUniqueFileCount !== originals.verifiedUniqueFileCount
  )
    throw new Error("production_recovery_cv_collection_incomplete");
}

export function buildProductionCutoverPlan(input: {
  evidence: ProductionRecoveryEvidence;
  artifacts: ProductionCutoverSqlArtifact[];
  currentCommitSha: string;
  now?: Date;
}): ProductionCutoverPlan {
  const now = input.now || new Date();
  verifyRecoveryEvidence({
    evidence: input.evidence,
    currentCommitSha: input.currentCommitSha,
    now,
  });
  verifySqlArtifacts(input.artifacts);

  const recoveryEvidenceFingerprint = fingerprint(input.evidence);
  const sqlSequenceFingerprint = fingerprint(input.artifacts);
  const planBasis = {
    targetCommitSha: input.currentCommitSha,
    recoveryEvidenceFingerprint,
    sqlSequenceFingerprint,
  };
  return {
    artifact: "production_cutover_plan_v1",
    ...planBasis,
    planFingerprint: fingerprint(planBasis),
    generatedAt: now.toISOString(),
    steps: structuredClone(input.artifacts),
    recoveryVerified: true,
    databaseRestoreVerified: true,
    originalCvCollectionVerified: true,
    readyForSupervisedCutover: true,
    readyForBulkUpload: false,
    requiredAfterCutover: [
      "all_sql_readbacks",
      "live_synthetic_signup_claim_upload_ocr_confirmation",
      "authenticated_search_visibility",
      "full_population_dry_run",
    ],
    privacy: {
      candidateIdentifiersSerialized: 0,
      candidateContactsSerialized: 0,
      cvFilenamesSerialized: 0,
      cvContentsSerialized: 0,
    },
    databaseWrites: 0,
  };
}
