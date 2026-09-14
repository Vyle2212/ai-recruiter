import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import {
  assertAcceptanceEvidenceIsSanitized,
  evaluateAcceptanceEnvironment,
  projectRefFromSupabaseUrl,
} from "../lib/acceptanceEnvironmentSafety";

const now = new Date("2026-09-14T00:00:00.000Z");
const repositoryRoot = path.resolve(process.cwd(), "synthetic-repository-root");
const valid = {
  acceptanceTestMode: "true",
  appEnvironment: "acceptance",
  baseUrl: "https://acceptance.example.invalid",
  supabaseUrl: "https://acceptance-ref.supabase.co",
  projectRef: "acceptance-ref",
  projectRefAllowlist: "acceptance-ref",
  productionProjectRefDenylist: "production-ref",
  runId: "ptf1c2-example-run",
  syntheticNamespace: "ptf1c2/ptf1c2-example-run",
  owner: "workflow-run-123",
  expiresAt: "2026-09-14T02:00:00.000Z",
  credentialBundlePath: path.join(os.tmpdir(), "acceptance-credentials.json"),
  repositoryRoot,
  expectedCommitSha: "78cd22bd706e7b11ae2750fcee4fa057f1a3d8d1",
};

assert.equal(projectRefFromSupabaseUrl(valid.supabaseUrl), "acceptance-ref");
assert.equal(evaluateAcceptanceEnvironment(valid, now).allowed, true);

for (const [key, value, blocker] of [
  ["acceptanceTestMode", "false", "acceptance_test_mode_not_enabled"],
  ["appEnvironment", "production", "non_production_environment_not_confirmed"],
  ["appEnvironment", "staging", "non_production_environment_not_confirmed"],
  [
    "projectRefAllowlist",
    "another-ref",
    "acceptance_project_ref_not_allowlisted",
  ],
  [
    "productionProjectRefDenylist",
    "acceptance-ref",
    "production_project_ref_rejected",
  ],
  ["syntheticNamespace", "wrong", "synthetic_namespace_mismatch"],
  [
    "baseUrl",
    "http://acceptance.example.invalid",
    "https_acceptance_url_required",
  ],
] as const) {
  const result = evaluateAcceptanceEnvironment({ ...valid, [key]: value }, now);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.ok(result.blockers.includes(blocker));
}

const inside = evaluateAcceptanceEnvironment(
  {
    ...valid,
    credentialBundlePath: path.join(repositoryRoot, "tmp", "credentials.json"),
  },
  now,
);
assert.equal(inside.allowed, false);
if (!inside.allowed)
  assert.ok(
    inside.blockers.includes("credential_bundle_must_be_outside_repository"),
  );

assert.deepEqual(
  assertAcceptanceEvidenceIsSanitized({
    correlationId: "abc",
    routePolicyId: "search-v2",
    decision: "allowed",
    actorScope: "a12",
  }),
  [],
);
assert.ok(
  assertAcceptanceEvidenceIsSanitized({ password: "must-not-appear" }).length >
    0,
);

console.log("Authenticated acceptance environment safety tests passed.");
