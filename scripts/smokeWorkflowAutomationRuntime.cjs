const process =
  require("node:process");

const baseUrl =
  (
    process.env.WORKFLOW_SMOKE_BASE_URL ||
    process.argv[2] ||
    "http://localhost:3000"
  ).replace(
    /\/+$/,
    "",
  );

const timeoutMs =
  Number(
    process.env.WORKFLOW_SMOKE_TIMEOUT_MS ||
    30000,
  );

const endpoints = [
  {
    name:
      "Automation preview",

    path:
      "/api/recruiter/workflow/automation-preview?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "automation preview response",
      );

      assertObject(
        body.summary,
        "automation preview summary",
      );

      assertArray(
        body.proposals,
        "automation preview proposals",
      );
    },
  },

  {
    name:
      "Execution readiness",

    path:
      "/api/recruiter/workflow/execution-readiness?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "execution readiness response",
      );

      assertObject(
        body.summary,
        "execution readiness summary",
      );

      assertArray(
        body.items,
        "execution readiness items",
      );

      assertFalseWhenPresent(
        body.safety,
        "executionEnabled",
        "readiness safety.executionEnabled",
      );
    },
  },

  {
    name:
      "Execution plan",

    path:
      "/api/recruiter/workflow/execution-plan?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "execution plan response",
      );

      assertObject(
        body.summary,
        "execution plan summary",
      );

      assertArray(
        body.plans,
        "execution plans",
      );

      assertFalseWhenPresent(
        body.safety,
        "executionEnabled",
        "plan safety.executionEnabled",
      );
    },
  },

  {
    name:
      "Execution audit preview",

    path:
      "/api/recruiter/workflow/execution-audit-preview?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "execution audit preview response",
      );

      assertObject(
        body.summary,
        "execution audit preview summary",
      );

      assertArray(
        body.previews,
        "execution audit previews",
      );

      assertFalseWhenPresent(
        body.safety,
        "executionEnabled",
        "audit safety.executionEnabled",
      );

      assertZeroWhenPresent(
        body.summary,
        "auditWrites",
        "audit summary.auditWrites",
      );
    },
  },

  {
    name:
      "Execution simulator",

    path:
      "/api/recruiter/workflow/execution-simulator?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "execution simulator response",
      );

      assertObject(
        body.summary,
        "execution simulator summary",
      );

      assertArray(
        body.simulations,
        "execution simulations",
      );

      assertFalseWhenPresent(
        body.safety,
        "executionEnabled",
        "simulation safety.executionEnabled",
      );

      assertZeroWhenPresent(
        body.summary,
        "candidateDbWrites",
        "simulation summary.candidateDbWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "workflowWrites",
        "simulation summary.workflowWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "auditWrites",
        "simulation summary.auditWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "emailSends",
        "simulation summary.emailSends",
      );
    },
  },

  {
    name:
      "Execution release gate",

    path:
      "/api/recruiter/workflow/execution-release-gate?limit=20",

    validate(
      body,
    ) {
      assertObject(
        body,
        "execution release gate response",
      );

      assertObject(
        body.summary,
        "execution release gate summary",
      );

      assertArray(
        body.items,
        "execution release gate items",
      );

      assertFalseWhenPresent(
        body.safety,
        "executionEnabled",
        "release gate safety.executionEnabled",
      );

      assertFalseWhenPresent(
        body.lock,
        "releaseAllowed",
        "release gate lock.releaseAllowed",
      );

      assertZeroWhenPresent(
        body.summary,
        "candidateDbWrites",
        "release gate summary.candidateDbWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "workflowWrites",
        "release gate summary.workflowWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "auditWrites",
        "release gate summary.auditWrites",
      );

      assertZeroWhenPresent(
        body.summary,
        "emailSends",
        "release gate summary.emailSends",
      );

      assertZeroWhenPresent(
        body.summary,
        "releasesPerformed",
        "release gate summary.releasesPerformed",
      );

      for (
        const item of
        body.items
      ) {
        assertFalseWhenPresent(
          item.lock,
          "releaseAllowed",
          `release item ${item.proposalId || "unknown"} releaseAllowed`,
        );

        assertFalseWhenPresent(
          item.lock,
          "wouldRelease",
          `release item ${item.proposalId || "unknown"} wouldRelease`,
        );
      }
    },
  },
];

function assertObject(
  value,
  label,
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    throw new Error(
      `${label} must be an object.`,
    );
  }
}

function assertArray(
  value,
  label,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    throw new Error(
      `${label} must be an array.`,
    );
  }
}

function assertFalseWhenPresent(
  object,
  key,
  label,
) {
  if (
    !object ||
    !Object.prototype.hasOwnProperty.call(
      object,
      key,
    )
  ) {
    return;
  }

  if (
    object[key] !==
    false
  ) {
    throw new Error(
      `${label} must be false; received ${JSON.stringify(
        object[key],
      )}.`,
    );
  }
}

function assertZeroWhenPresent(
  object,
  key,
  label,
) {
  if (
    !object ||
    !Object.prototype.hasOwnProperty.call(
      object,
      key,
    )
  ) {
    return;
  }

  if (
    object[key] !==
    0
  ) {
    throw new Error(
      `${label} must be 0; received ${JSON.stringify(
        object[key],
      )}.`,
    );
  }
}

async function fetchJson(
  endpoint,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs,
    );

  try {
    const response =
      await fetch(
        `${baseUrl}${endpoint.path}`,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",
          },

          redirect:
            "manual",

          signal:
            controller.signal,
        },
      );

    const raw =
      await response.text();

    let body;

    try {
      body =
        raw
          ? JSON.parse(
              raw,
            )
          : null;
    } catch {
      throw new Error(
        `${endpoint.name} returned non-JSON content: ${raw.slice(
          0,
          200,
        )}`,
      );
    }

    if (
      response.status !==
      200
    ) {
      throw new Error(
        `${endpoint.name} returned HTTP ${response.status}: ${JSON.stringify(
          body,
        ).slice(
          0,
          500,
        )}`,
      );
    }

    endpoint.validate(
      body,
    );

    return {
      name:
        endpoint.name,

      path:
        endpoint.path,

      status:
        response.status,

      passed:
        true,
    };
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function main() {
  console.log(
    `Workflow runtime smoke test: ${baseUrl}`,
  );

  const results = [];

  for (
    const endpoint of
    endpoints
  ) {
    const startedAt =
      Date.now();

    try {
      const result =
        await fetchJson(
          endpoint,
        );

      const durationMs =
        Date.now() -
        startedAt;

      results.push({
        ...result,
        durationMs,
      });

      console.log(
        `PASS ${endpoint.name} HTTP 200 (${durationMs}ms)`,
      );
    } catch (error) {
      const durationMs =
        Date.now() -
        startedAt;

      results.push({
        name:
          endpoint.name,

        path:
          endpoint.path,

        passed:
          false,

        durationMs,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });

      console.error(
        `FAIL ${endpoint.name} (${durationMs}ms)`,
      );

      console.error(
        error instanceof Error
          ? error.message
          : String(
              error,
            ),
      );
    }
  }

  const failed =
    results.filter(
      (result) =>
        !result.passed,
    );

  console.log(
    `\nPassed: ${results.length - failed.length}/${results.length}`,
  );

  if (
    failed.length
  ) {
    console.error(
      "\nWORKFLOW RUNTIME SMOKE TEST FAILED",
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    "\nWORKFLOW RUNTIME SMOKE TEST PASSED",
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);