import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

import {
  buildProductionCutoverPlan,
  PRODUCTION_CUTOVER_SQL_SEQUENCE,
  type ProductionRecoveryEvidence,
} from "../lib/productionCutoverPlan";

const commit = "a".repeat(40);
const fp = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const artifacts = PRODUCTION_CUTOVER_SQL_SEQUENCE.map((path) => ({
  path,
  sha256: fp(fs.readFileSync(path, "utf8")),
}));
const evidence: ProductionRecoveryEvidence = {
  artifact: "production_recovery_evidence_v1",
  targetCommitSha: commit,
  backupCapturedAt: "2026-09-25T00:00:00.000Z",
  restoreCompletedAt: "2026-09-25T00:20:00.000Z",
  verifiedAt: "2026-09-25T00:30:00.000Z",
  database: {
    backupType: "supabase_physical",
    backupReferenceFingerprint: fp("backup"),
    restoreTarget: "isolated_non_production",
    sourceSchemaFingerprint: fp("schema"),
    restoredSchemaFingerprint: fp("schema"),
    sourceDataFingerprint: fp("data"),
    restoredDataFingerprint: fp("data"),
    sourceCandidateCount: 970,
    restoredCandidateCount: 970,
    restoreSucceeded: true,
  },
  originalCvCollection: {
    retainedOutsideSupabase: true,
    manifestFingerprint: fp("originals"),
    verifiedManifestFingerprint: fp("originals"),
    sourceFileCount: 972,
    verifiedFileCount: 972,
    sourceUniqueFileCount: 970,
    verifiedUniqueFileCount: 970,
  },
};
const now = new Date("2026-09-25T01:00:00.000Z");

const plan = buildProductionCutoverPlan({
  evidence,
  artifacts,
  currentCommitSha: commit,
  now,
});
assert.equal(plan.steps.length, 18);
assert.equal(
  plan.steps.some((step) =>
    step.path.endsWith("production_auth_foundation.sql"),
  ),
  false,
);
assert.equal(
  plan.steps.some((step) =>
    step.path.endsWith("private_original_cv_archive.sql"),
  ),
  false,
);
assert.equal(plan.recoveryVerified, true);
assert.equal(plan.databaseRestoreVerified, true);
assert.equal(plan.originalCvCollectionVerified, true);
assert.equal(plan.readyForSupervisedCutover, true);
assert.equal(plan.readyForBulkUpload, false);
assert.equal(plan.databaseWrites, 0);
const availableCollection = structuredClone(evidence);
availableCollection.originalCvCollection.sourceFileCount = 905;
availableCollection.originalCvCollection.verifiedFileCount = 905;
availableCollection.originalCvCollection.sourceUniqueFileCount = 892;
availableCollection.originalCvCollection.verifiedUniqueFileCount = 892;
assert.equal(
  buildProductionCutoverPlan({
    evidence: availableCollection,
    artifacts,
    currentCommitSha: commit,
    now,
  }).originalCvCollectionVerified,
  true,
);
assert.deepEqual(plan.privacy, {
  candidateIdentifiersSerialized: 0,
  candidateContactsSerialized: 0,
  cvFilenamesSerialized: 0,
  cvContentsSerialized: 0,
});

function refuses(
  mutateEvidence: (copy: ProductionRecoveryEvidence) => void,
  code: RegExp,
) {
  const copy = structuredClone(evidence);
  mutateEvidence(copy);
  assert.throws(
    () =>
      buildProductionCutoverPlan({
        evidence: copy,
        artifacts,
        currentCommitSha: commit,
        now,
      }),
    code,
  );
}

refuses((copy) => {
  copy.database.restoredDataFingerprint = fp("changed");
}, /database_readback_mismatch/);
refuses((copy) => {
  copy.database.restoreTarget = "production" as never;
}, /restore_not_isolated/);
refuses((copy) => {
  copy.originalCvCollection.verifiedFileCount--;
}, /cv_collection_incomplete/);
refuses((copy) => {
  copy.originalCvCollection.sourceUniqueFileCount = 1;
  copy.originalCvCollection.verifiedUniqueFileCount = 1;
}, /cv_collection_incomplete/);
refuses((copy) => {
  copy.originalCvCollection.sourceUniqueFileCount = 891;
  copy.originalCvCollection.verifiedUniqueFileCount = 891;
}, /cv_collection_incomplete/);
refuses((copy) => {
  copy.originalCvCollection.verifiedUniqueFileCount--;
}, /cv_collection_incomplete/);
refuses((copy) => {
  copy.originalCvCollection.sourceUniqueFileCount =
    copy.originalCvCollection.sourceFileCount + 1;
  copy.originalCvCollection.verifiedUniqueFileCount =
    copy.originalCvCollection.verifiedFileCount + 1;
}, /cv_collection_incomplete/);
refuses((copy) => {
  copy.verifiedAt = "2026-09-23T00:00:00.000Z";
}, /chronology_invalid|evidence_stale/);
refuses((copy) => {
  copy.backupCapturedAt = "2026-09-23T00:00:00.000Z";
}, /backup_stale/);
const exactlyOneDayOld = structuredClone(evidence);
exactlyOneDayOld.backupCapturedAt = "2026-09-24T01:00:00.000Z";
assert.equal(
  buildProductionCutoverPlan({
    evidence: exactlyOneDayOld,
    artifacts,
    currentCommitSha: commit,
    now,
  }).recoveryVerified,
  true,
  "backup at the 24-hour boundary remains eligible",
);

assert.throws(
  () =>
    buildProductionCutoverPlan({
      evidence,
      artifacts: [...artifacts].reverse(),
      currentCommitSha: commit,
      now,
    }),
  /sql_sequence_mismatch/,
);
assert.throws(
  () =>
    buildProductionCutoverPlan({
      evidence,
      artifacts,
      currentCommitSha: "b".repeat(40),
      now,
    }),
  /commit_mismatch/,
);

const planScript = fs.readFileSync(
  new URL("./prepareProductionCutoverPlan.ts", import.meta.url),
  "utf8",
);
assert.match(
  planScript,
  /\["show", `\$\{currentCommitSha\}:\$\{artifactPath\}`\]/,
);
assert.match(planScript, /production_cutover_sql_not_committed/);
assert.match(planScript, /verifyOriginalCvCollection\(/);
assert.match(planScript, /production_cutover_cv_manifest_readback_mismatch/);
assert.match(planScript, /production_cutover_plan_failed/);
assert.doesNotMatch(planScript, /console\.error\(error\.message\)/);

console.log("productionCutoverPlan.test.ts passed");
