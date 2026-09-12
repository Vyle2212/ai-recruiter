import assert from "node:assert/strict";
import Module from "node:module";

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };

  const [
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    intent,
  ] = await Promise.all([
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/searchV2UnifiedIntent"),
  ]);
  const dataset = await fetchCandidateSource();
  const documents = dedupeCandidateSearchV2Documents(
    dataset.documents,
  ).documents;

  const resolve = (query: string) => {
    const detected = intent.detectSearchV2UnifiedIntent(query);
    const confirmed = intent.confirmSearchV2IdentityIntent(
      documents,
      query,
      detected,
    );
    return {
      confirmed,
      matches: intent.canonicalLookupMatches(documents, confirmed),
    };
  };

  const clean = resolve("Gunawan Lie");
  assert.equal(clean.confirmed.type, "candidate_name_lookup");
  assert.equal(clean.matches.length, 1);
  assert.equal(clean.matches[0].document.candidateName, "Gunawan Lie");
  assert.equal(clean.matches[0].document.talentPool, "internal_profiles");

  for (const query of [
    "Gunawan Lie:",
    "Gunawan Lie:.",
    "Gunawan Lie::",
    "Gunawan Lie...",
    "Gunawan Lie!!!",
    "Gunawan Lie?!",
    "Gunawan Lie:;,.",
    "Gunawan Lie : .",
    '"Gunawan Lie:"',
    '("Gunawan Lie:.")',
    "Gunawan Lie:\u200b.\u200b",
    '"Gunawan Lie"',
    "Candidate: Gunawan Lie",
    "🔎 Gunawan Lie",
  ]) {
    const actual = resolve(query);
    assert.deepEqual(actual.confirmed, clean.confirmed, query);
    assert.deepEqual(
      actual.matches.map((match) => [
        match.document.candidateId,
        match.matchRank,
      ]),
      clean.matches.map((match) => [
        match.document.candidateId,
        match.matchRank,
      ]),
      query,
    );
    assert.deepEqual(
      intent.identityOnlyCandidateProjection(
        actual.matches[0].document,
        "exact",
      ),
      intent.identityOnlyCandidateProjection(
        clean.matches[0].document,
        "exact",
      ),
      `${query} keeps the same scoreless exact-profile projection`,
    );
  }

  console.log(
    "Search V2 real-dataset punctuation identity equivalence tests passed.",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
