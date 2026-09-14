import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  ExternalCandidate,
  ExternalCandidateSourceProvider,
} from "../lib/externalCandidateSourceProvider";
import { setExternalTalentProviderForTests } from "../lib/externalTalentProviderRegistry";
import { executeExternalTalentSearch } from "../lib/externalTalentSearchService";
import { evaluateExternalCandidate } from "../lib/externalTalentScoring";
import { deterministicExternalSearchPlan } from "../lib/externalTalentSearchPlan";
import { buildCommittedSearchRequirements } from "../lib/searchV2CommittedRequirements";
import { normalizeSearchV2Response } from "../lib/searchV2ResponseContract";
import { sanitizeSearchV2RecruiterResponse } from "../lib/searchV2RecruiterResponse";

const query =
  "SAP FICO consultant in Malaysia with 8+ years and implementation experience";
const request = {
  query,
  talentPool: "linkedin_talent_pool" as const,
  matchQuality: "relevant" as const,
  minimumScore: 50,
  filters: {
    locations: ["Malaysia"],
    minimumTotalYearsExperience: 8,
    deliveryExperience: ["implementation"],
  },
};
const externalCandidate = (
  id: string,
  overrides: Partial<ExternalCandidate> = {},
): ExternalCandidate => ({
  source: "linkedin_talent_pool",
  externalCandidateId: id,
  displayName: id === "amanda" ? "Amanda Ong" : `Candidate ${id}`,
  profileTitle: "SAP FICO Consultant",
  location: "Malaysia",
  skills: ["SAP FICO"],
  employmentText: ["SAP FICO consulting support"],
  projectText: [],
  profileUrl: `https://www.linkedin.com/in/${id}`,
  providerEvidence: [],
  ...overrides,
});
const scoreDistribution = (scores: number[]) => ({
  high_75_to_100: scores.filter((score) => score >= 75).length,
  medium_50_to_74: scores.filter((score) => score >= 50 && score < 75).length,
  low_0_to_49: scores.filter((score) => score < 50).length,
});

