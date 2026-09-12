import assert from "node:assert/strict";
import Module from "node:module";
import { performance } from "node:perf_hooks";

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };
  const {
    loadSearchV2CandidateDetail,
    clearSearchV2CandidateDetailCacheForTests,
  } = await import("../lib/searchV2CandidateDetailCache");
  const { loadCandidate360Profile } = await import("../lib/candidate360Data");
  const candidateId = "8377d697-b52d-4d8f-ab49-8749f7fd1174";
  const stageTimings = {
    sourceRowRetrievalMs: 0,
    normalizationMs: 0,
    presentationNormalizationMs: 0,
    supportArtifactMs: 0,
    supportLookupMs: 0,
    profileConstructionMs: 0,
    identityProjectionMs: 0,
    responseSerializationMs: 0,
    sourceBytes: 0,
    totalMs: 0,
  };
  const instrumented = await loadCandidate360Profile(candidateId, stageTimings);
  assert(instrumented, "instrumented #FD1174 detail must resolve");
  const samples: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    clearSearchV2CandidateDetailCacheForTests();
    const started = performance.now();
    const result = await loadSearchV2CandidateDetail(candidateId);
    samples.push(performance.now() - started);
    assert(result.profile, "#FD1174 detail must resolve");
    assert.equal(
      result.profile.enterpriseProfile?.employmentTimeline.length,
      0,
    );
    assert.equal(result.profile.enterpriseProfile?.projects.length, 1);
  }
  const maximum = Math.max(...samples);
  assert(
    maximum < 5000,
    `#FD1174 cold detail exceeded 5s regression ceiling: ${maximum.toFixed(1)}ms`,
  );
  console.log(
    JSON.stringify({
      candidate: "#FD1174",
      stageTimings: Object.fromEntries(
        Object.entries(stageTimings).map(([key, value]) => [
          key,
          Number(value.toFixed(1)),
        ]),
      ),
      samplesMs: samples.map((value) => Number(value.toFixed(1))),
      maximumMs: Number(maximum.toFixed(1)),
    }),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
