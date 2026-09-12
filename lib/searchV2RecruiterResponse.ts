import { cleanCandidatePresentationText } from "./candidatePresentationText";

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanExcerpt(value: unknown) {
  const clean = cleanCandidatePresentationText(value);
  if (clean.length <= 180) return clean;
  return `${clean
    .slice(0, 180)
    .replace(/\s+\S*$/, "")
    .trim()}…`;
}

function recruiterResult(value: unknown) {
  if (!record(value)) return value;
  const {
    criteriaDiagnostic: _criteriaDiagnostic,
    domainEvidence: _domainEvidence,
    domainImplementationEvidence: _domainImplementationEvidence,
    ficoRelevance: _ficoRelevance,
    implementationEvidenceLevel: _implementationEvidenceLevel,
    seniorityEvidenceLevel: _seniorityEvidenceLevel,
    specializationEvidenceLevel: _specializationEvidenceLevel,
    rankingVersion: _rankingVersion,
    targetEvidence,
    score,
    explanation,
    evidence,
    integrity,
    ...visible
  } = value;

  const publicTarget = record(targetEvidence)
    ? {
        target: targetEvidence.target,
        tier: targetEvidence.tier,
        strength: targetEvidence.strength,
        matchedIndicators: targetEvidence.matchedIndicators,
        relatedConcepts: targetEvidence.relatedConcepts,
        professionalContextType: targetEvidence.professionalContextType,
      }
    : targetEvidence;
  const publicScore = record(score) ? { finalScore: score.finalScore } : score;
  const publicExplanation = record(explanation)
    ? {
        matchedTerms: explanation.matchedTerms,
        matchedSkills: explanation.matchedSkills,
        matchedSapModules: explanation.matchedSapModules,
        matchedIndustries: explanation.matchedIndustries,
        missingSkills: explanation.missingSkills,
        confidenceLevel: explanation.confidenceLevel,
      }
    : explanation;
  const publicEvidence = Array.isArray(evidence)
    ? evidence
        .filter(record)
        .map((item) => ({
          label: cleanCandidatePresentationText(item.label),
          value: cleanExcerpt(item.value),
        }))
        .filter((item) => item.label && item.value)
    : evidence;
  const publicIntegrity = record(integrity)
    ? {
        attention: integrity.attention,
        currentEmployment: integrity.currentEmployment,
        requirements: Array.isArray(integrity.requirements)
          ? integrity.requirements.filter(record).map((requirement) => {
              const { provenance: _provenance, ...publicRequirement } =
                requirement;
              return publicRequirement;
            })
          : [],
      }
    : integrity;

  return {
    ...visible,
    ...(publicTarget === undefined ? {} : { targetEvidence: publicTarget }),
    ...(publicScore === undefined ? {} : { score: publicScore }),
    ...(publicExplanation === undefined
      ? {}
      : { explanation: publicExplanation }),
    ...(publicEvidence === undefined ? {} : { evidence: publicEvidence }),
    ...(publicIntegrity === undefined ? {} : { integrity: publicIntegrity }),
  };
}

export function sanitizeSearchV2RecruiterResponse<T>(payload: T): T {
  if (!record(payload)) return payload;
  const {
    source: _source,
    executionProfile: _executionProfile,
    eligibilityDiagnostic: _eligibilityDiagnostic,
    ...visible
  } = payload;
  const results = Array.isArray(payload.results)
    ? payload.results.map(recruiterResult)
    : undefined;
  const items = Array.isArray(payload.items)
    ? payload.items.map(recruiterResult)
    : undefined;
  return {
    ...visible,
    ...(results ? { results } : {}),
    ...(items ? { items } : {}),
  } as T;
}
