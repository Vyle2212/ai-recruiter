import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { acceptanceCleanupPlan } from "../lib/acceptanceCleanupPlan";

async function main() {
  const workflow = await readFile(
    ".github/workflows/authenticated-acceptance.yml",
    "utf8",
  );
  const order = [
    "Verify checked-out revision and HTTPS target",
    "Verify protected exact-SHA application release",
    "Verify fail-closed environment and database marker",
    "Verify acceptance-owned synthetic search dataset",
    "Provision controlled synthetic identities",
    "Run real authenticated browser and API acceptance",
    "Generate sanitized acceptance report",
    "Clean synthetic identities and records",
    "Verify cleanup completed",
    "Upload sanitized acceptance evidence only",
  ];
  let previous = -1;
  for (const step of order) {
    const position = workflow.indexOf(step);
    assert.ok(position > previous, `workflow step out of order: ${step}`);
    previous = position;
  }
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(
    workflow,
    /if: always\(\) && env\.ACCEPTANCE_CLEANUP_ARMED == 'true'/,
  );
  assert.deepEqual(
    acceptanceCleanupPlan([
      { entity_type: "auth_user", entity_id: "partial-user" },
      { entity_type: "auth_user", entity_id: "partial-user" },
      { entity_type: "organization", entity_id: "partial-org" },
    ]),
    {
      profileIds: [],
      authUserIds: ["partial-user"],
      organizationIds: ["partial-org"],
    },
  );
  assert.match(workflow, /ACCEPTANCE_DEPLOYMENT_BYPASS_SECRET:.*secrets\./);
  assert.doesNotMatch(workflow, /x-vercel-protection-bypass/);
  assert.match(
    workflow,
    /startsWith\(github\.ref_name, 'codex\/authenticated-acceptance-'/,
  );
  console.log("Authenticated acceptance workflow contract tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
