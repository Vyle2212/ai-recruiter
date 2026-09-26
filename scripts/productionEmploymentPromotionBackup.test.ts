import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

const commitSha = "a".repeat(40);
const sourceUpdatedAt = "2026-09-24T07:00:00Z";
const candidateId = "private-backup-candidate";
const plan = buildEmploymentPromotionPlan({
  candidateId,
  sourceUpdatedAt,
  stored: [],
  projected: [
    {
      id: "synthetic-project-role",
      company: "Private Backup Example",
      title: "SAP Consultant",
      location: "",
      companyType: "",
      modules: [],
      achievements: [],
      start: "2020",
      end: "2021",
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
  reviewedAt: "2026-09-24T07:05:00Z",
};
const bundle: EmploymentPromotionOperatorBundle = {
  artifact: "reviewed_employment_promotion_operator_bundle_v1",
  manifest: {
    artifact: "reviewed_employment_promotion_manifest_v1",
    generatedAt: "2026-09-24T07:06:00Z",
    targetCommitSha: commitSha,
    entries: [{ plan, approval }],
  },
  currentCandidates: [{ candidateId, sourceUpdatedAt, employmentHistory: [] }],
};
const snapshot = {
  artifact: "private_production_candidate_snapshot_v1" as const,
  capturedAt: "2026-09-24T07:10:00Z",
  rows: [
    {
      id: candidateId,
      updated_at: sourceUpdatedAt,
      raw_text: "PRIVATE CONTACT [backup-private-contact]",
      parsed_json: {
        canonical_candidate: { payload: { employmentHistory: [] } },
      },
    },
    {
      id: "unrelated-private-candidate",
      updated_at: sourceUpdatedAt,
      raw_text: "unrelated private row",
      parsed_json: {
        canonical_candidate: { payload: { employmentHistory: [] } },
      },
    },
  ],
};

const built = buildPrivateEmploymentPromotionBackup({
  bundle,
  snapshot,
  expectedCommitSha: commitSha,
});
assert.equal(built.backup.candidateCount, 1);
assert.equal(built.backup.candidates[0]?.candidateId, candidateId);
assert.equal(built.report.backupVerified, true);
assert.equal(built.report.readyForAuthorization, true);
assert.equal(built.report.readyForWrite, false);
assert.equal(built.report.databaseWrites, 0);
assert.doesNotMatch(
  JSON.stringify(built.report),
  /private-backup-candidate|Private Backup Example|backup-private-contact|SAP Consultant/,
);

const attached = attachVerifiedEmploymentPromotionBackup({
  bundle,
  backup: JSON.parse(JSON.stringify(built.backup)),
  expectedCommitSha: commitSha,
});
assert.equal(attached.bundle.backup?.verification, "readback_verified");
assert.equal(attached.bundle.authorization, undefined);

const tampered = structuredClone(built.backup);
tampered.candidates[0].employmentHistory.push({
  company: "Tampered Private Example",
  title: "Unsafe role",
});
assert.throws(
  () =>
    attachVerifiedEmploymentPromotionBackup({
      bundle,
      backup: tampered,
      expectedCommitSha: commitSha,
    }),
  /persisted backup content changed/,
);

assert.throws(
  () =>
    buildPrivateEmploymentPromotionBackup({
      bundle,
      snapshot: {
        ...snapshot,
        capturedAt: "2026-09-24T07:01:00Z",
      },
      expectedCommitSha: commitSha,
    }),
  /backup predates the reviewed source state/,
);

assert.throws(
  () =>
    buildPrivateEmploymentPromotionBackup({
      bundle,
      snapshot: { ...snapshot, rows: snapshot.rows.slice(1) },
      expectedCommitSha: commitSha,
    }),
  /approved candidate missing from snapshot/,
);

assert.throws(
  () =>
    buildPrivateEmploymentPromotionBackup({
      bundle,
      snapshot: { ...snapshot, rows: [...snapshot.rows, snapshot.rows[0]] },
      expectedCommitSha: commitSha,
    }),
  /duplicate candidate IDs/,
);

const changedSource = structuredClone(snapshot);
changedSource.rows[0].updated_at = "2026-09-24T07:09:00Z";
assert.throws(
  () =>
    buildPrivateEmploymentPromotionBackup({
      bundle,
      snapshot: changedSource,
      expectedCommitSha: commitSha,
    }),
  /source state does not match reviewed preflight/,
);

assert.throws(
  () =>
    buildPrivateEmploymentPromotionBackup({
      bundle: { ...bundle, backup: attached.bundle.backup },
      snapshot,
      expectedCommitSha: commitSha,
    }),
  /already has backup or authorization/,
);

const runner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/prepareProductionEmploymentBackup.ts",
  ),
  "utf8",
);
assert.match(runner, /mode: 0o600/);
assert.match(runner, /flag: "wx"/);
assert.match(runner, /owner-only permissions/);
assert.match(runner, /outside the repository/);
assert.match(
  runner,
  /readPrivateJson<PrivateEmploymentPromotionBackupArtifact>/,
);
assert.doesNotMatch(
  runner,
  /console\.log\([^)]*(?:backup|bundle|snapshot|candidates|rows)/,
);

console.log("Production employment private backup regression passed.");
