import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertPrivateEmploymentPromotionBundlePath,
  prepareEmploymentPromotionOperatorRun,
  validateEmploymentPromotionWriteControls,
  type EmploymentPromotionOperatorBundle,
} from "../lib/productionEmploymentPromotionOperator";
import { preflightEmploymentPromotionBatch } from "../lib/productionEmploymentPromotionBatch";
import {
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
} from "../lib/productionEmploymentAdditivePromotion";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";

const commitSha = "d".repeat(40);
const sourceUpdatedAt = "2026-09-24T03:00:00Z";
const plan = buildEmploymentPromotionPlan({
  candidateId: "synthetic-private-candidate",
  sourceUpdatedAt,
  stored: [],
  projected: [
    {
      id: "synthetic-role",
      company: "Private Synthetic Example",
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
  candidateId: plan.candidateId,
  sourceUpdatedAt,
  storedFingerprint: plan.storedFingerprint,
  projectedFingerprint: plan.projectedFingerprint,
  planFingerprint: plan.planFingerprint,
  decision: "approve_additions",
  reviewedBy: "synthetic-reviewer",
  reviewedAt: "2026-09-24T03:05:00Z",
};
const bundle: EmploymentPromotionOperatorBundle = {
  artifact: "reviewed_employment_promotion_operator_bundle_v1",
  manifest: {
    artifact: "reviewed_employment_promotion_manifest_v1",
    generatedAt: "2026-09-24T03:06:00Z",
    targetCommitSha: commitSha,
    entries: [{ plan, approval }],
  },
  currentCandidates: [
    {
      candidateId: plan.candidateId,
      sourceUpdatedAt,
      employmentHistory: [],
    },
  ],
};

const fingerprintSource = preflightEmploymentPromotionBatch({
  manifest: bundle.manifest,
  currentCandidates: bundle.currentCandidates,
  expectedCommitSha: commitSha,
});
const reviewOnly = prepareEmploymentPromotionOperatorRun({
  bundle,
  expectedCommitSha: commitSha,
});
assert.equal(reviewOnly.report.backupVerified, false);
assert.equal(reviewOnly.report.authorizationVerified, false);
assert.equal(reviewOnly.report.readyForSingleTransactionRpc, false);

bundle.backup = {
  artifact: "verified_candidate_backup_v1",
  capturedAt: "2026-09-24T03:10:00Z",
  candidateCount: 1,
  candidateSetFingerprint: fingerprintSource.candidateSetFingerprint,
  sourceStateFingerprint: fingerprintSource.sourceStateFingerprint,
  verification: "readback_verified",
};
const backupOnly = prepareEmploymentPromotionOperatorRun({
  bundle,
  expectedCommitSha: commitSha,
});
assert.equal(backupOnly.report.backupVerified, true);
assert.equal(backupOnly.report.authorizationVerified, false);
assert.equal(backupOnly.report.readyForSingleTransactionRpc, false);

bundle.authorization = {
  decision: "authorize_reviewed_additive_backfill",
  authorizedBy: "synthetic-release-owner",
  authorizedAt: "2026-09-24T03:15:00Z",
  targetCommitSha: commitSha,
  manifestFingerprint: fingerprintSource.manifestFingerprint,
  preflightFingerprint: fingerprintSource.preflightFingerprint,
};

const prepared = prepareEmploymentPromotionOperatorRun({
  bundle,
  expectedCommitSha: commitSha,
});
assert.equal(prepared.report.entries, 1);
assert.equal(prepared.report.additions, 1);
assert.equal(prepared.report.databaseWrites, 0);
assert.equal(prepared.report.backupVerified, true);
assert.equal(prepared.report.authorizationVerified, true);
assert.equal(prepared.report.readyForSingleTransactionRpc, true);
assert.doesNotMatch(
  JSON.stringify(prepared.report),
  /synthetic-private-candidate|Private Synthetic Example|SAP Consultant/,
);

const projectRef = "abcdefghijklmno";
const confirmation = [
  "authorize-reviewed-additive-backfill",
  commitSha,
  prepared.preflight.preflightFingerprint,
  projectRef,
].join(":");
assert.deepEqual(
  validateEmploymentPromotionWriteControls({
    writeRequested: false,
    writeEnabled: false,
    currentCommitSha: commitSha,
    targetCommitSha: commitSha,
    preflightFingerprint: prepared.preflight.preflightFingerprint,
    expectedProjectRef: "",
    supabaseUrl: "",
    serviceRoleKeyAvailable: false,
    confirmation: "",
  }),
  { mode: "dry_run" },
);
assert.deepEqual(
  validateEmploymentPromotionWriteControls({
    writeRequested: true,
    writeEnabled: true,
    currentCommitSha: commitSha,
    targetCommitSha: commitSha,
    preflightFingerprint: prepared.preflight.preflightFingerprint,
    expectedProjectRef: projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    serviceRoleKeyAvailable: true,
    confirmation,
  }),
  { mode: "write", projectRef },
);
for (const invalid of [
  { writeEnabled: false },
  { currentCommitSha: "e".repeat(40) },
  { expectedProjectRef: "otherprojectref" },
  { serviceRoleKeyAvailable: false },
  { confirmation: `${confirmation}-changed` },
]) {
  assert.throws(
    () =>
      validateEmploymentPromotionWriteControls({
        writeRequested: true,
        writeEnabled: true,
        currentCommitSha: commitSha,
        targetCommitSha: commitSha,
        preflightFingerprint: prepared.preflight.preflightFingerprint,
        expectedProjectRef: projectRef,
        supabaseUrl: `https://${projectRef}.supabase.co`,
        serviceRoleKeyAvailable: true,
        confirmation,
        ...invalid,
      }),
    /refused/,
  );
}
assert.throws(
  () =>
    assertPrivateEmploymentPromotionBundlePath({
      repositoryRoot: "/workspace/repository",
      bundlePath: "/workspace/repository/private/bundle.json",
    }),
  /outside the repository/,
);
assert.equal(
  assertPrivateEmploymentPromotionBundlePath({
    repositoryRoot: "/workspace/repository",
    bundlePath: "/workspace/private/bundle.json",
  }),
  path.resolve("/workspace/private/bundle.json"),
);

const runner = fs.readFileSync(
  path.join(
    path.resolve(__dirname, ".."),
    "scripts/runProductionEmploymentPromotion.ts",
  ),
  "utf8",
);
assert.match(runner, /process\.argv\.includes\("--write"\)/);
assert.match(runner, /EMPLOYMENT_PROMOTION_WRITE_ENABLED/);
assert.match(runner, /EMPLOYMENT_PROMOTION_EXPECTED_PROJECT_REF/);
assert.match(runner, /EMPLOYMENT_PROMOTION_CONFIRM/);
assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(runner, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.doesNotMatch(
  runner,
  /console\.log\([^)]*(?:bundle|preflight\.operations)/,
);

console.log("Production employment operator regression passed.");
