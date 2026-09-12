import assert from "node:assert/strict";
import Module from "node:module";
import type { Candidate360Profile } from "../lib/candidate360Types";

const runtime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const original = runtime._load;
runtime._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return original.call(this, request, parent, isMain);
};

async function main() {
  const {
    clearSearchV2CandidateDetailCacheForTests,
    loadSearchV2CandidateDetail,
    SEARCH_V2_CANDIDATE_DETAIL_CACHE_VERSION,
  } = await import("../lib/searchV2CandidateDetailCache");

  clearSearchV2CandidateDetailCacheForTests();
  let loads = 0;
  const profile = {
    candidateId: "cache-privacy-candidate",
  } as Candidate360Profile;
  const loader = async () => {
    loads += 1;
    return profile;
  };

  const recruiterCold = await loadSearchV2CandidateDetail(
    profile.candidateId,
    "recruiter",
    loader,
  );
  const recruiterWarm = await loadSearchV2CandidateDetail(
    profile.candidateId,
    "recruiter",
    loader,
  );
  const debugCold = await loadSearchV2CandidateDetail(
    profile.candidateId,
    "technical_debug",
    loader,
  );
  const debugWarm = await loadSearchV2CandidateDetail(
    profile.candidateId,
    "technical_debug",
    loader,
  );

  assert.equal(recruiterCold.cacheHit, false);
  assert.equal(recruiterWarm.cacheHit, true);
  assert.equal(debugCold.cacheHit, false);
  assert.equal(debugWarm.cacheHit, true);
  assert.equal(
    loads,
    2,
    "recruiter and debug scopes use isolated cache entries",
  );
  assert.match(SEARCH_V2_CANDIDATE_DETAIL_CACHE_VERSION, /v11/);

  console.log(
    "Search V2 candidate-detail permission-scoped cache tests passed.",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
