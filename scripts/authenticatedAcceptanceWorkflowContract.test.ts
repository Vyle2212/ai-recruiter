import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const workflow = await readFile(
    ".github/workflows/authenticated-acceptance.yml",
    "utf8",
  );
  const order = [
    "Verify checked-out revision and HTTPS target",
    "Verify protected exact-SHA application release",
    "Verify fail-closed environment and database marker",
    "Verify fixed fixture namespace is available",
    "Arm fixture cleanup",
    "Install run-owned synthetic candidate and index",
    "Verify synthetic candidate through canonical search pipeline",
    "Provision controlled synthetic identities",
    "Run authenticated browser and API acceptance",
    "Generate pre-cleanup sanitized evidence",
    "Clean identities and controlled mutations",
    "Verify identity and mutation cleanup",
    "Remove candidate search index, registry lease and candidate",
    "Verify zero per-run residue",
    "Generate final release-truth report",
    "Upload sanitized acceptance evidence",
  ];
  let previous = -1;
  for (const step of order) {
    const position = workflow.indexOf(step);
    assert.ok(position > previous, `workflow step out of order: ${step}`);
    previous = position;
  }
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(workflow, /group: production-trust-acceptance-environment/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(
    workflow,
    /authenticated-acceptance-\$\{\{ inputs\.tested_sha/,
  );
  assert.doesNotMatch(workflow, /ACCEPTANCE_SYNTHETIC_FIXTURE_OWNER_RUN_ID/);
  assert.match(
    workflow,
    /external_mode:[\s\S]*options: \[required, disabled\]/,
  );
  assert.match(workflow, /ACCEPTANCE_FIXTURE_CLEANUP_ARMED == 'true'/);
  assert.match(workflow, /ACCEPTANCE_DEPLOYMENT_BYPASS_SECRET:.*secrets\./);
  assert.doesNotMatch(workflow, /x-vercel-protection-bypass/);
  assert.match(
    workflow,
    /startsWith\(github\.ref_name, 'codex\/authenticated-acceptance-'/,
  );

  const administration = await readFile(
    ".github/workflows/acceptance-fixture-administration.yml",
    "utf8",
  );
  assert.match(
    administration,
    /options: \[verify, remove-expired-fixed-fixture\]/,
  );
  assert.doesNotMatch(administration, /candidate_id|table_name|sql|filter:/i);
  assert.match(administration, /environment: acceptance/);
  assert.match(
    administration,
    /group: production-trust-acceptance-environment/,
  );
  const provision = await readFile(
    "scripts/authenticatedAcceptanceProvision.ts",
    "utf8",
  );
  assert.match(provision, /acceptance_run_hash/);
  assert.match(provision, /acceptance_partial_provision_discovery_failed/);
  assert.match(provision, /acceptance_identity_table_residue_detected/);
  assert.doesNotMatch(
    provision,
    /process\.env\.(?:ACCEPTANCE_)?(?:CANDIDATE_ID|TABLE_NAME|DELETE_FILTER)/,
  );
  console.log("Authenticated acceptance workflow contract tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
