import Module from "node:module";

const normalizedName = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function main() {
  const moduleRuntime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleRuntime._load;
  moduleRuntime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const [{ dedupeCandidateSearchV2Documents }, { rankCandidatesV2 }, { fetchCandidateSource }, execution, match, display] = await Promise.all([
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidateSearchV2Engine"),
    import("../lib/searchV2Dataset"),
    import("../lib/searchV2ExecutionProfile"),
    import("../lib/searchV2Match"),
    import("../lib/talentSearchDisplay"),
  ]);
  const { buildSearchExecutionProfile, executionProfileRequest, visibleSearchV2Results } = execution;
  const { canonicalMatchLabel } = match;
  const dataset = await fetchCandidateSource();
  const dedupe = dedupeCandidateSearchV2Documents(dataset.documents);
  const profile = buildSearchExecutionProfile(
    {
      query: "SAP FICO",
      talentPool: "internal_profiles",
      matchQuality: "relevant",
      minimumScore: 50,
      page: 1,
      pageSize: 20,
      criteria: [
        {
          id: "criterion:depth:fico",
          label: "Demonstrated SAP FICO delivery depth",
          conceptId: "FICO",
          importance: "important",
          source: "query",
        },
      ],
    },
    { datasetRevision: dataset.revision, authorizationScopeHash: "audit" },
  );
  const request = executionProfileRequest(profile, 1, 20);
  const eligible = rankCandidatesV2(
    dedupe.documents,
    { ...request, minimumScore: 0 },
    undefined,
    true,
  );
  const visible = visibleSearchV2Results(eligible, profile);
  const duplicateGroups = dedupe.documents
    .filter((document) => (document.sourceCandidateIds?.length || 0) > 1)
    .map((document) => ({
      displayName: document.candidateName || "Name unavailable",
      sources: document.sourceCandidateIds?.length || 0,
    }));
  const duplicateReasonCounts = dedupe.duplicateGroupDetails.reduce(
    (counts, group) => {
      const rows = dataset.documents.filter((document) => group.candidateIds.includes(document.candidateId));
      const repeated = (field: "verifiedEmailHash" | "verifiedPhoneHash" | "sourceDocumentHash") => {
        const values = rows.map((row) => row.identitySignals?.[field]).filter(Boolean);
        return values.length > new Set(values).size;
      };
      if (repeated("verifiedEmailHash") || repeated("verifiedPhoneHash") || repeated("sourceDocumentHash")) counts.exactIdentityGroups += 1;
      else counts.compositeProvenanceGroups += 1;
      return counts;
    },
    { exactIdentityGroups: 0, compositeProvenanceGroups: 0 },
  );
  const remainingSameNameGroups = [...Map.groupBy(
    dedupe.documents.filter((document) => normalizedName(document.candidateName)),
    (document) => normalizedName(document.candidateName),
  )]
    .filter(([, documents]) => documents.length > 1)
    .map(([, documents]) => ({
      displayName: documents[0]?.candidateName || "Name unavailable",
      candidates: documents.length,
    }));
  const fixtureNames = new Set([
    "lim li chyi",
    "md husaimi abd wahab",
    "micaela joyce oledan",
    "syed s",
    "violeta manuel alfaro",
    "teck chiewlim",
    "gunawan lie",
    "weir minerals march",
    "indra permana",
  ]);
  const fixtureResults = eligible
    .filter((result) => fixtureNames.has(normalizedName(result.candidateName)) || display.canonicalTalentSearchIdentity(result.candidateId).identityToken === "#A8CCB8" || /SAP PS Team Lead/i.test(result.currentTitle || ""))
    .map((result) => ({
      name: result.candidateName || "Name unavailable",
      identityToken: display.canonicalTalentSearchIdentity(result.candidateId).identityToken,
      title: result.currentTitle,
      score: Number(result.overallMatchScore || 0),
      bucket: canonicalMatchLabel(Number(result.overallMatchScore || 0)),
      projects: result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence || null,
      sourceRecords: result.sourceCandidateIds?.length || 1,
    }));
  const buckets = Object.fromEntries(
    ["Strong Match", "Good Match", "Potential Match"].map((bucket) => [
      bucket,
      visible.filter((result) => canonicalMatchLabel(Number(result.overallMatchScore || 0)) === bucket).length,
    ]),
  );
  console.log(JSON.stringify({
    sourceRows: dataset.sourceRows,
    projectedRows: dataset.documents.length,
    canonicalPeople: dedupe.uniqueCanonicalCandidates,
    duplicatePersonGroups: dedupe.duplicateGroups,
    duplicateRowsCollapsed: dedupe.duplicateRowsCollapsed,
    duplicateReasonCounts,
    duplicateGroups,
    remainingSameNameGroups,
    requiredFilterEligible: eligible.length,
    matchingAboveThreshold: visible.length,
    buckets,
    fixtureResults,
    descending: visible.every((result, index) =>
      index === 0 || Number(visible[index - 1]!.overallMatchScore || 0) >= Number(result.overallMatchScore || 0)),
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
