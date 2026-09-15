import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { collect } from "../lib/acceptanceReportResults";
import { waitForAcceptanceSearchReady } from "../acceptance/e2e/acceptanceHelpers";

async function main() {
  const tests = collect({
    suites: [
      {
        title: "file",
        suites: [
          {
            title: "group",
            specs: [
              {
                title: "passing",
                tests: [{ results: [{ status: "passed", duration: 12 }] }],
              },
              {
                title: "failing",
                tests: [{ results: [{ status: "failed", duration: 20 }] }],
              },
              {
                title: "skipped",
                tests: [{ results: [{ status: "skipped", duration: 0 }] }],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    tests.map((t) => t.status),
    ["passed", "failed", "skipped"],
  );
  assert.equal(tests[0].durationMs, 12);
  assert.deepEqual(collect({}), []);
  let calls = 0;
  let disposed = 0;
  const api = {
    get: async () => {
      calls++;
      return {
        status: () => (calls === 1 ? 503 : 200),
        json: async () =>
          calls === 1
            ? {
                ready: false,
                status: "warming",
                error: { code: "SEARCH_INDEX_WARMING" },
              }
            : {
                ready: true,
                sources: {
                  internal_profiles: { available: true, population: 1 },
                },
              },
        dispose: async () => {
          disposed++;
        },
      };
    },
  };
  await waitForAcceptanceSearchReady(api as never);
  assert.equal(calls, 2);
  assert.equal(disposed, 2);
  for (const status of [401, 403, 500, 503]) {
    let attempts = 0;
    await assert.rejects(
      waitForAcceptanceSearchReady({
        get: async () => {
          attempts++;
          return {
            status: () => status,
            json: async () => ({ ready: false, status: "failed" }),
            dispose: async () => {},
          };
        },
      } as never),
      /acceptance_search_not_ready/,
    );
    assert.equal(
      attempts,
      1,
      "Never retry authorization errors or unknown service failures",
    );
  }
  const directory = mkdtempSync(join(tmpdir(), "acceptance-report-test-"));
  try {
    const source = readFileSync(
      "acceptance/e2e/productionTrustAuthenticatedAcceptance.spec.ts",
      "utf8",
    );
    const names = [...source.matchAll(/test\("([^"\n]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(names.length, 16);
    const specs = names.map((title) => ({
      title,
      tests: [
        {
          results: [
            {
              status:
                title.startsWith("external continuation") ||
                title.startsWith("Search V2 UI pagination")
                  ? "skipped"
                  : "passed",
            },
          ],
        },
      ],
    }));
    const input = join(directory, "input.json");
    const output = join(directory, "report.json");
    const execute = () =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/authenticatedAcceptanceReport.ts",
          "final",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ACCEPTANCE_PLAYWRIGHT_RESULTS: input,
            ACCEPTANCE_REPORT_PATH: output,
            ACCEPTANCE_EXTERNAL_MODE: "disabled",
            ACCEPTANCE_EXTERNAL_PROVIDER_DISABLED: "true",
            ACCEPTANCE_FIXTURE_INSTALLED: "true",
            ACCEPTANCE_FIXTURE_REMOVED: "true",
            ACCEPTANCE_CLEANUP_VERIFIED: "true",
            ACCEPTANCE_IDENTITY_CLEANUP_VERIFIED: "true",
          },
        },
      );
    writeFileSync(input, JSON.stringify({ suites: [{ suites: [{ specs }] }] }));
    const passing = execute();
    assert.equal(passing.status, 0, passing.stderr);
    assert.equal(
      JSON.parse(readFileSync(output, "utf8")).finalDecision,
      "PASS_INTERNAL_ONLY",
    );
    specs[0].tests[0].results[0].status = "failed";
    writeFileSync(input, JSON.stringify({ suites: [{ suites: [{ specs }] }] }));
    assert.equal(execute().status, 1);
    assert.equal(JSON.parse(readFileSync(output, "utf8")).testCount, 16);
    writeFileSync(input, "{}");
    assert.equal(
      execute().status,
      1,
      "Missing test results must block acceptance",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log(
    "Acceptance harness: nested reports and bounded readiness contracts passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
