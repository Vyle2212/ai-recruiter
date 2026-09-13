import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import {
  evaluateExternalCandidate,
  sortExternalCandidates,
} from "../lib/externalTalentScoring";
import { canonicalMatchLabel } from "../lib/searchV2Match";
import { externalCanonicalResultProjection } from "../lib/externalTalentProjection";
import { auditExternalTalentEligibility } from "../lib/externalTalentEligibilityAudit";
import { parseRecruiterSearchIntent } from "../lib/recruiterSearchPresentation";
import { CompactCandidateCard } from "../app/recruiter/talent-search/v2/CandidateSearchV2Client";
import type {
  ExternalTalentSearchPlan,
  ExternalRequirementEligibilityState,
} from "../lib/externalTalentTypes";
import { executeExternalTalentSearch } from "../lib/externalTalentSearchService";
import { setExternalTalentProviderForTests } from "../lib/externalTalentProviderRegistry";
import type { ExternalCandidateSourceProvider } from "../lib/externalCandidateSourceProvider";

type CandidateInput = Parameters<typeof evaluateExternalCandidate>[0];
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

const plan = (strictVerifiedOnly = false): ExternalTalentSearchPlan => ({
  version: "exa-people-plan-v2-tri-state",
  requirements: [
    {
      id: "target:FICO",
      label: "SAP FICO",
      kind: "target",
      conceptId: "FICO",
      providerCapability: "provider_filterable",
    },
    {
      id: "location:required",
      label: "Location: Malaysia",
      kind: "location",
      alternatives: ["Malaysia"],
      providerCapability: "provider_filterable",
    },
    {
      id: "experience:total",
      label: "Experience: 8+ years",
      kind: "experience",
      minimum: 8,
      maximum: null,
      providerCapability: "partially_verifiable",
    },
    {
      id: "lifecycle:implementation",
      label: "SAP FICO implementation",
      kind: "lifecycle",
      value: "implementation",
      values: ["implementation"],
      operator: "any",
      conceptId: "FICO",
      contextConceptIds: ["FICO"],
      providerCapability: "partially_verifiable",
    },
  ],
  targetConcepts: [{ conceptId: "FICO", label: "SAP FICO" }],
  normalizedRoles: [],
  requiredSkills: ["SAP FICO"],
  optionalSkills: [],
  requiredLocations: ["Malaysia"],
  acceptableLocationVariants: [],
  includeRelocationRemote: false,
  seniority: [],
  minimumYearsExperience: 8,
  maximumYearsExperience: null,
  languages: [],
  industry: [],
  targetCompanies: [],
  excludedCompanies: [],
  requiredDeliveryContext: ["implementation"],
  rankingCriteria: [],
  semanticQuery:
    "SAP FICO | Malaysia | at least 8 years experience | implementation",
  unsupportedRequirements: [],
  assumptions: [],
  strictVerifiedOnly,
  providerCapabilityWarnings: [
    "The connected external source cannot verify Experience: 8+ years for profiles without grounded employment dates.",
    "The connected external source may not return assignment-level implementation evidence.",
  ],
});

const candidate = (
  id: string,
  overrides: Partial<CandidateInput> = {},
): CandidateInput => ({
  source: "external_talent_network",
  provider: "exa",
  externalCandidateId: id,
  displayName: "External FICO Candidate",
  headline: "SAP FICO Consultant",
  currentTitle: "SAP FICO Consultant",
  location: "Malaysia",
  skills: ["SAP FICO"],
  experienceSummary: "SAP FICO consulting.",
  employmentText: [],
  projectText: [],
  education: [],
  certifications: [],
  totalYearsExperience: null,
  profileUrl: "https://profiles.example.com/" + id,
  profileUrlDomain: "profiles.example.com",
  providerEvidence: [],
  sourceRequestId: "tri-state-fixture",
  providerRank: 1,
  explanationStatus: "grounded",
  duplicateReviewStatus: "not_reviewed",
  ...overrides,
});

const state = (
  result: ReturnType<typeof evaluateExternalCandidate>,
  requirementId: string,
): ExternalRequirementEligibilityState =>
  result.candidate.requirementEvaluations.find(
    (requirement) => requirement.id === requirementId,
  )!.state;

