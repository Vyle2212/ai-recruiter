import type {
  ExternalRejectionSummary,
  ExternalTalentCandidate,
} from "./externalTalentTypes";

export function externalRejectionSummaryPresentation(
  summary: ExternalRejectionSummary,
) {
  const plural = (count: number) => (count === 1 ? "profile" : "profiles");
  return {
    headline: `${summary.evaluated} profiles evaluated; ${summary.eligible} met all ${summary.requirements.length} required filters`,
    requirements: summary.requirements
      .map((requirement) => ({
        ...requirement,
        failureCount:
          requirement.contradictedCount + requirement.unverifiedCount,
        text:
          requirement.contradictedCount && requirement.unverifiedCount
            ? `${requirement.label} — contradicted for ${requirement.contradictedCount} ${plural(requirement.contradictedCount)}; unverified for ${requirement.unverifiedCount} ${plural(requirement.unverifiedCount)}.`
            : requirement.contradictedCount
              ? `${requirement.label} — contradicted for ${requirement.contradictedCount} ${plural(requirement.contradictedCount)}.`
              : requirement.unverifiedCount
                ? `${requirement.label} — unverified for ${requirement.unverifiedCount} ${plural(requirement.unverifiedCount)}.`
                : `${requirement.label} — supported for ${requirement.supportedCount} ${plural(requirement.supportedCount)}.`,
      }))
      .filter((requirement) => requirement.failureCount > 0)
      .sort(
        (left, right) =>
          right.failureCount - left.failureCount ||
          right.contradictedCount - left.contradictedCount ||
          left.requirementId.localeCompare(right.requirementId),
      ),
    supportedRequirements: summary.requirements
      .filter(
        (requirement) =>
          requirement.supportedCount > 0 &&
          requirement.contradictedCount + requirement.unverifiedCount === 0,
      )
      .map((requirement) => ({
        requirementId: requirement.requirementId,
        label: requirement.label,
        supportedCount: requirement.supportedCount,
        text: `${requirement.label} — supported for ${requirement.supportedCount} ${plural(requirement.supportedCount)}.`,
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
      eligible: true,
      broadeningApplied: false,
      verified: item.requirementEvaluations.filter(
        (requirement) => requirement.state === "verified",
      ).length,
      supported: item.requirementEvaluations.filter(
        (requirement) => requirement.state === "supported",
      ).length,
      attention: item.requirementEvaluations.filter(
        (requirement) => !["verified", "supported"].includes(requirement.state),
      ).length,
      requirements: item.requirementEvaluations.map((requirement) => ({
        id: requirement.id,
        criterionId: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        required: true,
        state:
          requirement.state === "unverified"
            ? ("not_verified" as const)
            : requirement.state,
        reason: requirement.evidence
          ? requirement.kind === "target" &&
            item.targetEvidence.tier === "exact_supported" &&
            item.targetEvidence.professionalContextType === "title"
            ? `${item.targetEvidence.target} confirmed in current title.`
            : `Supported by ${requirement.evidence.sourceField}.`
          : requirement.state === "conflicting"
            ? "Candidate-owned evidence contradicts this required filter."
            : "Not verified from candidate-owned provider evidence.",
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
        state: criterion.score > 0
          ? ("supported" as const)
          : ("not_verified" as const),
        score: criterion.score,
        reason:
          criterion.score > 0
            ? `Supported by ${criterion.evidenceCount} deduplicated candidate-owned evidence signal${criterion.evidenceCount === 1 ? "" : "s"}.`
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