async function main() {
  const calls: string[] = [];
  const initial = [
    ...Array.from({ length: 95 }, (_, index) =>
      externalCandidate(index === 0 ? "amanda" : `potential-${index}`),
    ),
    ...Array.from({ length: 5 }, (_, index) =>
      externalCandidate(`excluded-${index}`, { location: "Germany" }),
    ),
  ];
  const second = [
    ...initial.slice(0, 98).map((candidate, index) => ({
      ...candidate,
      profileUrl: `${candidate.profileUrl}?segment=2&position=${index}`,
    })),
    externalCandidate("new-high", {
      totalYearsExperience: 10,
      projectText: ["SAP FICO implementation project delivery"],
    }),
    externalCandidate("new-potential"),
  ];
  const provider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "aggregation-fixture",
        providerName: "Aggregation fixture",
        connected: true,
        ready: true,
        status: "ready",
        reason: null,
        authentication: "valid",
        supportedFilters: ["query"],
        supportsCandidateDetails: false,
        supportsImport: false,
        pagination: "none",
        sandboxAvailable: true,
      };
    },
    async search(providerRequest) {
      calls.push(providerRequest.query);
      return {
        sourceRequestId: `aggregation-batch-${calls.length}`,
        providerResultCount: 100,
        candidates: calls.length === 1 ? initial : second,
      };
    },
  };
  setExternalTalentProviderForTests(provider);
  const context = { authorizationScopeHash: "aggregation-pagination" };
  const first = await executeExternalTalentSearch(request, undefined, context);
  assert.equal(calls.length, 1);
  assert.equal(first.items.length, 20);
  assert.deepEqual(first.poolCounts, {
    evidenceSupported: 0,
    needsVerification: 95,
    confirmedExcluded: 5,
  });
  assert.equal(first.aggregation.providerRecordsFetched, 100);
  assert.equal(first.aggregation.recordsNormalized, 100);
  assert.equal(first.aggregation.uniqueProfiles, 100);
  assert.equal(first.aggregation.currentlyRenderedResults, 20);
  assert.equal(first.aggregation.remainingLoadedResults, 75);
  const result = {
    candidateId: first.items[0].externalCandidateId,
    rankingScore: first.items[0].rankingScore,
    overallMatchScore: first.items[0].rankingScore,
    overallMatchPercent: first.items[0].rankingScore,
    score: { finalScore: first.items[0].rankingScore },
  };
  const responseFixture = {
    provider: "exa",
    aggregation: first.aggregation,
    results: Array.from({ length: 20 }, (_, index) => ({
      ...result,
      candidateId: `rendered-${index}`,
    })),
    request: {
      query,
      mode: "hybrid",
      page: 1,
      pageSize: 20,
      minimumScore: 0,
    },
    summary: {
      totalDocuments: 100,
      totalMatched: 95,
      eligibleTotal: 95,
      visibleTotal: 95,
      verifiedVisible: 0,
      supportedVisible: 0,
      relatedVisible: 0,
      appliedMinimumScore: 0,
      appliedMatchQuality: "relevant",
      returned: 20,
      page: 1,
      pageSize: 20,
    },
  };
  assert.equal(normalizeSearchV2Response(responseFixture).ok, true);
  assert.equal(
    normalizeSearchV2Response({
      ...responseFixture,
      results: responseFixture.results.slice(0, 1),
      aggregation: {
        ...first.aggregation,
        currentlyRenderedResults: 1,
      },
      summary: { ...responseFixture.summary, returned: 1 },
    }).ok,
    false,
    "an under-filled external page must fail the response contract",
  );
  const recruiterSafe = sanitizeSearchV2RecruiterResponse({
    ...responseFixture,
    sourceRequestId: "private-provider-request",
    committedSearchId: "private-search-id",
    externalItems: first.items,
  }) as Record<string, unknown>;
  assert.equal("sourceRequestId" in recruiterSafe, false);
  assert.equal("committedSearchId" in recruiterSafe, false);
  assert.equal("externalItems" in recruiterSafe, false);

  const secondPage = await executeExternalTalentSearch(
    { ...request, page: 2, cursor: first.nextCursor || undefined },
    undefined,
    context,
  );
  assert.equal(calls.length, 1, "pagination must not call the provider");
  assert.equal(secondPage.items.length, 20);
  assert.equal(secondPage.aggregation.remainingLoadedResults, 55);
  const sortedWithoutProviderCall = await executeExternalTalentSearch(
    { ...request, page: 1, externalSort: "most_complete" },
    undefined,
    context,
  );
  assert.equal(calls.length, 1, "changing sort must reuse the loaded snapshot");
  assert.equal(sortedWithoutProviderCall.items.length, 20);
  const initialPages = [first, secondPage];
  for (let page = 3; page <= 5; page += 1)
    initialPages.push(
      await executeExternalTalentSearch(
        { ...request, page },
        undefined,
        context,
      ),
    );
  assert.equal(
    calls.length,
    1,
    "loaded-page traversal must not call the provider",
  );
  const initialScoreDistribution = scoreDistribution(
    initialPages.flatMap((response) =>
      response.items.map((candidate) => candidate.rankingScore),
    ),
  );

  const expanded = await executeExternalTalentSearch(
    {
      ...request,
      page: 2,
      externalBatchCursor: secondPage.nextProviderBatchCursor || undefined,
    },
    undefined,
    context,
  );
  assert.equal(calls.length, 2);
  assert.equal(expanded.aggregation.lastBatch.providerRecordsFetched, 100);
  assert.equal(expanded.aggregation.lastBatch.newUniqueProfiles, 2);
  assert.equal(expanded.aggregation.lastBatch.duplicateRecords, 98);
  assert.equal(expanded.aggregation.uniqueProfiles, 102);
  assert.equal(
    expanded.poolCounts.evidenceSupported +
      expanded.poolCounts.needsVerification +
      expanded.poolCounts.confirmedExcluded,
    102,
  );
  assert.equal(expanded.aggregation.remainingLoadedResults, 57);
  const rerankedFirstPage = await executeExternalTalentSearch(
    request,
    undefined,
    context,
  );
  assert.equal(calls.length, 2);
  assert.equal(rerankedFirstPage.items[0].externalCandidateId, "new-high");
  assert.equal(
    rerankedFirstPage.items[0].requirementEvaluations.find(
      (requirement) => requirement.kind === "lifecycle",
    )?.state,
    "confirmed_pass",
    "assignment-level SAP FICO implementation must be confirmed",
  );
  assert.equal(
    rerankedFirstPage.items.filter(
      (candidate) => candidate.displayName === "Amanda Ong",
    ).length,
    1,
  );
  assert.equal(
    expanded.items.some(
      (candidate) => candidate.externalCandidateId === "new-high",
    ),
    false,
    "market expansion must preserve the requested second page",
  );

  const replay = await executeExternalTalentSearch(
    {
      ...request,
      page: 2,
      externalBatchCursor: secondPage.nextProviderBatchCursor || undefined,
    },
    undefined,
    context,
  );
  assert.equal(calls.length, 2, "replayed cursor must not call the provider");
  assert.equal(replay.aggregation.lastBatch.replayed, true);
  assert.equal(replay.aggregation.uniqueProfiles, 102);

  const committed = buildCommittedSearchRequirements(request);
  assert.deepEqual(
    committed.requirements.map((requirement) => requirement.kind),
    ["target", "location", "experience", "lifecycle"],
  );
  const plan = deterministicExternalSearchPlan(request, committed);
  assert.ok(plan.normalizedRoles.includes("Consultant"));
  const employmentTextOnly = evaluateExternalCandidate(
    {
      ...externalCandidate("employment-only", {
        employmentText: ["Delivered SAP FICO implementation"],
      }),
      source: "external_talent_network",
      skills: ["SAP FICO"],
      providerEvidence: [],
      providerRank: 1,
      provider: "exa",
      profileUrlDomain: "linkedin.com",
      sourceRequestId: "employment-only",
      explanationStatus: "grounded",
      duplicateReviewStatus: "not_reviewed",
    },
    plan,
  );
  const lifecycle = employmentTextOnly.candidate.requirementEvaluations.find(
    (requirement) => requirement.kind === "lifecycle",
  );
  assert.equal(lifecycle?.state, "needs_verification");
  assert.equal(employmentTextOnly.candidate.implementationEvidenceCount, 0);
  assert.equal(
    new Set(
      employmentTextOnly.candidate.requirementEvaluations.map(
        (requirement) => requirement.id,
      ),
    ).size,
    employmentTextOnly.candidate.requirementEvaluations.length,
  );

  const client = readFileSync(
    "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
    "utf8",
  );
  assert.match(client, /data-testid="search-v2-form-layout"/);
  assert.match(client, /minmax\(28rem,1fr\)/);
  assert.match(client, /resize-none overflow-hidden/);
  assert.match(client, /data-testid="external-result-status"/);
  assert.match(client, /data-testid="external-aggregation-progress"/);
  assert.match(client, /data-testid="external-candidate-evidence"/);
  assert.equal(
    (client.match(/aria-label="Search result pages"/g) || []).length,
    1,
  );
  assert.doesNotMatch(client, /Show next/);
  assert.match(client, /Showing \$\{/);
  assert.match(client, /Mapping audit/);
  assert.match(
    readFileSync("lib/externalTalentScoring.ts", "utf8"),
    /external-match-v9-enterprise-evidence-order/,
  );
  assert.match(client, /disabled=\{loading \|\| loadingExternalBatch\}/);
  console.log(
    JSON.stringify(
      {
        initial: first.aggregation,
        secondPage: secondPage.aggregation,
        expanded: expanded.aggregation,
        scoreDistribution: {
          before: initialScoreDistribution,
          afterFirstPage: scoreDistribution(
            rerankedFirstPage.items.map((candidate) => candidate.rankingScore),
          ),
        },
        providerCalls: calls.length,
        requirementPlan: committed.requirements.map((item) => item.label),
      },
      null,
      2,
    ),
  );
  console.log("External aggregation and pagination regressions passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setExternalTalentProviderForTests(null));