async function main() {
  const missingDates = evaluateExternalCandidate(
    candidate("missing-dates", {
      projectText: [
        "SAP FICO implementation assignment for a Malaysian client.",
      ],
    }),
    plan(),
  );
  assert.equal(missingDates.eligible, true);
  assert.equal(
    missingDates.candidate.eligibilityState,
    "potential_needs_verification",
  );
  assert.equal(state(missingDates, "experience:total"), "needs_verification");
  assert.equal(
    state(missingDates, "lifecycle:implementation"),
    "confirmed_pass",
  );
  assert.equal(missingDates.candidate.requirementCoverage, 75);
  assert.equal(
    missingDates.candidate.matchTier,
    canonicalMatchLabel(missingDates.candidate.overallMatchScore),
  );
  assert.ok(
    !missingDates.candidate.requirementEvaluations.some(
      (requirement) =>
        requirement.id === "experience:total" &&
        requirement.state === "confirmed_pass",
    ),
  );

  const explicitTenYears = evaluateExternalCandidate(
    candidate("ten-years", {
      totalYearsExperience: 10,
      projectText: ["SAP FICO implementation assignment and go-live."],
    }),
    plan(),
  );
  assert.equal(state(explicitTenYears, "experience:total"), "confirmed_pass");
  assert.equal(explicitTenYears.fullySupported, true);
  assert.equal(
    explicitTenYears.candidate.eligibilityState,
    "evidence_supported",
  );

  const explicitThreeYears = evaluateExternalCandidate(
    candidate("three-years", {
      totalYearsExperience: 3,
      projectText: ["SAP FICO implementation assignment."],
    }),
    plan(),
  );
  assert.equal(state(explicitThreeYears, "experience:total"), "confirmed_fail");
  assert.equal(explicitThreeYears.eligible, false);
  assert.equal(
    explicitThreeYears.candidate.eligibilityState,
    "confirmed_exclusion",
  );

  const generalFicoOnly = evaluateExternalCandidate(
    candidate("general-fico", {
      totalYearsExperience: 10,
      experienceSummary:
        "SAP FICO implementation consulting and finance configuration.",
    }),
    plan(),
  );
  assert.equal(
    state(generalFicoOnly, "lifecycle:implementation"),
    "needs_verification",
  );
  assert.equal(generalFicoOnly.candidate.implementationEvidenceCount, 0);

  const explicitAssignment = evaluateExternalCandidate(
    candidate("explicit-assignment", {
      totalYearsExperience: 10,
      projectText: [
        "Led a SAP FICO implementation assignment through cutover.",
      ],
    }),
    plan(),
  );
  assert.equal(
    state(explicitAssignment, "lifecycle:implementation"),
    "confirmed_pass",
  );

  const nonMalaysia = evaluateExternalCandidate(
    candidate("singapore", {
      location: "Singapore",
      totalYearsExperience: 10,
      projectText: ["SAP FICO implementation assignment."],
    }),
    plan(),
  );
  assert.equal(state(nonMalaysia, "location:required"), "confirmed_fail");
  assert.equal(nonMalaysia.eligible, false);

  const missingLocation = evaluateExternalCandidate(
    candidate("missing-location", {
      location: undefined,
      totalYearsExperience: 10,
      projectText: ["SAP FICO implementation assignment."],
    }),
    plan(),
  );
  assert.equal(
    state(missingLocation, "location:required"),
    "needs_verification",
  );
  assert.equal(missingLocation.eligible, true);

  const unrelatedModule = evaluateExternalCandidate(
    candidate("sap-mm-only", {
      headline: "SAP MM Consultant",
      currentTitle: "SAP MM Consultant",
      skills: ["SAP MM"],
      experienceSummary: "SAP MM consulting and materials management.",
      totalYearsExperience: 10,
    }),
    plan(),
  );
  assert.equal(state(unrelatedModule, "target:FICO"), "confirmed_fail");
  assert.equal(unrelatedModule.eligible, false);

  const strictMissingDates = evaluateExternalCandidate(
    candidate("strict-missing-dates", {
      projectText: ["SAP FICO implementation assignment."],
    }),
    plan(true),
  );
  assert.equal(
    state(strictMissingDates, "experience:total"),
    "needs_verification",
  );
  assert.equal(strictMissingDates.eligible, false);

  const projected = externalCanonicalResultProjection(
    missingDates.candidate,
    "tri-state-test",
  );
  const projectedExperience = projected.integrity.requirements.find(
    (requirement) => requirement.id === "experience:total",
  )!;
  assert.equal(projectedExperience.state, "not_verified");
  assert.match(projectedExperience.reason, /not provided/i);
  assert.equal(projected.integrity.supported, 3);
  assert.equal(projected.integrity.attention, 1);
  assert.ok(
    missingDates.candidate.evidenceConfidence <
      explicitTenYears.candidate.evidenceConfidence,
  );
  const potentialMarkup = renderToStaticMarkup(
    createElement(CompactCandidateCard, {
      result: {
        candidateId: missingDates.candidate.externalCandidateId,
        talentPool: "linkedin_talent_pool",
        candidateName: missingDates.candidate.displayName,
        currentTitle: missingDates.candidate.currentTitle,
        currentEmployer: null,
        location: missingDates.candidate.location,
        country: null,
        totalYearsExperience: null,
        score: {
          keywordScore: missingDates.candidate.keywordScore,
          semanticScore: missingDates.candidate.semanticScore,
          skillScore: missingDates.candidate.skillScore,
          titleScore: missingDates.candidate.titleScore,
          employerScore: 0,
          locationScore: missingDates.candidate.locationScore,
          industryScore: 0,
          qualityScore: missingDates.candidate.evidenceConfidence,
          confidenceScore: missingDates.candidate.evidenceConfidence,
          recencyScore: 0,
          finalScore: missingDates.candidate.rankingScore,
        },
        explanation: {
          matchedTerms: [],
          matchedSkills: ["SAP FICO"],
          matchedSapModules: ["SAP FICO"],
          matchedIndustries: [],
          missingSkills: [],
          reasons: [],
          warnings: [],
          confidenceLevel: "medium",
        },
        verifiedSkills: [],
        verifiedSapModules: [],
        queryRelevantSkills: ["SAP FICO"],
        externalEligibilityState: missingDates.candidate.eligibilityState,
        unresolvedRequirementCount:
          missingDates.candidate.unresolvedRequirementCount,
        confirmedContradictionCount:
          missingDates.candidate.confirmedContradictionCount,
        requiredCoveragePercent: missingDates.candidate.requirementCoverage,
        evidenceConfidencePercent: missingDates.candidate.evidenceConfidence,
        profileCompletenessPercent: missingDates.candidate.profileCompleteness,
        linkedInProfileUrl: missingDates.candidate.profileUrl,
        ...projected,
      } as never,
      rank: 1,
      searchContextId: "tri-state-card",
      intent: parseRecruiterSearchIntent(
        "SAP FICO Malaysia 8+ years implementation",
      ),
      expanded: true,
      diagnostic: {
        matchLevel: "Potential Match",
        evidenceConfidence: "Moderate",
        evidenceCoveragePercent: missingDates.candidate.requirementCoverage,
        requirementCoveragePercent: missingDates.candidate.requirementCoverage,
        requirements: projected.integrity.requirements,
        criteria: [],
      } as never,
      onToggle: () => undefined,
    }),
  );
  assert.match(potentialMarkup, /% Potential · Needs verification/);
  assert.match(potentialMarkup, /Needs verification: Experience: 8[+] years/);
  assert.match(potentialMarkup, /3 of 4 confirmed/);
  assert.match(potentialMarkup, /1 to verify/);
  assert.doesNotMatch(potentialMarkup, /Confirmed requirement coverage/);
  assert.doesNotMatch(potentialMarkup, /Met: Experience: 8[+] years/);

  const population = [
    explicitTenYears,
    missingDates,
    explicitThreeYears,
    nonMalaysia,
  ];
  const counts = population.reduce(
    (summary, result) => {
      summary[result.candidate.eligibilityState] += 1;
      return summary;
    },
    {
      evidence_supported: 0,
      potential_needs_verification: 0,
      confirmed_exclusion: 0,
    },
  );
  assert.equal(
    counts.evidence_supported +
      counts.potential_needs_verification +
      counts.confirmed_exclusion,
    population.length,
  );
  assert.deepEqual(counts, {
    evidence_supported: 1,
    potential_needs_verification: 1,
    confirmed_exclusion: 2,
  });

  const audit = auditExternalTalentEligibility({
    items: [explicitTenYears.candidate, missingDates.candidate],
    nextProviderBatchCursor: "next-market-segment",
    providerExhausted: false,
    rejectionSummary: {
      evaluated: 4,
      eligible: 2,
      evidenceSupported: 1,
      needsVerification: 1,
      confirmedExcluded: 2,
      requirements: plan().requirements.map((requirement) => {
        const evaluations = population.map((result) =>
          result.candidate.requirementEvaluations.find(
            (evaluation) => evaluation.id === requirement.id,
          )!,
        );
        return {
          requirementId: requirement.id,
          label: requirement.label,
          contradictedCount: evaluations.filter(
            (evaluation) => evaluation.state === "confirmed_fail",
          ).length,
          unverifiedCount: evaluations.filter(
            (evaluation) => evaluation.state === "needs_verification",
          ).length,
          supportedCount: evaluations.filter(
            (evaluation) => evaluation.state === "confirmed_pass",
          ).length,
          confirmedPassCount: evaluations.filter(
            (evaluation) => evaluation.state === "confirmed_pass",
          ).length,
          needsVerificationCount: evaluations.filter(
            (evaluation) => evaluation.state === "needs_verification",
          ).length,
          confirmedFailCount: evaluations.filter(
            (evaluation) => evaluation.state === "confirmed_fail",
          ).length,
          providerCapability: requirement.providerCapability,
        };
      }),
    },
  });
  assert.equal(audit.before.incorrectlyExcludedBecauseEvidenceUnavailable, 1);
  assert.equal(audit.after.visibleByDefault, 2);
  assert.equal(audit.zeroResultCause, "not_zero_result");
  assert.equal(audit.nextSegmentAvailable, true);
  assert.equal(audit.reconciled, true);

  const groupedOrdering = sortExternalCandidates([
    {
      ...missingDates.candidate,
      overallMatchScore: 100,
      rankingScore: 100,
    },
    {
      ...explicitTenYears.candidate,
      overallMatchScore: 1,
      rankingScore: 1,
    },
  ]);
  assert.equal(groupedOrdering[0].eligibilityState, "evidence_supported");
  assert.equal(groupedOrdering[0].overallMatchScore, 1);

  const segmentCalls: Array<{ query: string; pageSize: number }> = [];
  const segmentProvider: ExternalCandidateSourceProvider = {
    source: "linkedin_talent_pool",
    async capability() {
      return {
        source: "linkedin_talent_pool",
        providerId: "no-cursor-segment-fixture",
        providerName: "No-cursor segment fixture",
        connected: true,
        ready: true,
        status: "ready",
        reason: null,
        authentication: "valid",
        supportedFilters: ["query", "locations", "skills"],
        supportsCandidateDetails: false,
        supportsImport: false,
        pagination: "none",
        sandboxAvailable: true,
      };
    },
    async search(request) {
      segmentCalls.push({ query: request.query, pageSize: request.pageSize });
      const ids =
        segmentCalls.length === 1
          ? ["segment-one", "shared"]
          : ["shared", "segment-two"];
      return {
        sourceRequestId: `segment-request-${segmentCalls.length}`,
        candidates: ids.map((id) => ({
          source: "linkedin_talent_pool" as const,
          externalCandidateId: id,
          displayName: `Candidate ${id}`,
          headline: "SAP FICO Consultant",
          location: "Malaysia",
          skills: ["SAP FICO"],
          profileUrl: `https://profiles.example.com/${id}`,
          providerEvidence: [],
        })),
      };
    },
  };
  setExternalTalentProviderForTests(segmentProvider);
  const segmentRequest = {
    query: "SAP FICO consultant Malaysia",
    talentPool: "linkedin_talent_pool" as const,
    filters: { sapModules: ["FICO"], locations: ["Malaysia"] },
  };
  const firstSegment = await executeExternalTalentSearch(
    segmentRequest,
    undefined,
    { authorizationScopeHash: "tri-state-market-segment" },
  );
  assert.equal(segmentCalls.length, 1);
  assert.equal(segmentCalls[0].pageSize, 100);
  assert.equal(firstSegment.marketMapping.segmentsCompleted, 1);
  assert.ok(firstSegment.nextProviderBatchCursor);
  const secondSegment = await executeExternalTalentSearch(
    {
      ...segmentRequest,
      externalBatchCursor: firstSegment.nextProviderBatchCursor!,
    },
    undefined,
    { authorizationScopeHash: "tri-state-market-segment" },
  );
  assert.equal(segmentCalls.length, 2);
  assert.notEqual(segmentCalls[0].query, segmentCalls[1].query);
  assert.equal(secondSegment.loadedExternalTotal, 3);
  assert.equal(secondSegment.marketMapping.segmentsCompleted, 2);
  assert.equal(
    secondSegment.poolCounts.evidenceSupported +
      secondSegment.poolCounts.needsVerification +
      secondSegment.poolCounts.confirmedExcluded,
    3,
  );
  setExternalTalentProviderForTests(null);

  console.log("External Search V2 tri-state eligibility tests passed.");
}

main().catch((error) => {
  setExternalTalentProviderForTests(null);
  console.error(error);
  process.exitCode = 1;
});
