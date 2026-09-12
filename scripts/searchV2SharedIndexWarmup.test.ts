import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { searchV2ReadinessHttpContract } from "../lib/searchV2ReadinessContract";
import { startSearchV2ReadinessPolling } from "../lib/searchV2ReadinessPolling";

async function main() {
  const moduleRuntime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleRuntime._load;
  moduleRuntime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const {
    configureSearchV2ProjectionLifecycleForTest,
    fetchCandidateSource,
    prewarmCandidateSearchV2Dataset,
    searchV2ProjectionReadiness,
  } = await import("../lib/searchV2Dataset");

  const fixture = (revision: string) => ({
    schemaVersion: "synthetic-index-version",
    createdAt: Date.now(),
    revision,
    documents: [],
    sourceRows: 147,
    cacheHit: false,
    retrievalMs: 4,
    sourceEvidenceLoadingMs: 5,
    evidenceProjectionMs: 6,
  });
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };

  const firstBuild = deferred<ReturnType<typeof fixture>>();
  let buildCount = 0;
  configureSearchV2ProjectionLifecycleForTest({
    loader: () => {
      buildCount += 1;
      return firstBuild.promise;
    },
    timeoutMs: 2_000,
  });
  assert.equal(searchV2ProjectionReadiness().status, "cold");
  const first = prewarmCandidateSearchV2Dataset();
  const concurrent = prewarmCandidateSearchV2Dataset();
  assert.strictEqual(first, concurrent);
  assert.equal(buildCount, 1);
  assert.equal(searchV2ProjectionReadiness().status, "warming");
  const warmingHttp = searchV2ReadinessHttpContract(
    searchV2ProjectionReadiness(),
    0,
  );
  assert.equal(warmingHttp.status, 503);
  assert.equal(warmingHttp.headers["Retry-After"], "1");
  assert.equal(warmingHttp.body.error?.code, "SEARCH_INDEX_WARMING");
  assert.notEqual(JSON.stringify(warmingHttp.body), "1");
  firstBuild.resolve(fixture("ready-revision"));
  await Promise.all([first, concurrent]);
  assert.equal(searchV2ProjectionReadiness().status, "ready");
  assert.equal(searchV2ProjectionReadiness().datasetRevision, "ready-revision");
  assert.equal((await fetchCandidateSource()).sourceRows, 147);
  const readyHttp = searchV2ReadinessHttpContract(
    searchV2ProjectionReadiness(),
    147,
  );
  assert.equal(readyHttp.status, 200);
  assert.equal(readyHttp.body.ready, true);
  assert.equal("error" in readyHttp.body, false);

  let retryCount = 0;
  configureSearchV2ProjectionLifecycleForTest({
    loader: async () => {
      retryCount += 1;
      if (retryCount === 1) throw new Error("synthetic database failure");
      return fixture("retried-revision");
    },
    timeoutMs: 2_000,
  });
  await assert.rejects(prewarmCandidateSearchV2Dataset());
  assert.equal(searchV2ProjectionReadiness().status, "failed");
  assert.equal(
    searchV2ProjectionReadiness().errorCode,
    "SEARCH_INDEX_WARM_FAILED",
  );
  await prewarmCandidateSearchV2Dataset();
  assert.equal(retryCount, 2);
  assert.equal(searchV2ProjectionReadiness().status, "ready");

  configureSearchV2ProjectionLifecycleForTest({
    loader: () => new Promise(() => undefined),
    timeoutMs: 10,
  });
  await assert.rejects(
    prewarmCandidateSearchV2Dataset(),
    /SEARCH_INDEX_WARM_TIMEOUT/,
  );
  assert.equal(searchV2ProjectionReadiness().status, "failed");
  assert.equal(
    searchV2ProjectionReadiness().errorCode,
    "SEARCH_INDEX_WARM_TIMEOUT",
  );

  const globalRecord = globalThis as typeof globalThis & {
    __candidateSearchV2IndexLifecycleV1?: { version: string; status: string };
  };
  globalRecord.__candidateSearchV2IndexLifecycleV1 = {
    version: "stale-projection-version",
    status: "warming",
  };
  assert.equal(searchV2ProjectionReadiness().status, "cold");
  assert.notEqual(
    globalRecord.__candidateSearchV2IndexLifecycleV1?.version,
    "stale-projection-version",
  );
  let versionRebuilds = 0;
  configureSearchV2ProjectionLifecycleForTest({
    loader: async () => {
      versionRebuilds += 1;
      return fixture("new-version-revision");
    },
  });
  globalRecord.__candidateSearchV2IndexLifecycleV1 = {
    version: "older-module-version",
    status: "warming",
  };
  const versionFirst = prewarmCandidateSearchV2Dataset();
  const versionConcurrent = prewarmCandidateSearchV2Dataset();
  await Promise.all([versionFirst, versionConcurrent]);
  assert.equal(versionRebuilds, 1);

  let polls = 0;
  let maximumConcurrent = 0;
  let active = 0;
  const states: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("poller did not become ready")),
      500,
    );
    startSearchV2ReadinessPolling({
      backoffMs: [1],
      maxElapsedMs: 400,
      load: async () => {
        active += 1;
        maximumConcurrent = Math.max(maximumConcurrent, active);
        polls += 1;
        await Promise.resolve();
        active -= 1;
        return polls === 1
          ? {
              ready: false,
              status: "warming",
              error: {
                code: "SEARCH_INDEX_WARMING",
                message: "The shared candidate index is preparing.",
                retryable: true,
              },
            }
          : {
              ready: true,
              status: "ready",
              sources: {
                internal_profiles: {
                  available: true,
                  population: 147,
                  reason: null,
                },
              },
            };
      },
      onState: (state) => {
        states.push(state.status);
        if (state.status === "ready") {
          clearTimeout(timeout);
          resolve();
        }
      },
    });
  });
  assert.deepEqual(states, ["warming", "ready"]);
  assert.equal(maximumConcurrent, 1);

  let aborted = false;
  const cancelled = startSearchV2ReadinessPolling({
    load: (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    onState: () => assert.fail("cancelled polling must not publish state"),
  });
  cancelled.stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborted, true);

  let terminalPolls = 0;
  await new Promise<void>((resolve) => {
    startSearchV2ReadinessPolling({
      load: async () => {
        terminalPolls += 1;
        return {
          ready: false,
          status: "failed",
          error: {
            code: "SEARCH_INDEX_WARM_FAILED",
            message: "The shared candidate index could not be prepared.",
            retryable: true,
          },
        };
      },
      onState: (state) => {
        if (state.status === "failed") resolve();
      },
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(terminalPolls, 1);

  const route = readFileSync("app/api/recruiter/search-v2/route.ts", "utf8");
  const client = readFileSync(
    "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
    "utf8",
  );
  assert.ok(
    route.indexOf('source") === "linkedin_talent_pool"') <
      route.indexOf("void prewarmCandidateSearchV2Dataset"),
  );
  assert.match(route, /searchV2ReadinessHttpContract/);
  assert.match(client, /startSearchV2ReadinessPolling/);
  assert.match(client, /return \(\) => polling\.stop\(\)/);
  assert.match(client, /setInternalSearchReady\(true\)/);
  assert.match(client, /onRetryReadiness/);

  configureSearchV2ProjectionLifecycleForTest();
  console.log("Search V2 shared-index warm-up regression tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
