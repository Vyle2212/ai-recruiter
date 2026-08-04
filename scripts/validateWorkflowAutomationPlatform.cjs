const fs =
  require("node:fs");

const path =
  require("node:path");

const {
  spawnSync,
} =
  require("node:child_process");

const root =
  process.cwd();

const argumentsSet =
  new Set(
    process.argv.slice(2),
  );

const skipBuild =
  argumentsSet.has(
    "--skip-build",
  );

const skipTypecheck =
  argumentsSet.has(
    "--skip-typecheck",
  );

const onlyTests =
  argumentsSet.has(
    "--only-tests",
  );

const startedAt =
  Date.now();

const results = [];

function relative(
  fullPath,
) {
  return path
    .relative(
      root,
      fullPath,
    )
    .replace(
      /\\/g,
      "/",
    );
}

function banner(
  title,
) {
  const line =
    "=".repeat(
      Math.max(
        24,
        title.length + 8,
      ),
    );

  console.log(
    `\n${line}`,
  );

  console.log(
    `=== ${title} ===`,
  );

  console.log(
    line,
  );
}

function record(
  name,
  status,
  durationMs,
  detail = "",
) {
  results.push({
    name,
    status,
    durationMs,
    detail,
  });
}

function runCommand(
  name,
  command,
  args,
  options = {},
) {
  banner(name);

  const started =
    Date.now();

  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          root,

        stdio:
          "inherit",

        shell:
          process.platform ===
          "win32",

        env: {
          ...process.env,
          FORCE_COLOR:
            "1",
        },

        ...options,
      },
    );

  const durationMs =
    Date.now() -
    started;

  if (
    result.error
  ) {
    record(
      name,
      "FAILED",
      durationMs,
      result.error.message,
    );

    throw result.error;
  }

  if (
    result.status !==
    0
  ) {
    record(
      name,
      "FAILED",
      durationMs,
      `Exit code ${result.status}`,
    );

    throw new Error(
      `${name} failed with exit code ${result.status}.`,
    );
  }

  record(
    name,
    "PASSED",
    durationMs,
  );
}

function assertFile(
  relativePath,
) {
  const fullPath =
    path.join(
      root,
      relativePath,
    );

  if (
    !fs.existsSync(
      fullPath,
    )
  ) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }
}

function read(
  relativePath,
) {
  assertFile(
    relativePath,
  );

  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

function assertMatch(
  relativePath,
  pattern,
  description,
) {
  const source =
    read(
      relativePath,
    );

  if (
    !pattern.test(
      source,
    )
  ) {
    throw new Error(
      `${description}\nFile: ${relativePath}\nExpected pattern: ${pattern}`,
    );
  }
}

function assertNotMatch(
  relativePath,
  pattern,
  description,
) {
  const source =
    read(
      relativePath,
    );

  if (
    pattern.test(
      source,
    )
  ) {
    throw new Error(
      `${description}\nFile: ${relativePath}\nForbidden pattern: ${pattern}`,
    );
  }
}

function listFiles(
  directory,
) {
  if (
    !fs.existsSync(
      directory,
    )
  ) {
    return [];
  }

  return fs
    .readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    )
    .flatMap(
      (entry) => {
        const fullPath =
          path.join(
            directory,
            entry.name,
          );

        if (
          entry.isDirectory()
        ) {
          return listFiles(
            fullPath,
          );
        }

        return [
          fullPath,
        ];
      },
    );
}

