import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertAcceptanceEvidenceIsSanitized } from "../lib/acceptanceEnvironmentSafety";

type PlaywrightResult = {
  suites?: Array<{
    title?: string;
    specs?: Array<{
      title?: string;
      tests?: Array<{
        status?: string;
        results?: Array<{ status?: string; duration?: number }>;
      }>;
    }>;
  }>;
};

function collect(result: PlaywrightResult) {
  return (result.suites || []).flatMap((suite) =>
    (suite.specs || []).map((spec) => {
      const attempts = (spec.tests || []).flatMap((item) => item.results || []);
      return {
        suite: suite.title || "authenticated acceptance",
        test: spec.title || "unnamed acceptance",
        status:
          attempts.at(-1)?.status || spec.tests?.at(-1)?.status || "unknown",
        durationMs: attempts.reduce(
          (sum, attempt) => sum + (attempt.duration || 0),
          0,
        ),
      };
    }),
  );
}

async function main() {
  const inputPath = path.resolve(
    process.env.ACCEPTANCE_PLAYWRIGHT_RESULTS ||
      "artifacts/acceptance-playwright-results.json",
  );
  const outputPath = path.resolve(
    process.env.ACCEPTANCE_REPORT_PATH ||
      "artifacts/authenticated-acceptance-report.json",
  );
  const parsed = JSON.parse(
    await readFile(inputPath, "utf8"),
  ) as PlaywrightResult;
  const tests = collect(parsed);
  const report = {
    schemaVersion: "production-trust-authenticated-acceptance-v1",
    testedCommit: String(process.env.ACCEPTANCE_EXPECTED_SHA || ""),
    buildId: String(
      process.env.ACCEPTANCE_TESTED_BUILD_ID || "reported-by-release-endpoint",
    ),
    environmentHash: String(
      process.env.ACCEPTANCE_ENVIRONMENT_HASH || "runtime-evidence",
    ),
    generatedAt: new Date().toISOString(),
    productionDecision:
      tests.length > 0 && tests.every((item) => item.status === "passed")
        ? "acceptance_tests_passed_pending_release_signoff"
        : "no_go",
    testCount: tests.length,
    passed: tests.filter((item) => item.status === "passed").length,
    failed: tests.filter((item) => item.status !== "passed").length,
    tests,
    evidenceFiles: [
      "acceptance-evidence/recruiter-search-page.png",
      "acceptance-evidence/client-role-denied.png",
      "acceptance-evidence/private-candidate-drawer.png",
    ],
    externalProviderAcceptance:
      process.env.ACCEPTANCE_EXTERNAL_PROVIDER_APPROVED === "true"
        ? "executed"
        : "not_executed_owner_approval_required",
    durableAuditStorage: "deferred_to_production_trust_task_1d",
  };
  const violations = assertAcceptanceEvidenceIsSanitized(report);
  if (violations.length)
    throw new Error("authenticated_acceptance_report_redaction_failed");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(
    JSON.stringify({
      ok: true,
      testCount: report.testCount,
      passed: report.passed,
      failed: report.failed,
    }),
  );
}

main().catch(() => {
  console.error("authenticated_acceptance_report_generation_failed");
  process.exitCode = 1;
});
