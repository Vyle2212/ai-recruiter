import type {
  ExternalRejectionSummary,
  ExternalTalentCandidate,
} from "./externalTalentTypes";

export function externalRejectionSummaryPresentation(
  summary: ExternalRejectionSummary,
) {
  const plural = (count: number) => (count === 1 ? "profile" : "profiles");
  return {
    headline:
      summary.evaluated +
      " profiles mapped · " +
      summary.evidenceSupported +
      " evidence-supported · " +
      summary.needsVerification +
      " need verification · " +
      summary.confirmedExcluded +
      " confirmed exclusions",
    noFullyVerifiedMatches:
      summary.evidenceSupported === 0 && summary.needsVerification > 0,
    requirements: summary.requirements
      .map((requirement) => ({
        ...requirement,
        failureCount:
          requirement.confirmedFailCount + requirement.needsVerificationCount,
        text:
          requirement.confirmedFailCount && requirement.needsVerificationCount
            ? requirement.label +
              " — confirmed failure for " +
              requirement.confirmedFailCount +
              " " +
              plural(requirement.confirmedFailCount) +
              "; needs verification for " +
              requirement.needsVerificationCount +
              " " +
              plural(requirement.needsVerificationCount) +
              "."
            : requirement.confirmedFailCount
              ? requirement.label +
                " — confirmed failure for " +
                requirement.confirmedFailCount +
                " " +
                plural(requirement.confirmedFailCount) +
                "."
              : requirement.needsVerificationCount
                ? requirement.label +
                  " — needs verification for " +
                  requirement.needsVerificationCount +
                  " " +
                  plural(requirement.needsVerificationCount) +
                  "."
                : requirement.label +
                  " — confirmed for " +
                  requirement.confirmedPassCount +
                  " " +
                  plural(requirement.confirmedPassCount) +
                  ".",
      }))
      .filter((requirement) => requirement.failureCount > 0)
      .sort(
        (left, right) =>
          right.failureCount - left.failureCount ||
          right.confirmedFailCount - left.confirmedFailCount ||
          left.requirementId.localeCompare(right.requirementId),
      ),
    supportedRequirements: summary.requirements
      .filter(
        (requirement) =>
          requirement.confirmedPassCount > 0 &&
          requirement.confirmedFailCount +
            requirement.needsVerificationCount ===
            0,
      )
      .map((requirement) => ({
        requirementId: requirement.requirementId,
        label: requirement.label,
        supportedCount: requirement.confirmedPassCount,
        text:
          requirement.label +
          " — confirmed for " +
          requirement.confirmedPassCount +
          " " +
          plural(requirement.confirmedPassCount) +
          ".",
      })),
  };
}

export function externalCanonicalResultProjection(
  item: ExternalTalentCandidate,
  requirementsVersion: string,
) {
  return {
    integrity: {
      version: requirementsVersion,
      eligible: item.eligibilityState !== "confirmed_exclusion",
      broadeningApplied: false,
      verified: 0,
      supported: item.requirementEvaluations.filter(
        (requirement) => requirement.state === "confirmed_pass",
      ).length,
      attention: item.unresolvedRequirementCount,
      eligibilityState: item.eligibilityState,
      unresolvedRequirementCount: item.unresolvedRequirementCount,
      confirmedContradictionCount: item.confirmedContradictionCount,
      requirements: item.requirementEvaluations.map((requirement) => ({
        id: requirement.id,
        criterionId: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        required: true,
        state:
          requirement.state === "needs_verification"
            ? ("not_verified" as const)
            : requirement.state === "confirmed_fail"
              ? ("conflicting" as const)
              : ("supported" as const),
        reason: requirement.evidence
          ? requirement.kind === "target" &&
            item.targetEvidence.tier === "exact_supported"
            ? item.targetEvidence.temporalContext === "current"
              ? item.targetEvidence.target + " confirmed in current title."
              : item.targetEvidence.temporalContext === "historical"
                ? item.targetEvidence.target +
                  " appears in historical employment evidence."
                : item.targetEvidence.temporalContext === "profile"
                  ? item.targetEvidence.target +
                    " is supported by the profile title; current employment is not confirmed."
                  : "Supported by " + requirement.evidence.sourceField + "."
            : "Supported by " + requirement.evidence.sourceField + "."
          : requirement.explanation,
        provenance: requirement.evidence
          ? {
              candidateId: item.externalCandidateId,
              sourceRecordId: item.externalCandidateId,
              sourceType: "candidate_record_raw",
              sourceField: requirement.evidence.sourceField,
              matchedLiteral: requirement.evidence.excerpt,
              trusted: true,
            }
          : null,
      })),
    },
    criteriaDiagnostic: {
      scorePercent: item.criteriaScore,
      criteria: item.criterionEvaluations.map((criterion) => ({
        id: criterion.id,
        label: criterion.label,
        importance: criterion.importance,
        state:
          criterion.score > 0
            ? ("supported" as const)
            : ("not_verified" as const),
        score: criterion.score,
        reason:
          criterion.score > 0
            ? "Supported by " +
              criterion.evidenceCount +
              " deduplicated candidate-owned evidence signal" +
              (criterion.evidenceCount === 1 ? "" : "s") +
              "."
            : "Not verified from candidate-owned provider evidence.",
        provenance: null,
      })),
    },
    rankingScore: item.rankingScore,
    overallMatchScore: item.rankingScore,
    overallMatchPercent: item.rankingScore,
    matchLabel: item.matchTier,
  };
}
