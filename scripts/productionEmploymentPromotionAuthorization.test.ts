import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  attachVerifiedEmploymentPromotionAuthorization,
  buildPrivateEmploymentPromotionAuthorization,
  employmentPromotionAuthorizationConfirmation,
  verifyPersistedEmploymentPromotionExecutionBundle,
} from "../lib/productionEmploymentPromotionAuthorization";
import {
  attachVerifiedEmploymentPromotionBackup,
  buildPrivateEmploymentPromotionBackup,
} from "../lib/productionEmploymentPromotionBackup";
import type { EmploymentPromotionOperatorBundle } from "../lib/productionEmploymentPromotionOperator";
import {
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
} from "../lib/productionEmploymentAdditivePromotion";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";

const commitSha = "b".repeat(40);
const sourceUpdatedAt = "2026-09-24T09:00:00Z";
const candidateId = "private-authorization-candidate";
const plan = buildEmploymentPromotionPlan({
  candidateId,
  sourceUpdatedAt,
  stored: [],
  projected: [
    {
      id: "synthetic-authorized-role",
      company: "Private Authorization Example",
      title: "SAP Consultant",
      location: "",
      companyType: "",
      modules: [],
      achievements: [],
      start: "2021",
      end: "2022",
      duration: "",
      current: false,
      provenance: [
        {
          sourceType: "employment",
          sourceRef: "synthetic.fixture",
          label: "Synthetic fixture",
        },
      ],
    } satisfies EnterpriseEmployment,
  ],
});
const approval: EmploymentPromotionApproval = {
  candidateId,
  sourceUpdatedAt,
  storedFingerprint: plan.storedFingerprint,
  projectedFingerprint: plan.projectedFingerprint,
  planFingerprint: plan.planFingerprint,
  decision: "approve_additions",
  reviewedBy: "private-reviewer",
  reviewedAt: "2026-09-24T09:05:00Z",
};
const reviewBundle: EmploymentPromotionOperatorBundle = {
  artifact: "reviewed_employment_promotion_operator_bundle_v1",
  manifest: {
    artifact: "reviewed_employment_promotion_manifest_v1",
    generatedAt: "2026-09-24T09:06:00Z",
    targetCommitSha: commitSha,
    entries: [{ plan, approval }],
  },
  currentCandidates: [{ candidateId, sourceUpdatedAt, employmentHistory: [] }],
};
const privateBackup = buildPrivateEmploymentPromotionBackup({
  bundle: reviewBundle,
  snapshot: {
    artifact: "private_production_candidate_snapshot_v1",
    capturedAt: "2026-09-24T09:10:00Z",
    rows: [
      {
        id: candidateId,
        updated_at: sourceUpdatedAt,
        raw_text: "PRIVATE CONTACT [authorization-private-contact]",
        parsed_json: {
          canonical_candidate: { payload: { employmentHistory: [] } },
        },
      },
    ],
  },
  expectedCommitSha: commitSha,
});
const backupReady = attachVerifiedEmploymentPromotionBackup({
  bundle: reviewBundle,
  backup: privateBackup.backup,
  expectedCommitSha: commitSha,
}).bundle;
const confirmation = employmentPromotionAuthorizationConfirmation({
  targetCommitSha: commitSha,
  preflightFingerprint: privateBackup.backup.preflightFingerprint,
  backupFingerprint: privateBackup.backup.backupFingerprint,
});

const built = buildPrivateEmploymentPromotionAuthorization({
  bundle: backupReady,
  backup: privateBackup.backup,
  expectedCommitSha: commitSha,
  authorizedBy: "private-release-owner",
  authorizedAt: "2026-09-24T09:15:00Z",
  confirmation,
});
assert.equal(built.report.backupVerified, true);
assert.equal(built.report.authorizationVerified, true);
assert.equal(built.report.readyForSingleTransactionRpc, true);
assert.equal(built.report.readyForWrite, false);
assert.equal(built.report.databaseWrites, 0);
assert.doesNotMatch(
  JSON.stringify(built.report),
  /private-authorization-candidate|Private Authorization Example|authorization-private-contact|SAP Consultant/,
);

const attached = attachVerifiedEmploymentPromotionAuthorization({
  bundle: backupReady,
  backup: privateBackup.backup,
  authorization: JSON.parse(JSON.stringify(built.authorization)),
  expectedCommitSha: commitSha,
});
assert.equal(
  attached.bundle.authorization?.artifact,
  "verified_employment_promotion_authorization_v1",
);
assert.equal(attached.report.readyForSingleTransactionRpc, true);
assert.equal(attached.report.readyForWrite, false);
assert.equal(
  verifyPersistedEmploymentPromotionExecutionBundle({
    bundle: attached.bundle,
    backup: privateBackup.backup,
    authorization: built.authorization,
    expectedCommitSha: commitSha,
  }).report.authorizationVerified,
  true,
);

