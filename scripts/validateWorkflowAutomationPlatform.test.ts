import assert from "node:assert/strict";
import fs from "node:fs";

const validatorPath =
  "scripts/validateWorkflowAutomationPlatform.cjs";

assert.ok(
  fs.existsSync(
    validatorPath,
  ),
);

const validator =
  fs.readFileSync(
    validatorPath,
    "utf8",
  );

const packageJson =
  JSON.parse(
    fs.readFileSync(
      "package.json",
      "utf8",
    ),
  );

assert.match(
  validator,
  /discoverWorkflowTests/,
);

assert.match(
  validator,
  /validateRequiredFiles/,
);

assert.match(
  validator,
  /validateRouteContracts/,
);

assert.match(
  validator,
  /validateSafetyInvariants/,
);

assert.match(
  validator,
  /validateChecksums/,
);

assert.match(
  validator,
  /validateStalePropagation/,
);

assert.match(
  validator,
  /validateAtomicFileStores/,
);

assert.equal(
  packageJson.scripts[
    "validate:workflow"
  ],
  "node scripts/validateWorkflowAutomationPlatform.cjs",
);

assert.equal(
  packageJson.scripts[
    "validate:workflow:fast"
  ],
  "node scripts/validateWorkflowAutomationPlatform.cjs --skip-build",
);

assert.equal(
  packageJson.scripts[
    "validate:workflow:tests"
  ],
  "node scripts/validateWorkflowAutomationPlatform.cjs --only-tests",
);

console.log(
  "validateWorkflowAutomationPlatform.test.ts passed",
);