import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Module from "node:module";
import { SEARCH_V2_VERSION } from "../lib/searchV2Shared";

type GoldenRow = {
  token: string;
  name: string | null;
  score: number;
  bucket: string;
  direct: number;
  adjacent: number;
  unsupported: number;
  criterionScore: number;
};

async function main() {
  const runtime = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = runtime._load;
  runtime._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return original.call(this, request, parent, isMain);
  };

  const goldenVersion = SEARCH_V2_VERSION.includes("v72")
    ? "v72"
    : SEARCH_V2_VERSION.includes("v71")
      ? "v71"
      : SEARCH_V2_VERSION.includes("v70")
        ? "v70"
        : SEARCH_V2_VERSION.includes("v67")
          ? "v67"
          : SEARCH_V2_VERSION.includes("v66")
            ? "v66"
            : SEARCH_V2_VERSION.includes("v65")
              ? "v65"
              : SEARCH_V2_VERSION.includes("v64")
                ? "v64"
                : "v63";
  const golden = JSON.parse(
    await readFile(
      new URL(
        `../data/search-v2-${goldenVersion}-sap-fico-golden.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    datasetRevision: string;
    sourceRows: number;
    canonicalPeople: number;
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
    requiredFilterPopulation: number;
    visiblePopulation: number;
    buckets: { strong: number; good: number; potential: number };
    results: GoldenRow[];
    compoundImplementation: {
      query: string;
      visiblePopulation: number;
      buckets: { strong: number; good: number; potential: number };
      indra: {
        token: string;
        score: number;
        qualifyingImplementationAssignments: number;
      };
    };
  };
  const [
    { fetchCandidateSource },
    { dedupeCandidateSearchV2Documents },
    { rankCandidatesV2 },
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
  assert.equal(
    dataset.revision,
    golden.datasetRevision,
    "raw snapshot revision drift must be reviewed and re-baselined explicitly",
  );
  assert.equal(dataset.sourceRows, golden.sourceRows);
  assert.equal(dedupe.documents.length, golden.canonicalPeople);

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
  const profile = buildSearchExecutionProfile(request, {
    datasetRevision: dataset.revision,
    authorizationScopeHash: `${goldenVersion}-golden-regression`,
  });
  const visible = visibleSearchV2Results(eligible, profile);
  const bucketCounts = { strong: 0, good: 0, potential: 0 };
  const actual = visible.map((result): GoldenRow => {
    if (result.matchLabel === "Strong Match") bucketCounts.strong += 1;
    else if (result.matchLabel === "Good Match") bucketCounts.good += 1;
    else bucketCounts.potential += 1;
    const assignmentEvidence =
      result.criteriaDiagnostic?.criteria[0]?.assignmentEvidence;
    return {
      token: canonicalTalentSearchIdentity(result.candidateId).identityToken,
      name: result.candidateName ?? null,
      score: result.rankingScore ?? -1,
      bucket: result.matchLabel ?? "",
      direct: assignmentEvidence?.directTargetAssignments ?? 0,
      adjacent: assignmentEvidence?.adjacentAssignments ?? 0,
      unsupported: assignmentEvidence?.unsupportedAssignments ?? 0,
      criterionScore: result.criteriaDiagnostic?.criteria[0]?.score ?? 0,
    };
  });
  assert.equal(profile.matchQuality, "relevant");
  assert.equal(profile.includeRelocationRemote, false);
  assert.equal(eligible.length, golden.requiredFilterPopulation);
  assert.equal(visible.length, golden.visiblePopulation);
  assert.deepEqual(bucketCounts, golden.buckets);
  assert.deepEqual(
    actual,
    golden.results,
    `ordered ${goldenVersion} result or evidence-classification drift requires an explained golden update`,
  );

  for (const result of visible) {
    const document = dedupe.documents.find(
      (item) => item.candidateId === result.candidateId,
    );
    assert.ok(document);
    const classified = targetModuleDeliveryEvidence(document, "FICO");
    assert.equal(
      classified.totalGroundedProjects,
      classified.directTargetAssignments.length +
        classified.adjacentAssignments.length +
        classified.unsupportedAssignments.length,
    );
    assert.equal(
      new Set(
        classified.directTargetAssignments.map((item) => item.assignmentId),
      ).size,
      classified.directTargetAssignments.length,
    );
    for (const assignment of classified.directTargetAssignments) {
      assert.equal(assignment.classification, "direct");
      assert.equal(assignment.reasonCode, "direct_target_delivery");
      assert.ok(assignment.assignmentId);
      assert.equal(
        assignment.evidence.sourceRecordId,
        document.sourceRecordId || document.candidateId,
      );
      assert.match(assignment.evidence.sourceField, /project|assignment/i);
      assert.doesNotMatch(
        assignment.evidence.sourceField,
        /employment|headline|summary|skills/i,
      );
      assert.ok(
        assignment.lifecycleEvidence.every(
          (item) => item.projectId === assignment.assignmentId,
        ),
      );
      const assignmentText = assignment.lifecycleEvidence
        .map((item) => item.excerpt)
        .join(" ");
      assert.match(
        assignmentText,
        /\b(?:fi\s*[/&-]\s*co|fico|sap\s+fi|sap\s+co|general ledger|accounts payable|accounts receivable|asset accounting|financial closing|cost center accounting|profit center accounting)\b/i,
        `${canonicalTalentSearchIdentity(result.candidateId).identityToken} direct assignment lacks assignment-scoped FICO evidence`,
      );
      assert.match(
        assignmentText,
        /\b(?:consultant|analyst|lead|specialist|implement|configur|conversion|migrat|test|cutover|go[ -]?live|rollout|support|enhanc|manage|review|process design|deliver|ownership)\w*\b/i,
        `${canonicalTalentSearchIdentity(result.candidateId).identityToken} direct assignment lacks assignment-scoped role or delivery evidence`,
      );
      assert.doesNotMatch(
        assignmentText,
        /^\s*(?:profile|professional summary|skills|technical skills)\b/i,
      );
    }
  }

  const exactIntent = detectSearchV2UnifiedIntent(
    golden.compoundImplementation.query,
  );
  const compound = rankCandidatesV2(
    dedupe.documents,
    {
      query: exactIntent.evaluationQuery || golden.compoundImplementation.query,
      talentPool: "internal_profiles",
      minimumScore: 50,
      pageSize: 1000,
      criteria: [
        {
          id: golden.criterion.id,
          label: "Demonstrated SAP FICO implementation depth",
          conceptId: "FICO",
          importance: "important",
          source: "query",
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
  assert.equal(
    compound.length,
    golden.compoundImplementation.visiblePopulation,
  );
  assert.deepEqual(compoundBuckets, golden.compoundImplementation.buckets);
  const indra = compound.find(
    (item) =>
      canonicalTalentSearchIdentity(item.candidateId).identityToken ===
      golden.compoundImplementation.indra.token,
  );
  assert.ok(indra);
  assert.equal(indra.rankingScore, golden.compoundImplementation.indra.score);
  assert.equal(
    indra.criteriaDiagnostic?.criteria[0]?.assignmentEvidence
      ?.directTargetLifecycleAssignments,
    golden.compoundImplementation.indra.qualifyingImplementationAssignments,
  );

  console.log(
    `Search V2 ${goldenVersion} SAP FICO golden baseline and provenance audit passed.`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
