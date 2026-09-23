import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  executeEmploymentPromotionBatchViaSupabase,
  type EmploymentPromotionSupabaseClient,
} from "../lib/productionEmploymentPromotionSupabase";
import {
  preflightEmploymentPromotionBatch,
  type EmploymentPromotionManifest,
} from "../lib/productionEmploymentPromotionBatch";
import {
  buildEmploymentPromotionPlan,
  type EmploymentPromotionApproval,
} from "../lib/productionEmploymentAdditivePromotion";
import type { EnterpriseEmployment } from "../lib/candidate360SchemaNormalize";

const root = path.resolve(__dirname, "..");
const sql = fs.readFileSync(
  path.join(
    root,
    "supabase/manual/202609240002_reviewed_employment_promotion_transaction.sql",
  ),
  "utf8",
);

for (const boundary of [
  /security invoker/i,
  /set search_path = pg_catalog, public/i,
  /for update/i,
  /order by item->>'candidateId'/i,
  /duplicate or missing candidate ID/i,
  /existing employment changed/i,
  /locked source state changed/i,
  /optimistic update mismatch/i,
  /exact readback mismatch/i,
  /delete from public\.candidate_search_index/i,
  /revoke all on function public\.apply_reviewed_employment_promotion_batch\(jsonb\)[\s\S]*from public, anon, authenticated/i,
  /grant execute on function public\.apply_reviewed_employment_promotion_batch\(jsonb\)[\s\S]*to service_role/i,
])
  assert.match(sql, boundary);
assert.doesNotMatch(sql, /security definer/i);
assert.doesNotMatch(
  sql,
  /grant execute[\s\S]*to (?:anon|authenticated|public)/i,
);
assert.equal((sql.match(/update public\.candidates/gi) || []).length, 1);

const commitSha = "c".repeat(40);
const sourceUpdatedAt = "2026-09-24T02:00:00Z";
const projected: EnterpriseEmployment = {
  id: "synthetic-new-role",
  company: "Synthetic Example",
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
};
const plan = buildEmploymentPromotionPlan({
  candidateId: "synthetic-candidate",
  sourceUpdatedAt,
  stored: [],
  projected: [projected],
});
const approval: EmploymentPromotionApproval = {
  candidateId: plan.candidateId,
  sourceUpdatedAt: plan.sourceUpdatedAt,
  storedFingerprint: plan.storedFingerprint,
  projectedFingerprint: plan.projectedFingerprint,
  planFingerprint: plan.planFingerprint,
  decision: "approve_additions",
  reviewedBy: "synthetic-reviewer",
  reviewedAt: "2026-09-24T02:05:00Z",
};
const manifest: EmploymentPromotionManifest = {
  artifact: "reviewed_employment_promotion_manifest_v1",
  generatedAt: "2026-09-24T02:06:00Z",
  targetCommitSha: commitSha,
  entries: [{ plan, approval }],
};
const preflight = preflightEmploymentPromotionBatch({
  manifest,
  currentCandidates: [
    {
      candidateId: plan.candidateId,
      sourceUpdatedAt,
      employmentHistory: [],
    },
  ],
  expectedCommitSha: commitSha,
});
const backup = {
  artifact: "verified_candidate_backup_v1" as const,
  capturedAt: "2026-09-24T02:10:00Z",
  candidateCount: 1,
  candidateSetFingerprint: preflight.candidateSetFingerprint,
  sourceStateFingerprint: preflight.sourceStateFingerprint,
  verification: "readback_verified" as const,
};
const authorization = {
  decision: "authorize_reviewed_additive_backfill" as const,
  authorizedBy: "synthetic-release-owner",
  authorizedAt: "2026-09-24T02:15:00Z",
  targetCommitSha: commitSha,
  manifestFingerprint: preflight.manifestFingerprint,
  preflightFingerprint: preflight.preflightFingerprint,
};

async function main() {
  const calls: Array<{ functionName: string; parameters: unknown }> = [];
  const client: EmploymentPromotionSupabaseClient = {
    rpc: async (functionName, parameters) => {
      calls.push({ functionName, parameters });
      return {
        data: {
          artifact: "reviewed_employment_promotion_execution_v1",
          targetCommitSha: commitSha,
          manifestFingerprint: preflight.manifestFingerprint,
          candidatesUpdated: 1,
          additionsWritten: 1,
          readbacksVerified: 1,
          searchIndexRowsInvalidated: 1,
          transactionCommitted: true,
          privacy: {
            candidateIdentifiersSerialized: 0,
            employmentRowsSerialized: 0,
          },
        },
        error: null,
      };
    },
  };
  const report = await executeEmploymentPromotionBatchViaSupabase({
    client,
    preflight,
    backup,
    authorization,
    expectedCommitSha: commitSha,
  });
  assert.equal(report.searchIndexRowsInvalidated, 1);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.functionName,
    "apply_reviewed_employment_promotion_batch",
  );
  const serializedRequest = JSON.stringify(calls[0]?.parameters);
  assert.match(serializedRequest, /reviewed_employment_promotion_rpc_v1/);
  assert.match(serializedRequest, /synthetic-candidate/);

  await assert.rejects(
    () =>
      executeEmploymentPromotionBatchViaSupabase({
        client: {
          rpc: async () => ({
            data: null,
            error: { message: "synthetic rollback" },
          }),
        },
        preflight,
        backup,
        authorization,
        expectedCommitSha: commitSha,
      }),
    /synthetic rollback/,
  );
  await assert.rejects(
    () =>
      executeEmploymentPromotionBatchViaSupabase({
        client: {
          rpc: async () => ({
            data: {
              artifact: "reviewed_employment_promotion_execution_v1",
              targetCommitSha: commitSha,
              manifestFingerprint: preflight.manifestFingerprint,
              candidatesUpdated: 1,
              additionsWritten: 1,
              readbacksVerified: 0,
              searchIndexRowsInvalidated: 1,
              transactionCommitted: true,
              privacy: {
                candidateIdentifiersSerialized: 0,
                employmentRowsSerialized: 0,
              },
            },
            error: null,
          }),
        },
        preflight,
        backup,
        authorization,
        expectedCommitSha: commitSha,
      }),
    /aggregate readback mismatch/,
  );

  console.log("Production employment Supabase transaction regression passed.");
}

void main();
