import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  validateRepositoryWorkflowActionPins,
  validateWorkflowActionPins,
} from "../lib/githubActionsPinning";

const acceptedUploadSha = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const digest = "a".repeat(64);

function violations(value: string) {
  return validateWorkflowActionPins(`steps:\n  - uses: ${value}\n`);
}

async function main() {
  assert.equal(
    violations("actions/checkout@v6")[0]?.violationType,
    "mutable_ref",
  );
  assert.equal(
    violations("actions/setup-node@main")[0]?.violationType,
    "mutable_ref",
  );
  assert.equal(
    violations("actions/upload-artifact@043fb46")[0]?.violationType,
    "short_sha",
  );
  assert.deepEqual(
    violations(`actions/upload-artifact@${acceptedUploadSha}`),
    [],
  );
  assert.deepEqual(violations(`owner/repo/subpath@${"b".repeat(40)}`), []);
  assert.equal(
    violations("owner/repo/.github/workflows/file.yml@v1")[0]?.violationType,
    "mutable_ref",
  );
  assert.deepEqual(
    violations(`owner/repo/.github/workflows/file.yml@${"c".repeat(40)}`),
    [],
  );
  assert.deepEqual(violations("./local-action"), []);
  assert.equal(
    violations("docker://image:latest")[0]?.violationType,
    "docker_not_digest_pinned",
  );
  assert.deepEqual(violations(`docker://image@sha256:${digest}`), []);
  assert.equal(
    violations("actions/checkout@\${{ github.sha }}")[0]?.violationType,
    "expression_ref",
  );
  assert.deepEqual(
    validateWorkflowActionPins(
      `steps:\n  -  uses : "actions/checkout@${"d".repeat(40)}" # pinned\n`,
    ),
    [],
  );
  assert.equal(
    validateWorkflowActionPins(
      "steps:\n  - uses:\n      actions/checkout@v6\n",
    )[0]?.violationType,
    "missing_ref",
  );

  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "workflow-pins-"));
  const workflowDirectory = path.join(fixtureRoot, ".github", "workflows");
  await mkdir(workflowDirectory, { recursive: true });
  await writeFile(
    path.join(workflowDirectory, "one.yml"),
    `steps:\n  - uses: actions/checkout@${"e".repeat(40)}\n`,
  );
  await writeFile(
    path.join(workflowDirectory, "two.yaml"),
    "steps:\n  - uses: actions/setup-node@v7\n",
  );
  const discovery = await validateRepositoryWorkflowActionPins(fixtureRoot);
  assert.equal(discovery.files.length, 2);
  assert.equal(discovery.violations.length, 1);
  assert.match(discovery.violations[0].workflowPath, /two\.yaml$/);

  const repository = await validateRepositoryWorkflowActionPins();
  if (repository.violations.length) {
    console.error(
      JSON.stringify({
        workflowActionPinViolations: repository.violations,
      }),
    );
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify({
        workflowFilesScanned: repository.files.length,
        mutableActionReferences: 0,
      }),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
