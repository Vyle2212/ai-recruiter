import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const [
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { rankCandidatesV2 },
    { buildSearchExecutionProfile, visibleSearchV2Results },
    { detectSearchV2UnifiedIntent },
    { canonicalTalentSearchIdentity },
  ] = await Promise.all([
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidateSearchV2Engine"),
    import("../lib/searchV2ExecutionProfile"),
    import("../lib/searchV2UnifiedIntent"),
    import("../lib/talentSearchDisplay"),
  ]);
  const dataset = await fetchCandidateSource();
  const documents = dedupeCandidateSearchV2Documents(
    dataset.documents,
  ).documents;
  const criterion = {
    id: "criterion:depth:fico",
    label: "Demonstrated SAP FICO delivery depth",
    conceptId: "FICO",
    importance: "important" as const,
  };
  const request = {
    query: "SAP FICO",
    talentPool: "internal_profiles" as const,
    filters: { sapModules: ["FICO"] },
    criteria: [{ ...criterion, source: "query" as const }],
    minimumScore: 50,
    includeRelocationRemote: false,
    page: 1,
    pageSize: 20,
  };
  const eligible = rankCandidatesV2(documents, { ...request, minimumScore: 0 });
  const execution = buildSearchExecutionProfile(request, {
    datasetRevision: dataset.revision,
    authorizationScopeHash: "v72-golden-regression",
  });
  const visible = visibleSearchV2Results(eligible, execution);
  const buckets = { strong: 0, good: 0, potential: 0 };
  const results = visible.map((result) => {
    if (result.matchLabel === "Strong Match") buckets.strong += 1;
    else if (result.matchLabel === "Good Match") buckets.good += 1;
    else buckets.potential += 1;
    const evidence = result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence;
    return {
      token: canonicalTalentSearchIdentity(result.candidateId).identityToken,
      name: result.candidateName ?? null,
      score: result.rankingScore ?? -1,
      bucket: result.matchLabel ?? "",
      direct: evidence?.directTargetAssignments ?? 0,
      adjacent: evidence?.adjacentAssignments ?? 0,
      unsupported: evidence?.unsupportedAssignments ?? 0,
      criterionScore: result.criteriaDiagnostic?.criteria[0]?.score ?? 0,
    };
  });
  const compoundQuery = "SAP FICO Consultant with implementation experience";
  const intent = detectSearchV2UnifiedIntent(compoundQuery);
  const compound = rankCandidatesV2(
    documents,
    {
      query: intent.evaluationQuery || compoundQuery,
      talentPool: "internal_profiles",
      minimumScore: 50,
      pageSize: 1000,
      criteria: [
        {
          ...criterion,
          label: "Demonstrated SAP FICO implementation depth",
          source: "query" as const,
        },
      ],
    },
    undefined,
    true,
  );
  const compoundBuckets = { strong: 0, good: 0, potential: 0 };
  for (const result of compound) {
    if (result.matchLabel === "Strong Match") compoundBuckets.strong += 1;
    else if (result.matchLabel === "Good Match") compoundBuckets.good += 1;
    else compoundBuckets.potential += 1;
  }
  const indra = compound.find(
    (item) =>
      canonicalTalentSearchIdentity(item.candidateId).identityToken ===
      "#757B32",
  );
  const output = {
    fixtureVersion:
      "search-v2-v72-sap-fico-golden-v1-project-identity-separation",
    evaluatedAt: "2026-09-09T00:00:00.000Z",
    datasetRevision: dataset.revision,
    sourceRows: dataset.sourceRows,
    canonicalPeople: documents.length,
    query: request.query,
    matchQuality: execution.matchQuality,
    talentPool: request.talentPool,
    includeRelocationRemote: request.includeRelocationRemote,
    minimumScore: request.minimumScore,
    filters: request.filters,
    criterion,
    requiredFilterPopulation: eligible.length,
    visiblePopulation: visible.length,
    buckets,
    results,
    compoundImplementation: {
      query: compoundQuery,
      visiblePopulation: compound.length,
      buckets: compoundBuckets,
      candidates: compound.map((item) => ({
        token: canonicalTalentSearchIdentity(item.candidateId).identityToken,
        score: item.rankingScore,
        bucket: item.matchLabel,
        lifecycleAssignments:
          item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence
            ?.directTargetLifecycleAssignments ?? 0,
      })),
      indra: {
        token: "#757B32",
        score: indra?.rankingScore ?? -1,
        qualifyingImplementationAssignments:
          indra?.criteriaDiagnostic?.criteria[0]?.assignmentEvidence
            ?.directTargetLifecycleAssignments ?? 0,
      },
    },
  };
  const destination = path.join("data", "search-v2-v72-sap-fico-golden.json");
  fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ destination, ...output }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
