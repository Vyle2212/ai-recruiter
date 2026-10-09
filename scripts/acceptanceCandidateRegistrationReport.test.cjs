const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require(
  process.env.ACCEPTANCE_TYPESCRIPT_TEST_MODULE || "typescript",
);
const source = fs.readFileSync(
  path.join(process.cwd(), "scripts/authenticatedAcceptanceReport.ts"),
  "utf8",
);
const title =
  "public candidate signup confirms one ownership chain and cleans captured mail";
const setText = source.slice(
  source.indexOf("const requiredTests"),
  source.indexOf("async function main"),
);
const names = [...setText.matchAll(/"([^"\n]+)"/g)].map((match) => match[1]);
names.push(title);
const external = new Set([
  "external continuation tokens fail closed across actor scope and after logout",
  "Search V2 UI pagination reuses loaded data and expansion is one action",
]);
async function run({
  requested = false,
  status = "skipped",
  omit = false,
} = {}) {
  let output, testedPassed;
  const cases = names
    .filter((name) => !omit || name !== title)
    .map((name) => ({
      test: name,
      status:
        name === title ? status : external.has(name) ? "skipped" : "passed",
    }));
  const env = {
    ACCEPTANCE_EXTERNAL_MODE: "disabled",
    ACCEPTANCE_REGISTRATION_JOURNEY_ENABLED: String(requested),
    ACCEPTANCE_IDENTITY_CLEANUP_VERIFIED: "true",
    ACCEPTANCE_CLEANUP_VERIFIED: "true",
  };
  const processMock = { argv: ["node", "report", "final"], env, exitCode: 0 };
  const mockedRequire = (target) => {
    if (target === "node:fs/promises")
      return {
        mkdir: async () => {},
        readFile: async () => "{}",
        writeFile: async (_path, value) => {
          output = JSON.parse(value);
        },
      };
    if (target.endsWith("acceptanceEnvironmentSafety"))
      return {
        AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION:
          "production-trust-authenticated-acceptance-v2",
        assertAcceptanceEvidenceIsSanitized: () => [],
      };
    if (target.endsWith("acceptanceFixtureLease"))
      return {
        parseAcceptanceExternalMode: (value) => value,
        acceptanceFinalDecision: (input) => {
          testedPassed = input.testsPassed;
          return input.testsPassed ? "INTERNAL_ONLY_PASS" : "NO_GO";
        },
      };
    if (target.endsWith("acceptanceDeploymentBridge"))
      return { sanitizedBridgeEvidence: (value) => value };
    if (target.endsWith("acceptanceReportResults"))
      return { collect: () => cases };
    return require(target);
  };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports: {},
      require: mockedRequire,
      process: processMock,
      console: { log: () => {}, error: () => {} },
      Date,
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(output);
  return { output, testedPassed, exitCode: processMock.exitCode };
}
(async () => {
  const disabled = await run();
  assert.equal(disabled.testedPassed, true);
  assert.equal(disabled.output.candidateRegistration.requested, false);
  assert.equal(
    disabled.output.candidateRegistration.onboardingAndMailCleanupVerified,
    false,
  );
  assert.equal(
    disabled.output.candidateRegistration.identityCleanupVerified,
    false,
  );
  const enabled = await run({ requested: true, status: "passed" });
  assert.equal(enabled.testedPassed, true);
  assert.equal(
    enabled.output.candidateRegistration.onboardingAndMailCleanupVerified,
    true,
  );
  assert.equal(
    enabled.output.candidateRegistration.identityCleanupVerified,
    true,
  );
  for (const options of [
    { requested: true, status: "skipped" },
    { requested: true, status: "failed" },
    { requested: false, status: "passed" },
    { omit: true },
  ]) {
    const rejected = await run(options);
    assert.equal(rejected.testedPassed, false);
    assert.equal(rejected.exitCode, 1);
    assert.equal(
      rejected.output.candidateRegistration.onboardingAndMailCleanupVerified,
      false,
    );
  }
  console.log(
    "Candidate registration report contracts PASS (opt-in, skip, failure and missing-test gates).",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
