import type {
  ExternalRejectionSummary,
  ExternalTalentCandidate,
} from "./externalTalentTypes";

type ExternalEligibilityAuditInput = {
  rejectionSummary: ExternalRejectionSummary;
  items: ExternalTalentCandidate[];
  nextProviderBatchCursor: string | null;
  providerExhausted: boolean;
};

export function auditExternalTalentEligibility(
  response: ExternalEligibilityAuditInput,
) {
  const summary = response.rejectionSummary;
  const reconciled =
    summary.evidenceSupported +
      summary.needsVerification +
      summary.confirmedExcluded ===
    summary.evaluated;
  const scoreDistribution = response.items.reduce<Record<string, number>>(
    (counts, candidate) => {
      const band =
        candidate.overallMatchScore >= 85
          ? "85-100"
          : candidate.overallMatchScore >= 70
            ? "70-84"
            : candidate.overallMatchScore >= 50
              ? "50-69"
              : "0-49";
      counts[band] = (counts[band] || 0) + 1;
      return counts;
    },
    {},
  );
  const tierDistribution = response.items.reduce<Record<string, number>>(
    (counts, candidate) => {
      counts[candidate.matchTier] = (counts[candidate.matchTier] || 0) + 1;
      return counts;
    },
    {},
  );
  return {
    before: {
      incorrectlyExcludedBecauseEvidenceUnavailable: summary.needsVerification,
      visibleUnderSupportedOnlyGate: summary.evidenceSupported,
    },
    after: {
      fullyEvidenceSupportedProfiles: summary.evidenceSupported,
      profilesNeedingVerification: summary.needsVerification,
      profilesWithConfirmedFailures: summary.confirmedExcluded,
      visibleByDefault: summary.evidenceSupported + summary.needsVerification,
    },
    providerCouldNotEvaluate: summary.requirements
      .filter((requirement) => requirement.needsVerificationCount > 0)
      .map((requirement) => ({
        requirementId: requirement.requirementId,
        label: requirement.label,
        profiles: requirement.needsVerificationCount,
        providerCapability: requirement.providerCapability,
      })),
    candidateCountsByRequirementState: summary.requirements.map(
      (requirement) => ({
        requirementId: requirement.requirementId,
        confirmedPass: requirement.confirmedPassCount,
        needsVerification: requirement.needsVerificationCount,
        confirmedFail: requirement.confirmedFailCount,
      }),
    ),
    zeroResultCause:
      summary.evidenceSupported === 0 && summary.needsVerification > 0
        ? "missing_evidence"
        : summary.evidenceSupported === 0 &&
            summary.needsVerification === 0 &&
            summary.confirmedExcluded > 0
          ? "genuine_contradictions"
          : "not_zero_result",
    scoreDistribution,
    tierDistribution,
    nextSegmentAvailable:
      Boolean(response.nextProviderBatchCursor) &&
      response.providerExhausted !== true,
    reconciled,
  };
}
