import Module from "node:module";

async function main() {
  const runtime = Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };
  const [{ fetchCandidateSource }, { dedupeCandidateSearchV2Documents }, { detectSearchV2UnifiedIntent, canonicalLookupMatches, identityOnlyCandidateProjection }, { searchCanonicalCandidatesByIntent }, { canonicalTalentSearchIdentity }] = await Promise.all([
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/searchV2UnifiedIntent"),
    import("../lib/candidateSearchV2Engine"),
    import("../lib/talentSearchDisplay"),
  ]);
  const dataset = await fetchCandidateSource();
  const canonical = dedupeCandidateSearchV2Documents(dataset.documents).documents;
  const queries = ["Indra Permana", "Teck Chiewlim", "Gunawan Lie", "#A8CCB8", "Gunawan", "Indra Permana SAP FICO implementation"];
  const results = queries.map((query) => {
    const started = performance.now(), intent = detectSearchV2UnifiedIntent(query);
    const identityOnly = intent.type === "candidate_name_lookup" || intent.type === "identity_token_lookup";
    const matches = identityOnly
      ? canonicalLookupMatches(canonical, intent).map(({ document }) => identityOnlyCandidateProjection(document))
      : searchCanonicalCandidatesByIntent(canonical, { query, minimumScore: 50, pageSize: 20 }, intent);
    return {
      query,
      intent: intent.type,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
      count: matches.length,
      candidates: matches.slice(0, 5).map((candidate) => ({
        name: candidate.candidateName || "Name unavailable",
        identityToken: canonicalTalentSearchIdentity(candidate.candidateId).identityToken,
        title: candidate.currentTitle || "Role not established from source",
        evaluationMode: identityOnly ? "identity_only" : "named_candidate_evaluation",
        score: "overallMatchScore" in candidate ? candidate.overallMatchScore : null,
        requirementCoveragePercent: "requiredCoveragePercent" in candidate ? candidate.requiredCoveragePercent : null,
        evidenceConfidencePercent: "evidenceConfidencePercent" in candidate ? candidate.evidenceConfidencePercent : null,
        profileDataConfidencePercent: "profileDataConfidencePercent" in candidate ? candidate.profileDataConfidencePercent : null,
      })),
    };
  });
  console.log(JSON.stringify({ sourceRows: dataset.sourceRows, canonicalPeople: canonical.length, results }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
