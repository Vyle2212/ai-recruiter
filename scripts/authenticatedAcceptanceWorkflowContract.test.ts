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
    /acceptance_scope:[\s\S]*default: internal_only[\s\S]*options:\s*\[\s*internal_only,\s*full_scope,\s*cleanup_run37,\s*cleanup_run40,\s*cleanup_run42,?\s*\]/,
  );
  assert.match(workflow, /cleanup_run42\) run_id="ptf1c2-gh-37439551708-1"/);
  assert.match(workflow, /cleanup_run40\) run_id="ptf1c2-gh-37409506068-1"/);
  assert.match(workflow, /cleanup_run37\) run_id="ptf1c2-gh-37236641902-1"/);
  assert.doesNotMatch(workflow, /^\s+external_mode:/m);
  assert.match(
    workflow,
    /Internal Talent Hub acceptance[^\n]*inputs\.tested_sha/,
  );
  assert.match(
    workflow,
    /ACCEPTANCE_EXTERNAL_MODE:.*inputs\.acceptance_scope == 'full_scope'.*'required'.*'disabled'/,
  );
  assert.match(
    workflow,
    /internal_only\) test "\$ACCEPTANCE_EXTERNAL_MODE" = "disabled"/,
  );
  assert.match(
    workflow,
    /full_scope\) test "\$ACCEPTANCE_EXTERNAL_MODE" = "required"/,
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
