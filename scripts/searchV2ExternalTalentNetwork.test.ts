import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement, type ReactNode } from "react";
import {
  validateExternalProfileUrl,
  externalProfileActionLabel,
} from "../lib/externalProfileUrl";
import {
  deterministicExternalSearchPlan,
  validateExternalSearchPlan,
} from "../lib/externalTalentSearchPlan";
import {
  externalMatchTier,
  evaluateExternalCandidate,
  scoreExternalCandidate,
  sortExternalCandidates,
} from "../lib/externalTalentScoring";
import { normalizeExaPersonResult } from "../lib/exaPeopleSearchProvider";
import {
  externalCanonicalResultProjection,
  externalRejectionSummaryPresentation,
} from "../lib/externalTalentProjection";
import { executeExternalTalentSearch } from "../lib/externalTalentSearchService";
import { setExternalTalentProviderForTests } from "../lib/externalTalentProviderRegistry";
import type { ExternalCandidateSourceProvider } from "../lib/externalCandidateSourceProvider";
import { loadSearchV2SourceReadiness } from "../lib/searchV2SourceReadiness";
import {
  buildExternalSearchV2ClientResponse,
  reconcileSearchV2Response,
  searchV2RenderVisibility,
} from "../lib/searchV2ResponseContract";
import { parseRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";
import {
  CompactCandidateCard,
  displayedRankingScore,
} from "../app/recruiter/talent-search/v2/CandidateSearchV2Client";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

async function main() {
  let internalReadinessCalls = 0;
  let externalCapabilityCalls = 0;
  const internalReadinessNeverResolves = () => {
    internalReadinessCalls += 1;
    return new Promise<boolean>(() => {});
  };
  const externalReadiness = await Promise.race([
    loadSearchV2SourceReadiness({
      talentPool: "linkedin_talent_pool",
      loadInternal: internalReadinessNeverResolves,
      loadExternal: async () => {
        externalCapabilityCalls += 1;
        return {
          available: true,
          connected: true,
          reason: null,
          status: "ready",
        };
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("External readiness waited for SAP Talent Hub")),
        100,
      ),
    ),
  ]);
  assert.equal(externalReadiness.ready, true);
  assert.equal(internalReadinessCalls, 0);
  assert.equal(externalCapabilityCalls, 1);

  let sapReadinessSettled = false;
  void loadSearchV2SourceReadiness({
    talentPool: "internal_profiles",
    loadInternal: internalReadinessNeverResolves,
    loadExternal: async () => {
      throw new Error("SAP Talent Hub must not consult the external provider");
    },
  }).then(() => {
    sapReadinessSettled = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    sapReadinessSettled,
    false,
    "SAP Talent Hub remains protected by internal readiness",
  );

  const routeSource = fs.readFileSync(
    "app/api/recruiter/search-v2/route.ts",
    "utf8",
  );
  const getStart = routeSource.indexOf("export async function GET");
  const internalReadinessStart = routeSource.indexOf(
    "  let readiness =",
    getStart,
  );
  const capabilityOnlyBranch = routeSource.slice(
    getStart,
    internalReadinessStart,
  );
  for (const forbidden of [
    "searchV2ProjectionReadiness(",
    "waitForSearchV2ProjectionReadiness(",
    "ensureSearchV2EngineReady(",
    "fetchCandidateSource(",
  ])
    assert.doesNotMatch(
      capabilityOnlyBranch,
      new RegExp(forbidden.replace("(", "\\(")),
      `External capability GET must return before ${forbidden}`,
    );
  assert.match(capabilityOnlyBranch, /return NextResponse\.json/);
  assert.match(routeSource, /buildExternalSearchV2ClientResponse\(\{/);

  const externalPostStart = routeSource.indexOf(
    'if (body.talentPool === "linkedin_talent_pool")',
  );
  const internalPostStart = routeSource.indexOf(
    "const browserRequest",
    externalPostStart,
  );
  const externalPostBranch = routeSource.slice(
    externalPostStart,
    internalPostStart,
  );
  for (const forbidden of [
    "fetchCandidateSource(",
    "adaptCandidatesToSearchV2Documents(",
    "rankCandidatesV2(",
    "dedupeCandidateSearchV2Documents(",
  ])
    assert.doesNotMatch(
      externalPostBranch,
      new RegExp(forbidden.replace("(", "\\(")),
      `External POST must not acquire or rank SAP Talent Hub candidates via ${forbidden}`,
    );

  const clientSource = fs.readFileSync(
    "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
    "utf8",
  );
  assert.match(clientSource, /sourceReadinessRevisionRef\.current/);
  assert.match(
    clientSource,
    /selectedTalentPoolRef\.current === "linkedin_talent_pool"/,
  );
  assert.match(clientSource, /loadSearchV2SourceReadiness\(\{/);
  assert.match(clientSource, /fetchExternalSearchCapability/);
  assert.match(
    clientSource,
    /pendingResultsScrollPageRef\.current = pageNumber/,
  );
  assert.match(clientSource, /Load 50 more candidates/);
  assert.match(clientSource, /external profiles sampled/);
  assert.match(
    clientSource,
    /not an exhaustive list/,
  );

  assert.equal(validateExternalProfileUrl("javascript:alert(1)"), null);
  assert.equal(validateExternalProfileUrl("http://127.0.0.1/person"), null);
  assert.equal(
    externalProfileActionLabel(
      "https://www.linkedin.com/in/exact-provider-profile",
    ),
    "View on LinkedIn",
  );
  assert.equal(
    externalProfileActionLabel("https://profiles.example.com/person/42"),
    "View source profile",
  );
  assert.equal(externalMatchTier(85), "Strong Match");
  assert.equal(externalMatchTier(70), "Good Match");
  assert.equal(externalMatchTier(69), "Potential Match");
  assert.throws(() => validateExternalSearchPlan({ semanticQuery: "" }));
  const plan = validateExternalSearchPlan({
    normalizedRoles: ["Consultant"],
    requiredSkills: ["SAP FICO"],
    optionalSkills: [],
    requiredLocations: ["Malaysia"],
    acceptableLocationVariants: [],
    seniority: [],
    minimumYearsExperience: null,
    languages: [],
    industry: [],
    targetCompanies: [],
    excludedCompanies: [],
    requiredDeliveryContext: [],
    rankingCriteria: [],
    semanticQuery: "SAP FICO Consultant Malaysia",
    unsupportedRequirements: [],
    assumptions: [],
  });
  const scored = scoreExternalCandidate(
    {
      source: "external_talent_network",
      provider: "exa",
      externalCandidateId: "a",
      displayName: "A",
      headline: "SAP FICO Consultant",
      location: "Malaysia",
      skills: ["SAP FICO"],
      profileUrl: "https://profiles.example.com/a",
      profileUrlDomain: "profiles.example.com",
      providerEvidence: [
        {
          requirementId: "consultant",
          label: "Consultant",
          state: "supported",
          excerpt: "SAP FICO Consultant",
          sourceField: "headline",
          sourceUrl: "https://profiles.example.com/a",
        },
        {
          requirementId: "sap fico",
          label: "SAP FICO",
          state: "supported",
          excerpt: "SAP FICO",
          sourceField: "headline",
          sourceUrl: "https://profiles.example.com/a",
        },
        {
          requirementId: "malaysia",
          label: "Malaysia",
          state: "supported",
          excerpt: "Malaysia",
          sourceField: "location",
          sourceUrl: "https://profiles.example.com/a",
        },
      ],
      sourceRequestId: "r",
      providerRank: 1,
      explanationStatus: "pending",
      duplicateReviewStatus: "not_reviewed",
    },
    plan,
  );
  assert.ok(scored);
  assert.equal(
    sortExternalCandidates([
      { ...scored!, overallMatchScore: 70 },
      { ...scored!, externalCandidateId: "b", overallMatchScore: 90 },
    ])[0].externalCandidateId,
    "b",
  );

  const ficoPlan = deterministicExternalSearchPlan({
    query: "SAP FICO implementation consultant",
    talentPool: "linkedin_talent_pool",
    filters: {
      locations: ["Malaysia"],
      minimumTotalYearsExperience: 8,
      deliveryExperience: ["implementation"],
    },
  });
  assert.deepEqual(
    ficoPlan.targetConcepts.map((target) => target.conceptId),
    ["FICO"],
    "the committed query must create a target to evaluate without becoming evidence",
  );
  const fixture = (
    id: string,
    overrides: Partial<Parameters<typeof scoreExternalCandidate>[0]>,
  ): Parameters<typeof scoreExternalCandidate>[0] => ({
    source: "external_talent_network",
    provider: "exa",
    externalCandidateId: id,
    displayName: id,
    headline: "Service Delivery Manager",
    currentTitle: "Service Delivery Manager",
    location: "Malaysia",
    currentEmployer: "Example",
    skills: [],
    experienceSummary: "IT operations and service management",
    employmentText: [],
    projectText: [],
    education: [],
    certifications: [],
    totalYearsExperience: null,
    profileUrl: `https://profiles.example.com/${id}`,
    profileUrlDomain: "profiles.example.com",
    providerEvidence: [],
    sourceRequestId: "fixture-request",
    providerRank: 10,
    explanationStatus: "grounded",
    duplicateReviewStatus: "not_reviewed",
    ...overrides,
  });
  const seniorFico = scoreExternalCandidate(
    fixture("senior-fico", {
      headline: "Senior SAP FICO Implementation Consultant",
      currentTitle: "Senior SAP FICO Implementation Consultant",
      skills: ["SAP FICO", "S/4HANA Finance"],
      totalYearsExperience: 12,
      experienceSummary:
        "Led SAP FICO implementation and finance transformation programs.",
      projectText: [
        "Led a greenfield SAP FICO implementation through go-live.",
        "Delivered a second SAP FICO rollout and migration.",
        "Owned SAP FICO configuration for a third implementation.",
      ],
      providerEvidence: [
        {
          requirementId: "provider-source",
          label: "Provider evidence",
          state: "supported",
          excerpt:
            "Led SAP FICO implementation and finance transformation programs.",
          sourceField: "highlights",
          sourceUrl: "https://profiles.example.com/senior-fico",
        },
      ],
      providerRank: 4,
    }),
    ficoPlan,
  );
  const partialFinanceEvaluation = evaluateExternalCandidate(
    fixture("partial-finance", {
      headline: "SAP Finance Analyst",
      currentTitle: "SAP Finance Analyst",
      skills: ["SAP Finance"],
      experienceSummary: "SAP finance reporting and support.",
      totalYearsExperience: null,
    }),
    ficoPlan,
  );
  const partialFinance = partialFinanceEvaluation.candidate;
  const unrelatedEvaluation = evaluateExternalCandidate(
    fixture("generic-it", {}),
    ficoPlan,
  );
  const unrelated = unrelatedEvaluation.candidate;
  const wrongLocation = scoreExternalCandidate(
    fixture("wrong-location", {
      location: "Germany",
      headline: "SAP FICO Consultant",
      skills: ["SAP FICO"],
    }),
    ficoPlan,
  );
  assert.ok(seniorFico && partialFinance && unrelated);
  assert.equal(partialFinanceEvaluation.eligible, false);
  assert.equal(unrelatedEvaluation.eligible, false);
  assert.equal(
    wrongLocation,
    null,
    "a known required-location mismatch is ineligible",
  );
  assert.ok(seniorFico.titleScore > 0 && seniorFico.skillScore > 0);
  assert.ok(seniorFico.keywordScore > 0 && seniorFico.semanticScore > 0);
  assert.equal(seniorFico.targetEvidence.target, "SAP FICO");
  assert.equal(seniorFico.targetEvidence.tier, "exact_supported");
  assert.equal(seniorFico.requirementCoverage, 100);
  assert.equal(seniorFico.matchTier, "Strong Match");
  assert.ok(seniorFico.evidenceConfidence <= 85);
  assert.equal(
    seniorFico.requirementEvaluations.find(
      (requirement) => requirement.kind === "experience",
    )?.state,
    "supported",
  );
  assert.equal(seniorFico.implementationEvidenceCount, 4);
  assert.equal(
    seniorFico.providerEvidence.filter(
      (evidence) =>
        evidence.excerpt ===
        "Led SAP FICO implementation and finance transformation programs.",
    ).length,
    1,
    "identical candidate text must not be double-counted across normalized fields",
  );
  assert.ok(unrelated.requirementCoverage < 100);
  assert.equal(unrelated.targetEvidence.tier, "none");
  assert.equal(unrelated.implementationEvidenceCount, 0);
  assert.equal(
    unrelated.requirementEvaluations.find(
      (requirement) => requirement.kind === "experience",
    )?.state,
    "unverified",
  );
  const noLocationPlan = deterministicExternalSearchPlan({
    query: "SAP FICO",
    talentPool: "linkedin_talent_pool",
  });
  assert.ok(
    scoreExternalCandidate(
      fixture("germany-without-location-filter", {
        location: "Germany",
        headline: "SAP FICO Consultant",
        skills: ["SAP FICO"],
      }),
      noLocationPlan,
    ),
    "a search without a location requirement must not add a hidden restriction",
  );
  assert.equal(
    unrelated.requirementEvaluations.find(
      (requirement) => requirement.kind === "lifecycle",
    )?.state,
    "unverified",
  );
  assert.ok(seniorFico.overallMatchScore > partialFinance.overallMatchScore);
  assert.ok(partialFinance.overallMatchScore >= unrelated.overallMatchScore);
  const orderedFixtures = sortExternalCandidates([
    unrelated,
    seniorFico,
    partialFinance,
  ]);
  assert.deepEqual(
    orderedFixtures.map((candidate) => candidate.externalCandidateId),
    ["senior-fico", "partial-finance", "generic-it"],
  );
  assert.deepEqual(
    sortExternalCandidates([...orderedFixtures].reverse()).map(
      (candidate) => candidate.externalCandidateId,
    ),
    orderedFixtures.map((candidate) => candidate.externalCandidateId),
    "external ranking must be deterministic",
  );

  const productionPlan = deterministicExternalSearchPlan({
    query:
      "SAP FICO consultant in Malaysia with 8+ years and implementation experience",
    talentPool: "linkedin_talent_pool",
    filters: {
      locations: ["Malaysia"],
      minimumTotalYearsExperience: 8,
      deliveryExperience: ["implementation"],
    },
    criteria: [
      {
        id: "implementation-depth",
        label: "Demonstrated SAP FICO implementation depth",
        importance: "most_important",
        source: "query",
      },
    ],
  });
  assert.deepEqual(
    productionPlan.requirements.map((requirement) => requirement.id),
    [
      "target:FICO",
      "professional-role:consultant",
      "location:required",
      "experience:total",
      "lifecycle:implementation",
    ],
    "all five committed requirements must survive the External plan boundary",
  );
  const exaFixture = (input: {
    id: string;
    title: string;
    location?: string;
    description: string;
    startDate?: string;
    endDate?: string;
    highlights?: string[];
    skills?: string[];
  }) =>
    normalizeExaPersonResult(
      {
        id: input.id,
        title: input.title,
        url: `https://profiles.example.com/runtime/${input.id}`,
        highlights: input.highlights || [],
        entities: [
          {
            type: "person",
            id: input.id,
            properties: {
              displayName: `Synthetic ${input.id}`,
              currentTitle: input.title,
              location: input.location || "Malaysia",
              skills: input.skills || ["SAP FICO"],
              // This deliberately ungrounded aggregate must never satisfy 8+.
              totalYearsExperience: 99,
              workHistory: [
                {
                  title: input.title,
                  company: { name: "Synthetic employer" },
                  description: input.description,
                  startDate: input.startDate,
                  endDate: input.endDate,
                },
              ],
            },
          },
        ],
      },
      0,
      "synthetic-runtime-response",
    )!;
  const evaluatedRuntime = (candidate: ReturnType<typeof exaFixture>) =>
    evaluateExternalCandidate(
      {
        ...candidate,
        source: "external_talent_network",
        provider: "exa",
        skills: candidate.skills || [],
        employmentText: candidate.employmentText || [],
        projectText: candidate.projectText || [],
        education: candidate.education || [],
        certifications: candidate.certifications || [],
        totalYearsExperience: candidate.totalYearsExperience ?? null,
        profileUrlDomain: "profiles.example.com",
        providerEvidence: candidate.providerEvidence.map((evidence) => ({
          ...evidence,
          label: "Provider evidence",
          sourceUrl: candidate.profileUrl || "",
        })),
        sourceRequestId: "synthetic-runtime-response",
        providerRank: 1,
        explanationStatus: "grounded",
        duplicateReviewStatus: "not_reviewed",
      },
      productionPlan,
    );
  const sixImplementations = evaluatedRuntime(
    exaFixture({
      id: "six-grounded",
      title: "Senior SAP FICO Consultant",
      description: "Six full SAP life-cycle implementations in FICO.",
      startDate: "2014-01-01",
      endDate: "2024-01-01",
    }),
  );
  const unknownYears = evaluatedRuntime(
    exaFixture({
      id: "unknown-years",
      title: "SAP FICO Consultant",
      description: "Delivered SAP FICO implementation and go-live.",
    }),
  );
  const fiveYears = evaluatedRuntime(
    exaFixture({
      id: "five-years",
      title: "SAP FICO Consultant",
      description: "Delivered SAP FICO implementation and go-live.",
      startDate: "2019-01-01",
      endDate: "2024-01-01",
    }),
  );
  const financeOnly = evaluatedRuntime(
    exaFixture({
      id: "finance-only",
      title: "Finance Transformation Consultant",
      skills: ["Financial reporting"],
      description: "Delivered a finance transformation implementation.",
      startDate: "2014-01-01",
      endDate: "2024-01-01",
    }),
  );
  const outsideMalaysia = evaluatedRuntime(
    exaFixture({
      id: "outside-malaysia",
      title: "SAP FICO Consultant",
      location: "Germany",
      description: "Delivered SAP FICO implementation and go-live.",
      startDate: "2014-01-01",
      endDate: "2024-01-01",
    }),
  );
  const duplicateImplementation = evaluatedRuntime(
    exaFixture({
      id: "duplicate-implementation",
      title: "SAP FICO Consultant",
      description: "Delivered one SAP FICO implementation.",
      highlights: ["Delivered one SAP FICO implementation."],
      startDate: "2014-01-01",
      endDate: "2024-01-01",
    }),
  );
  const genericImplementation = evaluatedRuntime(
    exaFixture({
      id: "generic-implementation",
      title: "SAP FICO Consultant",
      description: "Led a generic software implementation program.",
      startDate: "2014-01-01",
      endDate: "2024-01-01",
    }),
  );
  for (const evaluated of [
    sixImplementations,
    unknownYears,
    fiveYears,
    financeOnly,
    outsideMalaysia,
    duplicateImplementation,
    genericImplementation,
  ])
    assert.equal(
      evaluated.candidate.requirementEvaluations.length,
      5,
      "every committed requirement must receive an explicit evaluation",
    );
  assert.equal(sixImplementations.eligible, true);
  assert.equal(sixImplementations.candidate.requirementCoverage, 100);
  assert.equal(sixImplementations.candidate.implementationEvidenceCount, 6);
  assert.ok(sixImplementations.candidate.criteriaScore > 0);
  assert.equal(sixImplementations.candidate.targetEvidence.tier, "exact_supported");
  assert.equal(unknownYears.candidate.totalYearsExperience, null);
  assert.equal(unknownYears.eligible, false);
  assert.ok(unknownYears.candidate.requirementCoverage < 100);
  assert.equal(
    unknownYears.candidate.requirementEvaluations.find(
      (requirement) => requirement.id === "experience:total",
    )?.state,
    "unverified",
  );
  assert.equal(fiveYears.eligible, false);
  assert.equal(
    fiveYears.candidate.requirementEvaluations.find(
      (requirement) => requirement.id === "experience:total",
    )?.state,
    "conflicting",
  );
  assert.equal(financeOnly.eligible, false);
  assert.notEqual(financeOnly.candidate.targetEvidence.tier, "exact_supported");
  assert.equal(outsideMalaysia.eligible, false);
  assert.equal(duplicateImplementation.candidate.implementationEvidenceCount, 1);
  assert.equal(genericImplementation.candidate.implementationEvidenceCount, 0);
  assert.equal(genericImplementation.candidate.criteriaScore, 0);
  assert.ok(
    sixImplementations.candidate.overallMatchScore >
      duplicateImplementation.candidate.overallMatchScore,
    "grounded implementation depth must materially affect ordering",
  );
  const productionOrdered = sortExternalCandidates([
    duplicateImplementation.candidate,
    sixImplementations.candidate,
  ]);
  assert.deepEqual(
    productionOrdered.map((candidate) => candidate.externalCandidateId),
    ["six-grounded", "duplicate-implementation"],
  );
  assert.deepEqual(
    sortExternalCandidates([...productionOrdered].reverse()).map(
      (candidate) => candidate.externalCandidateId,
    ),
    productionOrdered.map((candidate) => candidate.externalCandidateId),
  );
  const canonicalProjection = externalCanonicalResultProjection(
    sixImplementations.candidate,
    "synthetic-requirements-v1",
  );
  assert.equal(canonicalProjection.rankingScore, sixImplementations.candidate.rankingScore);
  assert.equal(canonicalProjection.overallMatchScore, canonicalProjection.rankingScore);
  assert.equal(canonicalProjection.overallMatchPercent, canonicalProjection.rankingScore);
  assert.equal(
    displayedRankingScore({
      ...canonicalProjection,
      score: { finalScore: canonicalProjection.rankingScore } as never,
    }),
    canonicalProjection.rankingScore,
  );
  assert.match(
    canonicalProjection.integrity.requirements.find(
      (requirement) => requirement.id === "target:FICO",
    )?.reason || "",
    /SAP FICO confirmed in current title/,
  );
  const canonicalCardMarkup = renderToStaticMarkup(
    createElement(CompactCandidateCard, {
      result: {
        candidateId: sixImplementations.candidate.externalCandidateId,
        talentPool: "linkedin_talent_pool",
        candidateName: sixImplementations.candidate.displayName || null,
        currentTitle: sixImplementations.candidate.currentTitle || null,
        currentEmployer: sixImplementations.candidate.currentEmployer || null,
        location: sixImplementations.candidate.location || null,
        country: null,
        totalYearsExperience: sixImplementations.candidate.totalYearsExperience,
        implementationEvidenceCount:
          sixImplementations.candidate.implementationEvidenceCount,
        implementationEvidenceLevel: "source_text_evidence",
        seniorityEvidenceLevel: "source_text_evidence",
        score: {
          keywordScore: sixImplementations.candidate.keywordScore,
          semanticScore: sixImplementations.candidate.semanticScore,
          skillScore: sixImplementations.candidate.skillScore,
          titleScore: sixImplementations.candidate.titleScore,
          employerScore: 0,
          locationScore: sixImplementations.candidate.locationScore,
          industryScore: 0,
          qualityScore: sixImplementations.candidate.evidenceConfidence,
          confidenceScore: sixImplementations.candidate.evidenceConfidence,
          recencyScore: 0,
          finalScore: sixImplementations.candidate.rankingScore,
        },
        explanation: {
          matchedTerms: [],
          matchedSkills: ["SAP FICO"],
          matchedSapModules: ["SAP FICO"],
          matchedIndustries: [],
          missingSkills: [],
          reasons: [],
          warnings: [],
          confidenceLevel: "high",
        },
        verifiedSkills: [],
        verifiedSapModules: [],
        queryRelevantSkills: ["SAP FICO"],
        targetEvidence: sixImplementations.candidate.targetEvidence,
        requiredCoveragePercent:
          sixImplementations.candidate.requirementCoverage,
        evidenceConfidencePercent:
          sixImplementations.candidate.evidenceConfidence,
        profileCompletenessPercent:
          sixImplementations.candidate.profileCompleteness,
        linkedInProfileUrl: sixImplementations.candidate.profileUrl || null,
        ...canonicalProjection,
      } as never,
      rank: 1,
      searchContextId: "synthetic-production-contract",
      intent: parseRecruiterSearchIntent(
        "SAP FICO consultant in Malaysia with 8+ years and implementation experience",
      ),
      expanded: false,
      diagnostic: {
        matchLevel: sixImplementations.candidate.matchTier,
        evidenceConfidence: "High",
        evidenceCoveragePercent: 100,
        requirements: canonicalProjection.integrity.requirements,
        criteria: canonicalProjection.criteriaDiagnostic.criteria,
      } as never,
      onToggle: () => undefined,
    }),
  );
  assert.match(
    canonicalCardMarkup,
    new RegExp(`${sixImplementations.candidate.rankingScore}%`),
  );
  assert.doesNotMatch(canonicalCardMarkup, /Ranking score[\s\S]{0,120}>0%</);
  assert.match(canonicalCardMarkup, /SAP FICO confirmed in current title/);
  assert.doesNotMatch(
    canonicalCardMarkup,
    /Primary FICO specialization not confirmed/,
  );

  let thresholdProviderCalls = 0;
  const thresholdProvider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "threshold-fixture",
        providerName: "Threshold fixture",
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
    async search() {
      thresholdProviderCalls += 1;
      return {
        sourceRequestId: "threshold-fixture-request",
        candidates: [
          {
            source: "linkedin_talent_pool",
            externalCandidateId: "criterion-grounded",
            displayName: "Synthetic criterion grounded",
            headline: "Demonstrated delivery leadership",
            currentTitle: "Demonstrated delivery leadership",
            profileUrl: "https://profiles.example.com/threshold/grounded",
            providerEvidence: [],
          },
          {
            source: "linkedin_talent_pool",
            externalCandidateId: "criterion-absent",
            displayName: "Synthetic criterion absent",
            headline: "General professional",
            currentTitle: "General professional",
            profileUrl: "https://profiles.example.com/threshold/absent",
            providerEvidence: [],
          },
        ],
      };
    },
  };
  setExternalTalentProviderForTests(thresholdProvider);
  const thresholdResult = await executeExternalTalentSearch(
    {
      query: "People",
      talentPool: "linkedin_talent_pool",
      minimumScore: 50,
      criteria: [
        {
          id: "delivery-leadership",
          label: "Demonstrated delivery leadership",
          importance: "most_important",
          source: "query",
        },
      ],
    },
    undefined,
    { authorizationScopeHash: "threshold-contract-user" },
  );
  assert.equal(thresholdProviderCalls, 1);
  assert.equal(thresholdResult.evaluatedTotal, 2);
  assert.equal(thresholdResult.eligibleEvaluatedTotal, 1);
  assert.equal(thresholdResult.items.length, 1);
  assert.ok(thresholdResult.items[0].rankingScore >= 50);
  assert.equal(
    thresholdResult.bucketCounts.strong +
      thresholdResult.bucketCounts.good +
      thresholdResult.bucketCounts.potential,
    thresholdResult.eligibleEvaluatedTotal,
  );

  const rejectedCandidate = (
    id: string,
    overrides: Partial<
      Awaited<ReturnType<ExternalCandidateSourceProvider["search"]>>["candidates"][number]
    > = {},
  ) => ({
    source: "linkedin_talent_pool" as const,
    externalCandidateId: id,
    displayName: `Private Rejected ${id}`,
    headline: "SAP FICO Consultant",
    currentTitle: "SAP FICO Consultant",
    location: "Malaysia",
    skills: ["SAP FICO"],
    experienceSummary: "Delivered SAP FICO implementation.",
    employmentText: ["Delivered SAP FICO implementation."],
    profileUrl: `https://profiles.example.com/rejected/${id}`,
    providerEvidence: [],
    ...overrides,
  });
  const diagnosticProvider = (
    candidates: ReturnType<typeof rejectedCandidate>[],
  ): ExternalCandidateSourceProvider => ({
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "diagnostic-fixture",
        providerName: "Diagnostic fixture",
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
    async search() {
      return {
        sourceRequestId: "diagnostic-fixture-request",
        candidates,
      };
    },
  });
  const diagnosticRequest = {
    query:
      "SAP FICO consultant in Malaysia with 8+ years and implementation experience",
    talentPool: "linkedin_talent_pool" as const,
    filters: {
      locations: ["Malaysia"],
      minimumTotalYearsExperience: 8,
      deliveryExperience: ["implementation"],
    },
  };
  setExternalTalentProviderForTests(
    diagnosticProvider(
      Array.from({ length: 50 }, (_, index) =>
        rejectedCandidate(`unknown-years-${index}`),
      ),
    ),
  );
  const zeroResultDiagnostics = await executeExternalTalentSearch(
    diagnosticRequest,
    undefined,
    { authorizationScopeHash: "zero-result-diagnostic-user" },
  );
  assert.equal(zeroResultDiagnostics.evaluatedTotal, 50);
  assert.equal(zeroResultDiagnostics.eligibleEvaluatedTotal, 0);
  assert.equal(zeroResultDiagnostics.items.length, 0);
  assert.equal(zeroResultDiagnostics.rejectionSummary.evaluated, 50);
  assert.equal(zeroResultDiagnostics.rejectionSummary.eligible, 0);
  assert.equal(zeroResultDiagnostics.rejectionSummary.requirements.length, 5);
  const experienceRejection =
    zeroResultDiagnostics.rejectionSummary.requirements.find(
      (requirement) => requirement.requirementId === "experience:total",
    )!;
  assert.equal(experienceRejection.unverifiedCount, 50);
  assert.equal(experienceRejection.contradictedCount, 0);
  assert.equal(
    zeroResultDiagnostics.rejectionSummary.requirements.find(
      (requirement) => requirement.requirementId === "location:required",
    )?.supportedCount,
    50,
  );
  const zeroPresentation = externalRejectionSummaryPresentation(
    zeroResultDiagnostics.rejectionSummary,
  );
  assert.equal(
    zeroPresentation.headline,
    "50 profiles evaluated; 0 met all 5 required filters",
  );
  assert.equal(
    zeroPresentation.requirements[0].text,
    "Experience: 8+ years — unverified for 50 profiles.",
  );
  assert.ok(
    zeroPresentation.requirements.every(
      (requirement) => requirement.failureCount > 0,
    ),
    "the primary exclusion list contains only actual failures",
  );
  assert.ok(
    zeroPresentation.supportedRequirements.some(
      (requirement) => requirement.requirementId === "location:required",
    ),
    "fully supported filters are separated from exclusion reasons",
  );
  const serializedZeroDiagnostics = JSON.stringify(zeroResultDiagnostics);
  assert.doesNotMatch(serializedZeroDiagnostics, /Private Rejected/);
  assert.doesNotMatch(serializedZeroDiagnostics, /profiles\.example\.com/);
  assert.doesNotMatch(serializedZeroDiagnostics, /unknown-years-0/);

  setExternalTalentProviderForTests(
    diagnosticProvider([
      rejectedCandidate("mixed-unknown"),
      rejectedCandidate("mixed-multiple", {
        currentTitle: "Service Manager",
        headline: "Service Manager",
        skills: [],
        experienceSummary: "Generic software operations.",
        employmentText: [],
        totalYearsExperience: 5,
      }),
      rejectedCandidate("mixed-location", {
        location: "Germany",
        totalYearsExperience: 10,
      }),
    ]),
  );
  const mixedDiagnostics = await executeExternalTalentSearch(
    diagnosticRequest,
    undefined,
    { authorizationScopeHash: "mixed-diagnostic-user" },
  );
  assert.equal(mixedDiagnostics.items.length, 0);
  assert.ok(
    mixedDiagnostics.rejectionSummary.requirements.reduce(
      (total, requirement) =>
        total + requirement.contradictedCount + requirement.unverifiedCount,
      0,
    ) > mixedDiagnostics.rejectionSummary.evaluated,
    "one rejected profile may contribute to multiple requirement failures",
  );
  assert.ok(
    mixedDiagnostics.rejectionSummary.requirements.some(
      (requirement) => requirement.contradictedCount > 0,
    ),
  );
  assert.ok(
    mixedDiagnostics.rejectionSummary.requirements.some(
      (requirement) => requirement.unverifiedCount > 0,
    ),
  );

  setExternalTalentProviderForTests(
    diagnosticProvider([
      rejectedCandidate("nonzero-grounded", { totalYearsExperience: 10 }),
      rejectedCandidate("nonzero-unknown"),
    ]),
  );
  const nonzeroDiagnostics = await executeExternalTalentSearch(
    diagnosticRequest,
    undefined,
    { authorizationScopeHash: "nonzero-diagnostic-user" },
  );
  assert.equal(nonzeroDiagnostics.rejectionSummary.evaluated, 2);
  assert.equal(nonzeroDiagnostics.rejectionSummary.eligible, 1);
  assert.equal(nonzeroDiagnostics.items.length, 1);
  const providerQueries: string[] = [];
  const provider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "exa",
        providerName: "Exa People Search",
        connected: true,
        ready: true,
        status: "ready",
        reason: null,
        authentication: "valid",
        supportedFilters: ["query"],
        supportsCandidateDetails: false,
        supportsImport: true,
        pagination: "page",
        sandboxAvailable: true,
      };
    },
    async search(request) {
      providerQueries.push(request.query);
      return {
        sourceRequestId: "mock-exa-request",
        candidates: Array.from({ length: 50 }, (_, i) => ({
          source: "linkedin_talent_pool",
          externalCandidateId: `exa-${i.toString().padStart(2, "0")}`,
          displayName: `Candidate ${i}`,
          headline: "SAP FICO Consultant",
          location: "Malaysia",
          currentEmployer: "Example",
          skills: ["SAP FICO"],
          experienceSummary: "SAP FICO implementation consulting in Malaysia",
          profileUrl: `https://profiles.example.com/person/${i}`,
          providerEvidence: [
            {
              requirementId: "source",
              state: "supported",
              excerpt: "SAP FICO implementation consulting in Malaysia",
              sourceField: "highlights",
            },
          ],
          providerRank: i + 1,
        })),
      };
    },
    async importCandidate(id, metadata) {
      assert.ok(metadata.consentBasis);
      assert.ok(metadata.retentionPolicy);
      return {
        internalCandidateId: `pending-${id}`,
        possibleDuplicateInternalIds: ["internal-review-only"],
      };
    },
  };
  setExternalTalentProviderForTests(provider);
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "must-not-be-called";
  const first = await executeExternalTalentSearch({
    query: "SAP FICO Malaysia",
    talentPool: "linkedin_talent_pool",
    filters: { sapModules: ["SAP FICO"], locations: ["Malaysia"] },
  });
  assert.equal(first.items.length, 20);
  assert.equal(providerQueries.length, 1);
  assert.equal(providerQueries[0], "SAP FICO | Malaysia");
  assert.ok(first.nextCursor);
  assert.equal(first.sourceRequestId, "mock-exa-request");
  const second = await executeExternalTalentSearch({
    query: "SAP FICO Malaysia",
    talentPool: "linkedin_talent_pool",
    filters: { sapModules: ["SAP FICO"], locations: ["Malaysia"] },
    page: 2,
    cursor: first.nextCursor!,
  });
  assert.equal(second.items.length, 20);
  assert.equal(
    providerQueries.length,
    1,
    "cached batches must not call Exa or Claude again",
  );
  assert.equal(
    new Set([...first.items, ...second.items].map((x) => x.externalCandidateId))
      .size,
    40,
  );
  assert.ok(
    first.items.at(-1)!.overallMatchScore >= second.items[0].overallMatchScore,
  );

  const batchedProviderCalls: Array<{
    cursor?: string;
    pageSize: number;
  }> = [];
  let failThirdBatchOnce = true;
  const batchedCandidate = (id: number, exceptional = false) => ({
    source: "linkedin_talent_pool" as const,
    externalCandidateId: `batch-${id}`,
    displayName: `Batch Candidate ${id}`,
    headline: exceptional
      ? "Principal SAP FICO Implementation Consultant"
      : "SAP FICO Consultant",
    currentTitle: exceptional
      ? "Principal SAP FICO Implementation Consultant"
      : "SAP FICO Consultant",
    location: "Malaysia",
    currentEmployer: "Example",
    skills: ["SAP FICO"],
    experienceSummary: exceptional
      ? "Led SAP FICO implementation, migration, and go-live delivery."
      : "SAP FICO consulting and finance configuration.",
    projectText: exceptional
      ? [
          "Led SAP FICO greenfield implementation.",
          "Delivered SAP FICO migration and go-live.",
        ]
      : [],
    profileUrl: `https://profiles.example.com/batch/${id}`,
    providerEvidence: [],
    providerRank: id + 1,
  });
  const batchedProvider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "exa",
        providerName: "Exa People Search",
        connected: true,
        ready: true,
        status: "ready",
        reason: null,
        authentication: "valid",
        supportedFilters: ["query"],
        supportsCandidateDetails: false,
        supportsImport: false,
        pagination: "cursor",
        sandboxAvailable: true,
      };
    },
    async search(request) {
      batchedProviderCalls.push({
        cursor: request.providerCursor,
        pageSize: request.pageSize,
      });
      if (!request.providerCursor)
        return {
          sourceRequestId: "batch-request-1",
          nextCursor: "opaque-provider-cursor-2",
          candidates: Array.from({ length: 50 }, (_, index) =>
            batchedCandidate(index),
          ),
        };
      if (request.providerCursor === "opaque-provider-cursor-2")
        return {
          sourceRequestId: "batch-request-2",
          nextCursor: "opaque-provider-cursor-3",
          candidates: Array.from({ length: 50 }, (_, index) =>
            batchedCandidate(index + 45, index === 49),
          ),
        };
      if (
        request.providerCursor === "opaque-provider-cursor-3" &&
        failThirdBatchOnce
      ) {
        failThirdBatchOnce = false;
        throw new Error("mock provider timeout");
      }
      if (request.providerCursor === "opaque-provider-cursor-3")
        return {
          sourceRequestId: "batch-request-3",
          candidates: Array.from({ length: 50 }, (_, index) =>
            batchedCandidate(index + 95),
          ),
        };
      throw new Error(`unexpected provider cursor ${request.providerCursor}`);
    },
  };
  setExternalTalentProviderForTests(batchedProvider);
  const batchedRequest = {
    query: "SAP FICO unbounded batch fixture",
    talentPool: "linkedin_talent_pool" as const,
  };
  const batchOnePageOne = await executeExternalTalentSearch(
    { ...batchedRequest, page: 1 },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(batchOnePageOne.loadedExternalTotal, 50);
  assert.equal(batchOnePageOne.items.length, 20);
  assert.ok(batchOnePageOne.nextProviderBatchCursor);
  assert.notEqual(
    batchOnePageOne.nextProviderBatchCursor,
    "opaque-provider-cursor-2",
    "the real provider cursor must remain server-side",
  );
  const batchOnePageTwo = await executeExternalTalentSearch(
    { ...batchedRequest, page: 2, cursor: batchOnePageOne.nextCursor! },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  const batchOnePageThree = await executeExternalTalentSearch(
    { ...batchedRequest, page: 3, cursor: batchOnePageTwo.nextCursor! },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(batchOnePageTwo.items.length, 20);
  assert.equal(batchOnePageThree.items.length, 10);
  assert.equal(
    batchedProviderCalls.length,
    1,
    "local pages 1-3 must not fetch another provider batch",
  );
  const batchTwo = await executeExternalTalentSearch(
    {
      ...batchedRequest,
      page: 3,
      externalBatchCursor: batchOnePageThree.nextProviderBatchCursor!,
    },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(batchedProviderCalls.length, 2);
  assert.equal(batchedProviderCalls[1].cursor, "opaque-provider-cursor-2");
  assert.equal(batchedProviderCalls[1].pageSize, 50);
  assert.equal(
    batchTwo.loadedExternalTotal,
    95,
    "five duplicate profiles must not increase the loaded total",
  );
  assert.equal(batchTwo.eligibleEvaluatedTotal, 95);
  assert.ok(batchTwo.nextProviderBatchCursor);
  const rerankedPageOne = await executeExternalTalentSearch(
    { ...batchedRequest, page: 1 },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(
    rerankedPageOne.items[0].externalCandidateId,
    "batch-94",
    "the complete accumulated snapshot must be globally re-ranked",
  );
  assert.equal(
    new Set(
      rerankedPageOne.items.map((candidate) => candidate.externalCandidateId),
    ).size,
    rerankedPageOne.items.length,
  );
  assert.equal(
    batchedProviderCalls.length,
    2,
    "reading the merged snapshot must not replay provider batch one",
  );
  await assert.rejects(
    () =>
      executeExternalTalentSearch(
        {
          ...batchedRequest,
          page: 5,
          externalBatchCursor: batchTwo.nextProviderBatchCursor!,
        },
        undefined,
        { authorizationScopeHash: "batch-user-a" },
      ),
    /mock provider timeout/,
  );
  const preservedAfterFailure = await executeExternalTalentSearch(
    { ...batchedRequest, page: 5 },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(preservedAfterFailure.loadedExternalTotal, 95);
  assert.equal(preservedAfterFailure.items.length, 15);
  const batchThree = await executeExternalTalentSearch(
    {
      ...batchedRequest,
      page: 5,
      externalBatchCursor: batchTwo.nextProviderBatchCursor!,
    },
    undefined,
    { authorizationScopeHash: "batch-user-a" },
  );
  assert.equal(batchedProviderCalls.length, 4);
  assert.equal(batchedProviderCalls[2].cursor, "opaque-provider-cursor-3");
  assert.equal(batchedProviderCalls[3].cursor, "opaque-provider-cursor-3");
  assert.equal(batchThree.loadedExternalTotal, 145);
  assert.equal(batchThree.providerExhausted, true);
  assert.equal(batchThree.nextProviderBatchCursor, null);
  assert.match(
    batchThree.warnings.join(" "),
    /provider sample, not an exhaustive market list/,
  );
  await assert.rejects(() =>
    executeExternalTalentSearch(
      {
        ...batchedRequest,
        externalBatchCursor: batchTwo.nextProviderBatchCursor!,
      },
      undefined,
      { authorizationScopeHash: "different-user" },
    ),
  );

  let emptyBatchCalls = 0;
  setExternalTalentProviderForTests({
    ...batchedProvider,
    async search(request) {
      emptyBatchCalls += 1;
      return request.providerCursor
        ? {
            sourceRequestId: "empty-batch-2",
            candidates: [],
          }
        : {
            sourceRequestId: "empty-batch-1",
            nextCursor: "empty-batch-cursor",
            candidates: Array.from({ length: 50 }, (_, index) =>
              batchedCandidate(index + 500),
            ),
          };
    },
  });
  const beforeEmptyBatch = await executeExternalTalentSearch(
    {
      query: "SAP FICO empty next batch fixture",
      talentPool: "linkedin_talent_pool",
      page: 3,
    },
    undefined,
    { authorizationScopeHash: "empty-batch-user" },
  );
  const afterEmptyBatch = await executeExternalTalentSearch(
    {
      query: "SAP FICO empty next batch fixture",
      talentPool: "linkedin_talent_pool",
      page: 3,
      externalBatchCursor: beforeEmptyBatch.nextProviderBatchCursor!,
    },
    undefined,
    { authorizationScopeHash: "empty-batch-user" },
  );
  assert.equal(emptyBatchCalls, 2);
  assert.equal(afterEmptyBatch.loadedExternalTotal, 50);
  assert.equal(afterEmptyBatch.providerExhausted, true);
  assert.equal(afterEmptyBatch.nextProviderBatchCursor, null);

  setExternalTalentProviderForTests(provider);

  const mockResults = first.items.map((item) => ({
    candidateId: item.externalCandidateId,
    talentPool: "linkedin_talent_pool" as const,
    candidateName: item.displayName || null,
    currentTitle: item.headline || null,
    currentEmployer: item.currentEmployer || null,
    location: item.location || null,
    country: null,
    totalYearsExperience: null,
    implementationEvidenceCount: 1,
    implementationEvidenceLevel: "source_text_evidence" as const,
    seniorityEvidenceLevel: "source_text_evidence" as const,
    score: {
      keywordScore: 0,
      semanticScore: item.rankingScore,
      skillScore: 0,
      titleScore: 0,
      employerScore: 0,
      locationScore: 0,
      industryScore: 0,
      qualityScore: item.evidenceConfidence,
      confidenceScore: item.evidenceConfidence,
      recencyScore: 0,
      finalScore: item.overallMatchScore,
    },
    explanation: {
      matchedTerms: item.providerEvidence.map((evidence) => evidence.label),
      matchedSkills: item.skills,
      matchedSapModules: [],
      matchedIndustries: [],
      missingSkills: [],
      reasons: item.providerEvidence.map((evidence) => evidence.excerpt),
      warnings: [],
      confidenceLevel: "medium" as const,
    },
    verifiedSkills: item.skills,
    verifiedSapModules: [],
    queryRelevantSkills: item.skills,
    overallMatchScore: item.overallMatchScore,
    overallMatchPercent: item.overallMatchScore,
    rankingScore: item.rankingScore,
    matchLabel: item.matchTier,
    requiredCoveragePercent: item.requirementCoverage,
    evidenceConfidencePercent: item.evidenceConfidence,
    profileCompletenessPercent: item.profileCompleteness,
    linkedInProfileUrl: item.profileUrl || null,
  }));
  const routePayload = buildExternalSearchV2ClientResponse({
    externalResult: first,
    results: mockResults,
    generatedAt: "2026-09-04T00:00:00.000Z",
    requestId: "mock-external-request",
    request: {
      query: "SAP FICO Malaysia",
      mode: "hybrid",
      page: 1,
      pageSize: 20,
      minimumScore: 50,
      matchQuality: "relevant",
    },
  });
  assert.equal(routePayload.source, "external_talent_network");
  assert.equal(routePayload.provider, "exa");
  assert.equal(routePayload.summary.totalMatched, 50);
  assert.equal((routePayload.results as unknown[]).length, 20);
  assert.equal((routePayload.items as unknown[]).length, 20);
  assert.equal((routePayload.externalItems as unknown[]).length, 20);
  assert.deepEqual(routePayload.rejectionSummary, first.rejectionSummary);

  const {
    verifiedVisible: _verifiedVisible,
    supportedVisible: _supportedVisible,
    relatedVisible: _relatedVisible,
    appliedMinimumScore: _appliedMinimumScore,
    appliedMatchQuality: _appliedMatchQuality,
    ...legacyExternalSummary
  } = routePayload.summary;
  const rejectedLegacyPayload = reconcileSearchV2Response({
    payload: { ...routePayload, summary: legacyExternalSummary },
    requestId: 6,
    latestRequestId: 6,
    aborted: false,
    requestTalentPool: "linkedin_talent_pool",
    activeTalentPool: "linkedin_talent_pool",
    requestSourceRevision: 2,
    activeSourceRevision: 2,
  });
  assert.equal(rejectedLegacyPayload.status, "invalid");

  let activeTalentPool: "internal_profiles" | "linkedin_talent_pool" =
    "internal_profiles";
  let activeSourceRevision = 2;
  let latestRequestId = 6;
  activeTalentPool = "linkedin_talent_pool";
  activeSourceRevision += 1;
  latestRequestId += 1;
  const committedExternalSearch = {
    requestId: latestRequestId,
    talentPool: activeTalentPool,
    sourceRevision: activeSourceRevision,
  } as const;
  const accepted = reconcileSearchV2Response({
    payload: routePayload,
    requestId: committedExternalSearch.requestId,
    latestRequestId,
    aborted: false,
    requestTalentPool: committedExternalSearch.talentPool,
    activeTalentPool,
    requestSourceRevision: committedExternalSearch.sourceRevision,
    activeSourceRevision,
  });
  assert.equal(
    accepted.status,
    "accepted",
    "valid External HTTP 200 response must not be discarded",
  );
  assert.equal(
    accepted.status === "accepted" ? accepted.response.results.length : 0,
    20,
  );

  const visibility = searchV2RenderVisibility(
    accepted.status === "accepted",
    false,
  );
  assert.deepEqual(visibility, {
    showReadyState: false,
    showResults: true,
  });
  const acceptedResults =
    accepted.status === "accepted" ? accepted.response.results : [];
  const intent = parseRecruiterSearchIntent("SAP FICO Malaysia");
  const resultsMarkup = renderToStaticMarkup(
    createElement(
      "main",
      null,
      visibility.showReadyState
        ? createElement("h2", null, "Ready when you are")
        : null,
      visibility.showResults
        ? createElement(
            "section",
            { id: "search-results" },
            createElement("h2", null, "Search results"),
            ...acceptedResults.map((result, index) =>
              createElement(CompactCandidateCard, {
                key: (result as { candidateId: string }).candidateId,
                result: result as never,
                rank: index + 1,
                searchContextId: "mock-external-search",
                intent,
                expanded: false,
                diagnostic: {
                  matchLevel: "Potential Match",
                  evidenceConfidence: "Moderate",
                  evidenceCoveragePercent: 70,
                  requirements: [],
                  criteria: [],
                },
                onToggle: () => undefined,
              }),
            ),
          )
        : null,
    ),
  );
  assert.match(resultsMarkup, /Search results/);
  assert.doesNotMatch(resultsMarkup, /Ready when you are/);
  assert.equal((resultsMarkup.match(/<article/g) || []).length, 20);
  assert.match(resultsMarkup, /data-candidate-details-trigger="exa-00"/);

  let committedResponse: unknown = { source: "internal-sentinel" };
  const committedBeforeStaleResponse = committedResponse;
  activeTalentPool = "internal_profiles";
  activeSourceRevision += 1;
  latestRequestId += 1;
  const staleAfterSourceSwitch = reconcileSearchV2Response({
    payload: routePayload,
    requestId: committedExternalSearch.requestId,
    latestRequestId,
    aborted: true,
    requestTalentPool: committedExternalSearch.talentPool,
    activeTalentPool,
    requestSourceRevision: committedExternalSearch.sourceRevision,
    activeSourceRevision,
  });
  if (staleAfterSourceSwitch.status === "accepted")
    committedResponse = staleAfterSourceSwitch.response;
  assert.equal(staleAfterSourceSwitch.status, "stale");
  assert.equal(committedResponse, committedBeforeStaleResponse);

  await assert.rejects(() =>
    executeExternalTalentSearch({
      query: "different",
      talentPool: "linkedin_talent_pool",
      cursor: first.nextCursor!,
    }),
  );
  const imported = await provider.importCandidate!("exa-1", {
    consentBasis: "legitimate-interest-review",
    retentionPolicy: "external-import-default",
  });
  assert.deepEqual(imported.possibleDuplicateInternalIds, [
    "internal-review-only",
  ]);
  if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previous;
  setExternalTalentProviderForTests(null);
  console.log(
    "External Talent Network isolation, scoring, URL, batching, and import-boundary tests passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