const forgedBackupEvidence = structuredClone(attached.bundle);
forgedBackupEvidence.backup!.capturedAt = "2026-09-24T09:11:00Z";
assert.throws(
  () =>
    verifyPersistedEmploymentPromotionExecutionBundle({
      bundle: forgedBackupEvidence,
      backup: privateBackup.backup,
      authorization: built.authorization,
      expectedCommitSha: commitSha,
    }),
  /operator backup differs from the persisted private artifact/,
);
const swappedAuthorization = structuredClone(attached.bundle);
swappedAuthorization.authorization!.authorizedBy = "another-release-owner";
assert.throws(
  () =>
    verifyPersistedEmploymentPromotionExecutionBundle({
      bundle: swappedAuthorization,
      backup: privateBackup.backup,
      authorization: built.authorization,
      expectedCommitSha: commitSha,
    }),
  /authorization content changed|operator authorization differs/,
);
const swappedBackupArtifact = structuredClone(privateBackup.backup);
swappedBackupArtifact.capturedAt = "2026-09-24T09:11:00Z";
assert.throws(
  () =>
    verifyPersistedEmploymentPromotionExecutionBundle({
      bundle: attached.bundle,
      backup: swappedBackupArtifact,
      authorization: built.authorization,
      expectedCommitSha: commitSha,
    }),
  /persisted backup content changed/,
);

assert.throws(
  () =>
    buildPrivateEmploymentPromotionAuthorization({
      bundle: backupReady,
      backup: privateBackup.backup,
      expectedCommitSha: commitSha,
      authorizedBy: "private-release-owner",
      authorizedAt: "2026-09-24T09:15:00Z",
      confirmation: `${confirmation}-changed`,
    }),
  /exact release confirmation mismatch/,
);
assert.throws(
  () =>
    buildPrivateEmploymentPromotionAuthorization({
      bundle: backupReady,
      backup: privateBackup.backup,
      expectedCommitSha: commitSha,
      authorizedBy: " ",
      authorizedAt: "2026-09-24T09:15:00Z",
      confirmation,
    }),
  /release owner and timestamp required/,
);
assert.throws(
  () =>
    buildPrivateEmploymentPromotionAuthorization({
      bundle: backupReady,
      backup: privateBackup.backup,
      expectedCommitSha: commitSha,
      authorizedBy: "private-release-owner",
      authorizedAt: "2026-09-24T09:09:00Z",
      confirmation,
    }),
  /authorization predates backup/,
);

const tampered = structuredClone(built.authorization);
tampered.authorization.authorizedBy = "changed-release-owner";
assert.throws(
  () =>
    attachVerifiedEmploymentPromotionAuthorization({
      bundle: backupReady,
      backup: privateBackup.backup,
      authorization: tampered,
      expectedCommitSha: commitSha,
    }),
  /persisted authorization content changed/,
);
assert.throws(
  () =>
    attachVerifiedEmploymentPromotionAuthorization({
      bundle: attached.bundle,
      backup: privateBackup.backup,
      authorization: built.authorization,
      expectedCommitSha: commitSha,
    }),
  /prior authorization forbidden/,
);

const runner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/prepareProductionEmploymentAuthorization.ts",
  ),
  "utf8",
);
assert.match(runner, /mode: 0o600/);
assert.match(runner, /flag: "wx"/);
assert.match(runner, /owner-only permissions/);
assert.match(runner, /outside the repository/);
assert.match(runner, /new Date\(\)\.toISOString\(\)/);
assert.match(
  runner,
  /readPrivateJson<PrivateEmploymentPromotionAuthorizationArtifact>/,
);
assert.doesNotMatch(
  runner,
  /console\.log\([^)]*(?:bundle|backup|authorization|candidates|rows)/,
);

const executionRunner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/runProductionEmploymentPromotion.ts",
  ),
  "utf8",
);
assert.match(
  executionRunner,
  /verifyPersistedEmploymentPromotionExecutionBundle/,
);
assert.match(executionRunner, /owner-only permissions/);
assert.match(executionRunner, /promotion_private_backup_path_missing/);
assert.match(executionRunner, /promotion_private_authorization_path_missing/);
assert.ok(
  executionRunner.indexOf(
    "verifyPersistedEmploymentPromotionExecutionBundle({",
  ) < executionRunner.indexOf('import("@supabase/supabase-js")'),
);
console.log("Production employment private authorization regression passed.");