function discoverWorkflowTests() {
  const scriptsDirectory =
    path.join(
      root,
      "scripts",
    );

  return listFiles(
    scriptsDirectory,
  )
    .filter(
      (fullPath) => {
        const filename =
          path.basename(
            fullPath,
          );

        return (
          /^recruiterWorkflow.*\.test\.ts$/i.test(
            filename,
          ) ||
          /^workflow.*\.test\.ts$/i.test(
            filename,
          )
        );
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        relative(
          left,
        ).localeCompare(
          relative(
            right,
          ),
        ),
    );
}

function validateRequiredFiles() {
  banner(
    "Required workflow files",
  );

  const started =
    Date.now();

  const requiredFiles = [
    "lib/recruiterWorkflowAutomationRules.ts",
    "lib/recruiterWorkflowAutomationRuleConfig.ts",
    "lib/recruiterWorkflowAutomationDecisions.ts",
    "lib/recruiterWorkflowAutomationApprovalHistory.ts",
    "lib/recruiterWorkflowExecutionReadiness.ts",
    "lib/recruiterWorkflowExecutionPlan.ts",
    "lib/recruiterWorkflowExecutionAuditPreview.ts",
    "lib/recruiterWorkflowExecutionSimulator.ts",
    "lib/recruiterWorkflowExecutionReleaseGate.ts",

    "app/api/recruiter/workflow/automation-preview/route.ts",
    "app/api/recruiter/workflow/automation-decisions/route.ts",
    "app/api/recruiter/workflow/automation-rules/route.ts",
    "app/api/recruiter/workflow/automation-approval-history/route.ts",
    "app/api/recruiter/workflow/execution-readiness/route.ts",
    "app/api/recruiter/workflow/execution-plan/route.ts",
    "app/api/recruiter/workflow/execution-audit-preview/route.ts",
    "app/api/recruiter/workflow/execution-simulator/route.ts",
    "app/api/recruiter/workflow/execution-release-gate/route.ts",

    "app/recruiter/workflow/automation/page.tsx",
    "app/recruiter/workflow/automation/rules/page.tsx",
    "app/recruiter/workflow/automation/simulator/page.tsx",
    "app/recruiter/workflow/automation/approval/page.tsx",
    "app/recruiter/workflow/automation/approval/batch/page.tsx",
    "app/recruiter/workflow/automation/history/page.tsx",
    "app/recruiter/workflow/automation/release-gate/page.tsx",
    "app/recruiter/workflow/automation/operations/page.tsx",
  ];

  for (
    const requiredFile of
    requiredFiles
  ) {
    assertFile(
      requiredFile,
    );

    console.log(
      `✓ ${requiredFile}`,
    );
  }

  record(
    "Required workflow files",
    "PASSED",
    Date.now() -
      started,
    `${requiredFiles.length} files verified`,
  );
}

function validateRouteContracts() {
  banner(
    "Route contracts",
  );

  const started =
    Date.now();

  const getOnlyRoutes = [
    "app/api/recruiter/workflow/execution-release-gate/route.ts",
    "app/api/recruiter/workflow/execution-simulator/route.ts",
    "app/api/recruiter/workflow/execution-audit-preview/route.ts",
    "app/api/recruiter/workflow/execution-plan/route.ts",
    "app/api/recruiter/workflow/execution-readiness/route.ts",
  ];

  for (
    const routePath of
    getOnlyRoutes
  ) {
    assertMatch(
      routePath,
      /export async function GET/,
      "Expected a GET handler.",
    );

    assertNotMatch(
      routePath,
      /export async function (POST|PUT|PATCH|DELETE)/,
      "Preview and gate route unexpectedly exposes a write handler.",
    );

    console.log(
      `✓ GET-only: ${routePath}`,
    );
  }

  assertMatch(
    "app/api/recruiter/workflow/automation-decisions/route.ts",
    /export async function POST/,
    "Automation decisions route must support recruiter decisions.",
  );

  assertMatch(
    "app/api/recruiter/workflow/automation-approval-history/route.ts",
    /export async function POST/,
    "Approval history route must support history appends.",
  );

  assertMatch(
    "app/api/recruiter/workflow/automation-rules/route.ts",
    /export async function POST/,
    "Automation rules route must support configuration updates.",
  );

  record(
    "Route contracts",
    "PASSED",
    Date.now() -
      started,
  );
}

function validateSafetyInvariants() {
  banner(
    "Safety invariants",
  );

  const started =
    Date.now();

  const protectedFiles = [
    "lib/recruiterWorkflowAutomationRules.ts",
    "lib/recruiterWorkflowExecutionReadiness.ts",
    "lib/recruiterWorkflowExecutionPlan.ts",
    "lib/recruiterWorkflowExecutionAuditPreview.ts",
    "lib/recruiterWorkflowExecutionSimulator.ts",
    "lib/recruiterWorkflowExecutionReleaseGate.ts",

    "app/api/recruiter/workflow/execution-readiness/route.ts",
    "app/api/recruiter/workflow/execution-plan/route.ts",
    "app/api/recruiter/workflow/execution-audit-preview/route.ts",
    "app/api/recruiter/workflow/execution-simulator/route.ts",
    "app/api/recruiter/workflow/execution-release-gate/route.ts",

    "app/recruiter/workflow/automation/simulator/page.tsx",
    "app/recruiter/workflow/automation/release-gate/page.tsx",
    "app/recruiter/workflow/automation/operations/page.tsx",
  ];

  const forbiddenPatterns = [
    {
      pattern:
        /\bexecutionEnabled\s*:\s*true\b/,

      message:
        "Execution was enabled in a protected workflow file.",
    },

    {
      pattern:
        /\breleaseAllowed\s*:\s*true\b/,

      message:
        "Workflow release was enabled in a protected workflow file.",
    },

    {
      pattern:
        /\bwouldRelease\s*:\s*true\b/,

      message:
        "A release preview claims that it would release.",
    },

    {
      pattern:
        /\bautomaticExecution\s*:\s*true\b/,

      message:
        "Automatic workflow execution was enabled.",
    },

    {
      pattern:
        /fetch\(\s*["'][^"']*(move-stage|rollback-stage)/,

      message:
        "Protected preview UI calls a workflow mutation route.",
    },
  ];

  for (
    const relativePath of
    protectedFiles
  ) {
    const source =
      read(
        relativePath,
      );

    for (
      const invariant of
      forbiddenPatterns
    ) {
      if (
        invariant.pattern.test(
          source,
        )
      ) {
        throw new Error(
          `${invariant.message}\nFile: ${relativePath}\nPattern: ${invariant.pattern}`,
        );
      }
    }

    console.log(
      `✓ Safe: ${relativePath}`,
    );
  }

  assertMatch(
    "app/api/recruiter/workflow/execution-release-gate/route.ts",
    /executionLockEnabled\s*:\s*false/,
    "Release gate API must keep the execution lock disabled.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /releaseAllowed:\s*false/,
    "Release gate engine must prohibit release.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /wouldRelease:\s*false/,
    "Release gate engine must remain preview-only.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /executionEnabled:\s*false/,
    "Release gate engine must keep execution disabled.",
  );

  record(
    "Safety invariants",
    "PASSED",
    Date.now() -
      started,
    `${protectedFiles.length} protected files verified`,
  );
}

function validateChecksums() {
  banner(
    "Checksum contracts",
  );

  const started =
    Date.now();

  assertMatch(
    "lib/recruiterWorkflowExecutionAuditPreview.ts",
    /sha256/i,
    "Audit preview must use SHA-256.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionSimulator.ts",
    /checksum/i,
    "Execution simulator must include checksum validation.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /auditChecksum/,
    "Release gate must inspect the audit checksum.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /simulationChecksum/,
    "Release gate must inspect the simulation checksum.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /auditChecksum\s*===\s*simulationChecksum/,
    "Release gate must compare audit and simulation checksums.",
  );

  record(
    "Checksum contracts",
    "PASSED",
    Date.now() -
      started,
  );
}

function validateStalePropagation() {
  banner(
    "Stale proposal propagation",
  );

  const started =
    Date.now();

  assertMatch(
    "lib/recruiterWorkflowExecutionReadiness.ts",
    /STALE/,
    "Readiness engine must support STALE status.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /proposal_not_stale/,
    "Release gate must include proposal freshness validation.",
  );

  assertMatch(
    "lib/recruiterWorkflowExecutionReleaseGate.ts",
    /readinessItem\.status\s*!==\s*"STALE"/,
    "Release gate must block stale proposals.",
  );

  record(
    "Stale proposal propagation",
    "PASSED",
    Date.now() -
      started,
  );
}

function validateAtomicFileStores() {
  banner(
    "Atomic file-store contracts",
  );

  const started =
    Date.now();

  const fileStores = [
    "lib/recruiterWorkflowAutomationRuleConfig.ts",
    "lib/recruiterWorkflowAutomationDecisions.ts",
    "lib/recruiterWorkflowAutomationApprovalHistory.ts",
  ];

  for (
    const relativePath of
    fileStores
  ) {
    assertMatch(
      relativePath,
      /\.tmp/,
      "File store must write through a temporary file.",
    );

    assertMatch(
      relativePath,
      /renameSync/,
      "File store must atomically rename the temporary file.",
    );

    console.log(
      `✓ Atomic write: ${relativePath}`,
    );
  }

  record(
    "Atomic file-store contracts",
    "PASSED",
    Date.now() -
      started,
  );
}

function runWorkflowTests() {
  const tests =
    discoverWorkflowTests();

  if (
    !tests.length
  ) {
    throw new Error(
      "No workflow regression tests were discovered.",
    );
  }

  banner(
    `Workflow regression tests (${tests.length})`,
  );

  for (
    const testPath of
    tests
  ) {
    const testName =
      relative(
        testPath,
      );

    runCommand(
      testName,
      "npx",
      [
        "tsx",
        testName,
      ],
    );
  }
}

function printSummary(
  failedError = null,
) {
  banner(
    "Validation summary",
  );

  for (
    const result of
    results
  ) {
    const seconds =
      (
        result.durationMs /
        1000
      ).toFixed(
        2,
      );

    const symbol =
      result.status ===
      "PASSED"
        ? "✓"
        : "×";

    console.log(
      `${symbol} ${result.status.padEnd(
        6,
      )} ${result.name} (${seconds}s)${
        result.detail
          ? ` — ${result.detail}`
          : ""
      }`,
    );
  }

  const totalSeconds =
    (
      (
        Date.now() -
        startedAt
      ) /
      1000
    ).toFixed(
      2,
    );

  console.log(
    `\nTotal duration: ${totalSeconds}s`,
  );

  if (
    failedError
  ) {
    console.error(
      `\nVALIDATION FAILED\n${failedError.message}`,
    );
  } else {
    console.log(
      "\nWORKFLOW AUTOMATION PLATFORM VALIDATION PASSED",
    );
  }
}

async function main() {
  try {
    runWorkflowTests();

    if (
      !onlyTests
    ) {
      validateRequiredFiles();
      validateRouteContracts();
      validateSafetyInvariants();
      validateChecksums();
      validateStalePropagation();
      validateAtomicFileStores();
    }

    if (
      !onlyTests &&
      !skipTypecheck
    ) {
      runCommand(
        "TypeScript typecheck",
        "npm",
        [
          "run",
          "typecheck",
        ],
      );
    }

    if (
      !onlyTests &&
      !skipBuild
    ) {
      runCommand(
        "Next.js production build",
        "npm",
        [
          "run",
          "build",
        ],
      );
    }

    printSummary();
  } catch (error) {
    printSummary(
      error instanceof Error
        ? error
        : new Error(
            String(error),
          ),
    );

    process.exitCode =
      1;
  }
}

main();