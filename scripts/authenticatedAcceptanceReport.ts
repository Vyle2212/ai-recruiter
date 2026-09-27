import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertAcceptanceEvidenceIsSanitized,
  AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
} from "../lib/acceptanceEnvironmentSafety";
import {
  acceptanceFinalDecision,
  parseAcceptanceExternalMode,
} from "../lib/acceptanceFixtureLease";
import { sanitizedBridgeEvidence } from "../lib/acceptanceDeploymentBridge";

import { collect, type PlaywrightResult } from "../lib/acceptanceReportResults";

const externalTests = new Set([
  "external continuation tokens fail closed across actor scope and after logout",
  "Search V2 UI pagination reuses loaded data and expansion is one action",
]);
const disabledExternalTest =
  "disabled external scope fails closed before provider execution";
const roleTests = new Set([
  "anonymous and denied-role responses are private error-only JSON",
  "recruiter, manager and admin retain authorized Search V2 access",
  "browser route guard enforces the same role boundary",
  "permission matrix denies privilege escalation and permits mapped roles",
  "controlled reversible role mutations match policy",
]);
// Keep the report tied to the actual acceptance contract. A count alone can
// pass when an essential test is removed and an unrelated one is added.
const requiredTests = new Set([
  "exact deployed release is the requested HTTPS build",
  "anonymous and denied-role responses are private error-only JSON",
  "recruiter, manager and admin retain authorized Search V2 access",
  "browser route guard enforces the same role boundary",
  "permission matrix denies privilege escalation and permits mapped roles",
  "write-request boundaries reject CSRF, type, size and action mismatch",
  "controlled reversible role mutations match policy",
  "real recruiter login, private page, logout and browser back remain safe",
  "deactivation invalidates an already-authorized session and reactivation reauthorizes",
  "server-side session revocation invalidates subsequent API access",
  "internal Search V2 uses only the synthetic acceptance dataset",
  "synthetic Search V2 shortlist persists for its owner and can be removed",
  "synthetic candidate drawer remains private and preserves Experience/Projects semantics",
  "Search V2 shows Compare Pack beside Shortlist with separate employer and client periods",
  "candidate-detail caches are isolated by authenticated actor scope",
  "external continuation tokens fail closed across actor scope and after logout",
  "Search V2 UI pagination reuses loaded data and expansion is one action",
  "disabled external scope fails closed before provider execution",
]);

async function main() {
  const phase = process.argv[2];
  if (!["initial", "final"].includes(phase))
    throw new Error("acceptance_report_phase_invalid");
  const input = path.resolve(
    process.env.ACCEPTANCE_PLAYWRIGHT_RESULTS ||
      "artifacts/acceptance-playwright-results.json",
  );
  const output = path.resolve(
    process.env.ACCEPTANCE_REPORT_PATH ||
      "artifacts/authenticated-acceptance-report.json",
  );
  let parsed: PlaywrightResult = {};
  try {
    parsed = JSON.parse(await readFile(input, "utf8")) as PlaywrightResult;
  } catch {}
  const tests = collect(parsed);
  const externalMode = parseAcceptanceExternalMode(
    process.env.ACCEPTANCE_EXTERNAL_MODE,
  );
  const passedNames = new Set(
    tests.filter((test) => test.status === "passed").map((test) => test.test),
  );
  const skipped = tests.filter((test) =>
    ["skipped", "pending"].includes(test.status),
  );
  const allowedSkippedTests =
    externalMode === "disabled"
      ? externalTests
      : new Set([disabledExternalTest]);
  const externalProviderExecuted = [...externalTests].every((name) =>
    passedNames.has(name),
  );
  const authenticatedRoleMatrixComplete = [...roleTests].every((name) =>
    passedNames.has(name),
  );
  const testsPassed =
    tests.length === requiredTests.size &&
    new Set(tests.map((test) => test.test)).size === requiredTests.size &&
    tests.every((test) => requiredTests.has(test.test)) &&
    tests.every(
      (test) =>
        test.status === "passed" ||
        (test.status === "skipped" && allowedSkippedTests.has(test.test)),
    ) &&
    skipped.every((test) => allowedSkippedTests.has(test.test));
  const finalDecision =
    phase === "final"
      ? acceptanceFinalDecision({
          externalMode,
          testsPassed,
          externalTestsExecuted: externalProviderExecuted,
          externalProviderDisabled:
            process.env.ACCEPTANCE_EXTERNAL_PROVIDER_DISABLED === "true",
          fixtureInstalled: process.env.ACCEPTANCE_FIXTURE_INSTALLED === "true",
          fixtureRemoved: process.env.ACCEPTANCE_FIXTURE_REMOVED === "true",
          cleanupVerified:
            process.env.ACCEPTANCE_CLEANUP_VERIFIED === "true" &&
            process.env.ACCEPTANCE_IDENTITY_CLEANUP_VERIFIED === "true",
          authenticatedRoleMatrixComplete,
        })
      : "NO_GO";
  const report = {
    schemaVersion: AUTHENTICATED_ACCEPTANCE_HARNESS_VERSION,
    testedCommitSha: String(process.env.ACCEPTANCE_EXPECTED_SHA || ""),
    testedBuildId: String(process.env.ACCEPTANCE_TESTED_BUILD_ID || ""),
    testedDeploymentHash: String(
      process.env.ACCEPTANCE_TESTED_DEPLOYMENT_HASH || "",
    ),
    acceptanceScope:
      externalMode === "required" ? "full_scope" : "internal_talent_hub_only",
    externalProviderExecuted,
    externalProviderDisabled:
      process.env.ACCEPTANCE_EXTERNAL_PROVIDER_DISABLED === "true",
    fixtureInstalled: process.env.ACCEPTANCE_FIXTURE_INSTALLED === "true",
    fixtureRemoved: process.env.ACCEPTANCE_FIXTURE_REMOVED === "true",
    cleanupVerified:
      process.env.ACCEPTANCE_CLEANUP_VERIFIED === "true" &&
      process.env.ACCEPTANCE_IDENTITY_CLEANUP_VERIFIED === "true",
    authenticatedRoleMatrixComplete,
    finalDecision,
    productionReleaseDecision: "NO_GO_PENDING_EXACT_RELEASE_PROMOTION",
    releasePromotionLimitation:
      "Feature-branch acceptance does not validate a later merge or squash SHA.",
    generatedAt: new Date().toISOString(),
    testCount: tests.length,
    passed: tests.filter((test) => test.status === "passed").length,
    failed: tests.filter((test) => !["passed", "skipped"].includes(test.status))
      .length,
    tests,
    evidenceFiles: [
      "acceptance-evidence/recruiter-search-page.png",
      "acceptance-evidence/client-role-denied.png",
      "acceptance-evidence/private-candidate-drawer.png",
    ],
    durableAuditStorage: "deferred_to_production_trust_task_1d",
  };
  sanitizedBridgeEvidence(report);
  if (assertAcceptanceEvidenceIsSanitized(report).length)
    throw new Error("authenticated_acceptance_report_redaction_failed");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(
    JSON.stringify({ ok: true, phase, finalDecision, testCount: tests.length }),
  );
  if (phase === "final" && finalDecision === "NO_GO") process.exitCode = 1;
}

main().catch(() => {
  console.error("authenticated_acceptance_report_generation_failed");
  process.exitCode = 1;
});
