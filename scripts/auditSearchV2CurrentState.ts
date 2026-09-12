import Module from "node:module";

async function main() {
  const runtime = Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };
  const [
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { rankCandidatesV2, searchCanonicalCandidatesByIntent },
    { buildSearchExecutionProfile, visibleSearchV2Results },
    { detectSearchV2UnifiedIntent },
    { canonicalTalentSearchIdentity },
    { targetModuleDeliveryEvidence },
  ] = await Promise.all([
    import("../lib/searchV2Dataset"),
    import("../lib/candidateSearchV2Projection"),
    import("../lib/candidateSearchV2Engine"),
    import("../lib/searchV2ExecutionProfile"),
    import("../lib/searchV2UnifiedIntent"),
    import("../lib/talentSearchDisplay"),
    import("../lib/searchV2Lifecycle"),
  ]);
  const dataset = await fetchCandidateSource();
  const dedupe = dedupeCandidateSearchV2Documents(dataset.documents);
  const request = {
    query: "SAP FICO",
    talentPool: "internal_profiles" as const,
    filters: { sapModules: ["FICO"] },
    criteria: [{
      id: "criterion:depth:fico",
      label: "Demonstrated SAP FICO delivery depth",
      conceptId: "FICO",
      importance: "important" as const,
      source: "query" as const,
    }],
    minimumScore: 50,
    page: 1,
    pageSize: 20,
  };
  const eligible = rankCandidatesV2(dedupe.documents, { ...request, minimumScore: 0 });
  const profile = buildSearchExecutionProfile(request, {
    datasetRevision: dataset.revision,
    authorizationScopeHash: "local-audit",
  });
  const visible = visibleSearchV2Results(eligible, profile);
  const buckets = { strong: 0, good: 0, potential: 0 };
  for (const result of visible) {
    if (result.matchLabel === "Strong Match") buckets.strong += 1;
    else if (result.matchLabel === "Good Match") buckets.good += 1;
    else buckets.potential += 1;
  }
  const hybridIntent = detectSearchV2UnifiedIntent("Indra Permana SAP FICO implementation");
  const hybrid = searchCanonicalCandidatesByIntent(
    dedupe.documents,
    {
      query: hybridIntent.evaluationQuery,
      minimumScore: 0,
      pageSize: 20,
      criteria: [{
        id: "criterion:depth:fico",
        label: "Demonstrated SAP FICO implementation depth",
        conceptId: "FICO",
        importance: "important",
        source: "query",
      }],
    },
    hybridIntent,
  )[0];
  const exactQuery = "SAP FICO Consultant with implementation experience";
  const exactIntent = detectSearchV2UnifiedIntent(exactQuery);
  const exactResults = rankCandidatesV2(
    dedupe.documents,
    {
      query: exactIntent.evaluationQuery || exactQuery,
      talentPool: "internal_profiles",
      minimumScore: 50,
      pageSize: 1000,
      criteria: [{
        id: "criterion:depth:fico",
        label: "Demonstrated SAP FICO implementation depth",
        conceptId: "FICO",
        importance: "important",
        source: "query",
      }],
    },
    undefined,
    true,
  );
  const exactBuckets = { strong: 0, good: 0, potential: 0 };
  for (const result of exactResults) {
    if (result.matchLabel === "Strong Match") exactBuckets.strong += 1;
    else if (result.matchLabel === "Good Match") exactBuckets.good += 1;
    else exactBuckets.potential += 1;
  }
  const fixtures = ["Indra Permana", "Teck Chiewlim", "Gunawan Lie"]
    .flatMap((name) => eligible.filter((item) => item.candidateName === name).slice(0, 1))
    .map((result) => ({
      name: result.candidateName,
      token: canonicalTalentSearchIdentity(result.candidateId).identityToken,
      score: result.rankingScore,
      bucket: result.matchLabel,
      direct: result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetAssignments ?? 0,
      lifecycleQualifiedDirect: result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetLifecycleAssignments ?? 0,
      adjacent: result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.adjacentAssignments ?? 0,
      unsupported: result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.unsupportedAssignments ?? 0,
      criterionScore: result.criteriaDiagnostic?.criteria[0]?.score ?? 0,
    }));
  const stable = eligible.find((item) => canonicalTalentSearchIdentity(item.candidateId).identityToken === "#A8CCB8");
  const selectedAssignmentAudits = ["#C551A3", "#0BD318"].map((token) => {
    const document = dedupe.documents.find((item) => canonicalTalentSearchIdentity(item.candidateId).identityToken === token);
    return {
      token,
      assignments: document ? targetModuleDeliveryEvidence(document, "FICO") : null,
    };
  });
  console.log(JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    datasetRevision: dataset.revision,
    request,
    executionProfile: profile,
    rawSourceRows: dataset.sourceRows,
    indexedRows: dataset.documents.length,
    canonicalPeople: dedupe.documents.length,
    duplicateGroups: dedupe.duplicateGroups,
    duplicateRowsCollapsed: dedupe.duplicateRowsCollapsed,
    basicFico: {
      requiredFilterPopulation: eligible.length,
      visible: visible.length,
      buckets,
      results: visible.map((item) => ({
        id: item.candidateId,
        token: canonicalTalentSearchIdentity(item.candidateId).identityToken,
        name: item.candidateName,
        score: item.rankingScore,
        bucket: item.matchLabel,
        direct: item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetAssignments ?? 0,
        lifecycleQualifiedDirect: item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetLifecycleAssignments ?? 0,
        adjacent: item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.adjacentAssignments ?? 0,
        unsupported: item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.unsupportedAssignments ?? 0,
        criterionScore: item.criteriaDiagnostic?.criteria[0]?.score ?? 0,
        scoreBreakdown: item.score,
      })),
    },
    selectedAssignmentAudits,
    fixtures: [...fixtures, ...(stable ? [{
      name: stable.candidateName || "Name unavailable",
      token: canonicalTalentSearchIdentity(stable.candidateId).identityToken,
      score: stable.rankingScore,
      bucket: stable.matchLabel,
      direct: stable.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetAssignments ?? 0,
      lifecycleQualifiedDirect: stable.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetLifecycleAssignments ?? 0,
      adjacent: stable.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.adjacentAssignments ?? 0,
      unsupported: stable.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.unsupportedAssignments ?? 0,
      criterionScore: stable.criteriaDiagnostic?.criteria[0]?.score ?? 0,
    }] : [])],
    hybridIndra: hybrid ? {
      score: hybrid.rankingScore,
      bucket: hybrid.matchLabel,
      requirementCoveragePercent: hybrid.requiredCoveragePercent,
      evidenceConfidencePercent: hybrid.evidenceConfidencePercent,
      direct: hybrid.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetAssignments ?? 0,
      lifecycleQualifiedDirect: hybrid.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetLifecycleAssignments ?? 0,
      adjacent: hybrid.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.adjacentAssignments ?? 0,
      unsupported: hybrid.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.unsupportedAssignments ?? 0,
      criterionScore: hybrid.criteriaDiagnostic?.criteria[0]?.score ?? 0,
    } : null,
    exactImplementationQuery: {
      count: exactResults.length,
      buckets: exactBuckets,
      results: exactResults.map((item) => ({
        name: item.candidateName,
        score: item.rankingScore,
        bucket: item.matchLabel,
        requirementCoveragePercent: item.requiredCoveragePercent,
        directImplementationAssignments: item.criteriaDiagnostic?.criteria[0]?.assignmentEvidence?.directTargetLifecycleAssignments ?? 0,
      })),
    },
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
