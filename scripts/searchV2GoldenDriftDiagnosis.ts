import { readFile } from "node:fs/promises";
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
  const golden = JSON.parse(
    await readFile(
      new URL("../data/search-v2-v63-sap-fico-golden.json", import.meta.url),
      "utf8",
    ),
  ) as {
    datasetRevision: string;
    sourceRows: number;
    query: string;
    minimumScore: number;
    includeRelocationRemote: boolean;
    filters: { sapModules: string[] };
    criterion: {
      id: string;
      label: string;
      conceptId: string;
      importance: "important";
    };
    results: Array<{ token: string; score: number }>;
  };
  const [
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { rankCandidatesV2 },
    { buildSearchExecutionProfile, visibleSearchV2Results },
    { canonicalTalentSearchIdentity },
  ] = await Promise.all([
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidateSearchV2Engine"),
    import("../lib/searchV2ExecutionProfile"),
    import("../lib/talentSearchDisplay"),
  ]);
  const dataset = await fetchCandidateSource();
  const dedupe = dedupeCandidateSearchV2Documents(dataset.documents);
  const request = {
    query: golden.query,
    talentPool: "internal_profiles" as const,
    filters: golden.filters,
    criteria: [{ ...golden.criterion, source: "query" as const }],
    minimumScore: golden.minimumScore,
    includeRelocationRemote: golden.includeRelocationRemote,
    page: 1,
    pageSize: 20,
  };
  const eligible = rankCandidatesV2(dedupe.documents, {
    ...request,
    minimumScore: 0,
  });
  const visible = visibleSearchV2Results(
    eligible,
    buildSearchExecutionProfile(request, {
      datasetRevision: dataset.revision,
      authorizationScopeHash: "golden-drift-diagnosis",
    }),
  );
  const current = new Map(
    visible.map((result) => [
      canonicalTalentSearchIdentity(result.candidateId).identityToken,
      result,
    ]),
  );
  const expected = new Map(
    golden.results.map((result) => [result.token, result]),
  );
  const missing = golden.results
    .filter((result) => !current.has(result.token))
    .map((result) => {
      const document = dedupe.documents.find(
        (item) =>
          canonicalTalentSearchIdentity(item.candidateId).identityToken ===
          result.token,
      );
      const ranked = eligible.find(
        (item) =>
          canonicalTalentSearchIdentity(item.candidateId).identityToken ===
          result.token,
      );
      return {
        token: result.token,
        expectedScore: result.score,
        presentAfterNormalization: Boolean(document),
        eligibleBeforeVisibility: Boolean(ranked),
        currentScore: ranked?.rankingScore ?? null,
        classification: !document
          ? "source_or_normalization_drift"
          : !ranked
            ? "eligibility_drift"
            : "scoring_or_visibility_drift",
      };
    });
  const added = [...current.keys()].filter((token) => !expected.has(token));
  console.log(
    JSON.stringify(
      {
        fixtureRevision: golden.datasetRevision,
        currentRevision: dataset.revision,
        sourceRowsExpected: golden.sourceRows,
        sourceRowsCurrent: dataset.sourceRows,
        expectedVisible: golden.results.length,
        currentVisible: visible.length,
        missing,
        added,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
