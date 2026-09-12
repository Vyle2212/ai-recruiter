import type {
  ExternalTalentCandidate,
  ExternalTalentSearchPlan,
  ExternalTalentEvidence,
} from "@/lib/externalTalentTypes";
import {
  canonicalSearchConcept,
  conceptsInText,
  searchConcept,
  searchConceptRelation,
  searchConceptRelationStrength,
  searchConceptSemanticEvidence,
  titleSupportsSearchConcept,
} from "@/lib/candidateSearchConcepts";
import {
  canonicalMatchLabel,
  canonicalOverallMatchScore,
} from "@/lib/searchV2Match";
export const EXTERNAL_RANKING_VERSION = "external-match-v3-market-mapping";
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const normalized = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9+#./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const bounded = (text: string, term: string) => {
  const words = normalized(term).split(" ").filter(Boolean);
  return (
    Boolean(words.length) &&
    new RegExp(
      `(?:^|[^a-z0-9])${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")}(?:$|[^a-z0-9])`,
      "i",
    ).test(normalized(text))
  );
};
type SourceRecord = {
  field: string;
  text: string;
  kind:
    | "title"
    | "skill"
    | "location"
    | "experience"
    | "project"
    | "education"
    | "certification"
    | "provider";
};
const uniqueRecords = (
  input: Omit<
    ExternalTalentCandidate,
    | "overallMatchScore"
    | "matchTier"
    | "requirementCoverage"
    | "rankingScore"
    | "keywordScore"
    | "semanticScore"
    | "skillScore"
    | "titleScore"
    | "employerScore"
    | "locationScore"
    | "criteriaScore"
    | "criterionEvaluations"
    | "deliveryScore"
    | "implementationEvidenceCount"
    | "evidenceConfidence"
    | "profileCompleteness"
    | "requirementEvaluations"
    | "targetEvidence"
  >,
): SourceRecord[] => {
  const values: SourceRecord[] = [
    {
      field: "headline",
      text: input.currentTitle || input.headline || "",
      kind: "title",
    },
    ...(input.skills || []).map(
      (text) => ({ field: "skills", text, kind: "skill" }) as const,
    ),
    {
      field: "experienceSummary",
      text: input.experienceSummary || "",
      kind: "experience",
    },
    ...(input.employmentText || []).flatMap((text) =>
      text
        .split(/\s+(?:\u2014|\u00e2\u20ac\u201d)\s+/)
        .map(
          (value) =>
            ({
              field: "employmentText",
              text: value,
              kind: "experience",
            }) as const,
        ),
    ),
    ...(input.projectText || []).map(
      (text) => ({ field: "projectText", text, kind: "project" }) as const,
    ),
    ...(input.education || []).map(
      (text) => ({ field: "education", text, kind: "education" }) as const,
    ),
    ...(input.certifications || []).map(
      (text) =>
        ({ field: "certifications", text, kind: "certification" }) as const,
    ),
    ...input.providerEvidence.map(
      (evidence) =>
        ({
          field: evidence.sourceField || "providerEvidence",
          text: evidence.excerpt,
          kind: "provider",
        }) as const,
    ),
  ];
  const seen = new Set<string>();
  return values.filter((record) => {
    const key = normalized(record.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const evidenceType = (record: SourceRecord) =>
  record.kind === "title"
    ? ("raw_title" as const)
    : record.kind === "skill"
      ? ("direct_skill" as const)
      : record.kind === "project"
        ? ("raw_project" as const)
        : record.kind === "certification"
          ? ("raw_certification" as const)
          : record.kind === "experience"
            ? ("raw_experience" as const)
            : ("raw_professional_text" as const);
const contextType = (record: SourceRecord) =>
  record.kind === "title"
    ? ("title" as const)
    : record.kind === "skill"
      ? ("direct_skill" as const)
      : record.kind === "project"
        ? ("project" as const)
        : record.kind === "certification"
          ? ("certification" as const)
          : record.kind === "experience"
            ? ("experience" as const)
            : ("sentence" as const);
const supportingEvidence = (
  requirementId: string,
  label: string,
  record: SourceRecord,
  url: string,
  state: "supported" | "verified" = "supported",
): ExternalTalentEvidence => ({
  requirementId,
  label,
  state,
  excerpt: record.text.slice(0, 320),
  sourceField: record.field,
  sourceUrl: url,
});
export function externalMatchTier(score: number) {
  return canonicalMatchLabel(score);
}
export function evaluateExternalCandidate(
  input: Omit<
    ExternalTalentCandidate,
    | "overallMatchScore"
    | "matchTier"
    | "requirementCoverage"
    | "rankingScore"
    | "keywordScore"
    | "semanticScore"
    | "skillScore"
    | "titleScore"
    | "employerScore"
    | "locationScore"
    | "criteriaScore"
    | "criterionEvaluations"
    | "deliveryScore"
    | "implementationEvidenceCount"
    | "evidenceConfidence"
    | "profileCompleteness"
    | "requirementEvaluations"
    | "targetEvidence"
  >,
  plan: ExternalTalentSearchPlan,
): { candidate: ExternalTalentCandidate; eligible: boolean } {
  const records = uniqueRecords(input),
    url = input.profileUrl || "",
    targetConcepts = plan.targetConcepts.length
      ? plan.targetConcepts
      : [
          ...new Set(
            plan.requiredSkills
              .map(canonicalSearchConcept)
              .filter((value): value is string => Boolean(value)),
          ),
        ].map((conceptId) => ({
          conceptId,
          label: searchConcept(conceptId)?.label || conceptId,
        }));
  const targetMatches = targetConcepts
    .flatMap((target) =>
      records
        .map((record) => {
          const ids = conceptsInText(record.text),
            exact =
              ids.includes(target.conceptId) ||
              titleSupportsSearchConcept(record.text, target.conceptId),
            bestRelation = ids
              .map((id) => ({
                id,
                relation: searchConceptRelation(target.conceptId, id),
              }))
              .sort(
                (a, b) =>
                  searchConceptRelationStrength(b.relation) -
                  searchConceptRelationStrength(a.relation),
              )[0];
          const semantic = searchConceptSemanticEvidence(
            target.conceptId,
            record.text,
          );
          const strength = exact
            ? record.kind === "title"
              ? 96
              : record.kind === "skill"
                ? 92
                : semantic.directExact
                  ? 88
                  : 80
            : bestRelation
              ? Math.round(
                  searchConceptRelationStrength(bestRelation.relation) * 65,
                )
              : 0;
          return strength > 0
            ? {
                target,
                record,
                strength,
                exact,
                related: bestRelation?.id || null,
              }
            : null;
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    )
    .sort(
      (a, b) =>
        b.strength - a.strength || a.record.field.localeCompare(b.record.field),
    );
  const bestTarget = targetMatches[0];
  const targetEvidence = bestTarget
    ? {
        target: bestTarget.target.label,
        tier: bestTarget.exact
          ? ("exact_supported" as const)
          : ("related" as const),
        strength: bestTarget.strength,
        evidenceSourceType: bestTarget.exact
          ? evidenceType(bestTarget.record)
          : ("related_concept" as const),
        matchedLiteral: bestTarget.exact
          ? bestTarget.target.label
          : bestTarget.related
            ? searchConcept(bestTarget.related)?.label || bestTarget.related
            : null,
        matchedIndicators: [bestTarget.record.text.slice(0, 160)],
        sourceField: bestTarget.record.field,
        trusted: true,
        reasonCode: bestTarget.exact
          ? ("trusted_literal" as const)
          : ("candidate_related_concept" as const),
        relatedConcepts:
          bestTarget.related && !bestTarget.exact ? [bestTarget.related] : [],
        professionalContextType: bestTarget.exact
          ? contextType(bestTarget.record)
          : ("related" as const),
      }
    : {
        target: targetConcepts[0]?.label || "",
        tier: "none" as const,
        strength: 0,
        evidenceSourceType: "none" as const,
        matchedLiteral: null,
        matchedIndicators: [],
        sourceField: null,
        trusted: false,
        reasonCode: "no_candidate_target_evidence" as const,
        relatedConcepts: [],
        professionalContextType: "none" as const,
      };
  const lifecyclePattern =
    /\b(?:implement(?:ation|ations|ed|ing)?|roll[- ]?out|migration|greenfield|brownfield|go[- ]?live|cutover|deployment)\b/i;
  const recordSupportsConcept = (record: SourceRecord, conceptId: string) =>
    conceptsInText(record.text).includes(conceptId) ||
    titleSupportsSearchConcept(record.text, conceptId) ||
    searchConceptSemanticEvidence(conceptId, record.text).directExact;
  const implementationCandidates = records.filter(
    (record) =>
      (record.kind === "project" ||
        record.kind === "experience" ||
        record.kind === "provider") &&
      lifecyclePattern.test(record.text) &&
      targetConcepts.some((target) =>
        recordSupportsConcept(record, target.conceptId),
      ),
  );
  const implementationRecords = implementationCandidates.filter((record) => {
    if (record.kind !== "provider" && record.field !== "experienceSummary")
      return true;
    const text = normalized(record.text);
    return !implementationCandidates.some(
      (other) =>
        other !== record &&
        other.kind !== "provider" &&
        other.field !== "experienceSummary" &&
        normalized(other.text).includes(text),
    );
  });
  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const explicitImplementationCount = implementationRecords.reduce(
    (maximum, record) => {
      const match = normalized(record.text).match(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\b(?:\s+\w+){0,4}\s+(?:full\s+)?(?:sap\s+)?(?:life[ -]?cycle\s+)?implementations?\b/i,
      );
      if (!match) return maximum;
      const parsed =
        Number(match[1]) || numberWords[match[1].toLowerCase()] || 0;
      return Math.max(maximum, parsed);
    },
    0,
  );
  const implementationEvidenceCount = Math.max(
    explicitImplementationCount,
    implementationRecords.length,
  );
  const implementationRecord = implementationRecords[0] || null;
  const fallbackRequirements = targetConcepts.map((target) => ({
    id: `target:${target.conceptId}`,
    label: target.label,
    kind: "target" as const,
    conceptId: target.conceptId,
  }));
  const committedRequirements = plan.requirements.length
    ? plan.requirements
    : fallbackRequirements;
  const findText = (values: string[], kinds?: SourceRecord["kind"][]) =>
    records.find(
      (record) =>
        (!kinds || kinds.includes(record.kind)) &&
        values.some((value) => bounded(record.text, value)),
    ) || null;
  const requirementEvaluations = committedRequirements.map((requirement) => {
    let record: SourceRecord | null = null;
    let conflicting = false;
    if (requirement.kind === "target") {
      record =
        targetMatches.find(
          (match) =>
            match.target.conceptId === requirement.conceptId && match.exact,
        )?.record || null;
    } else if (requirement.kind === "professional_role") {
      record = findText(
        requirement.alternatives || [requirement.label],
        requirement.titleScope === "current"
          ? ["title"]
          : ["title", "experience", "project", "provider"],
      );
    } else if (requirement.kind === "location") {
      const alternatives = requirement.alternatives || [];
      record =
        input.location &&
        alternatives.some((term) => bounded(input.location!, term))
          ? { field: "location", text: input.location, kind: "location" }
          : null;
      conflicting =
        !plan.includeRelocationRemote && Boolean(input.location) && !record;
    } else if (requirement.kind === "experience") {
      const years = input.totalYearsExperience;
      const known = years !== null && years !== undefined;
      const supported =
        known &&
        (requirement.minimum === null ||
          requirement.minimum === undefined ||
          years >= requirement.minimum) &&
        (requirement.maximum === null ||
          requirement.maximum === undefined ||
          years <= requirement.maximum);
      record = supported
        ? {
            field: "totalYearsExperience",
            text: `${years} grounded years experience`,
            kind: "experience",
          }
        : null;
      conflicting = known && !supported;
    } else if (requirement.kind === "lifecycle") {
      record = implementationRecord;
    } else if (requirement.kind === "company") {
      const value = requirement.value || requirement.label;
      record = findText(
        [value],
        requirement.scope === "current" ? ["provider"] : undefined,
      );
      if (input.currentEmployer && bounded(input.currentEmployer, value))
        record = {
          field: "currentEmployer",
          text: input.currentEmployer,
          kind: "provider",
        };
    } else if (requirement.kind === "exclusion") {
      const found = findText([requirement.value || requirement.label]);
      conflicting = Boolean(found);
      record = found
        ? null
        : {
            field: "providerEvidence",
            text: `No candidate-owned evidence matched ${requirement.value || requirement.label}`,
            kind: "provider",
          };
    } else {
      const value = requirement.value || requirement.label;
      const kinds: SourceRecord["kind"][] | undefined =
        requirement.kind === "education"
          ? ["education"]
          : requirement.kind === "certification"
            ? ["certification"]
            : requirement.kind === "seniority"
              ? ["title", "experience"]
              : undefined;
      record = findText([value], kinds);
    }
    const state = record
      ? ("supported" as const)
      : conflicting
        ? ("conflicting" as const)
        : ("unverified" as const);
    return {
      id: requirement.id,
      label: requirement.label,
      kind: requirement.kind,
      state,
      evidence: record
        ? supportingEvidence(requirement.id, requirement.label, record, url)
        : null,
    };
  });
  const eligible = requirementEvaluations.every(
    (requirement) => requirement.state === "supported",
  );
  const groundedRequirementEvidence = requirementEvaluations.flatMap(
    (requirement) => (requirement.evidence ? [requirement.evidence] : []),
  );
  const rawEvidence = input.providerEvidence
    .filter((evidence) => evidence.excerpt.trim())
    .map((evidence) => ({ ...evidence, sourceUrl: evidence.sourceUrl || url }));
  const evidenceSeen = new Set<string>();
  const providerEvidence = [
    ...groundedRequirementEvidence,
    ...rawEvidence,
  ].filter((evidence) => {
    const key = normalized(evidence.excerpt);
    if (evidenceSeen.has(key)) return false;
    evidenceSeen.add(key);
    return true;
  });
  const supportedRequirements = requirementEvaluations.filter(
    (requirement) => requirement.state === "supported",
  ).length;
  const requirementCoverage = committedRequirements.length
    ? clamp((supportedRequirements / committedRequirements.length) * 100)
    : 0;
  const titleScore =
    bestTarget?.record.kind === "title"
      ? bestTarget.strength
      : plan.normalizedRoles.some(
            (role) => input.headline && bounded(input.headline, role),
          )
        ? 80
        : 0;
  const skillTargetCount = new Set(
    targetMatches
      .filter((match) => match.exact && match.record.kind === "skill")
      .map((match) => match.target.conceptId),
  ).size;
  const skillScore = targetConcepts.length
    ? clamp((skillTargetCount / targetConcepts.length) * 100)
    : clamp(
        (plan.requiredSkills.filter((skill) =>
          (input.skills || []).some((value) => bounded(value, skill)),
        ).length /
          Math.max(1, plan.requiredSkills.length)) *
          100,
      );
  const exactTargetCount = new Set(
    targetMatches
      .filter((match) => match.exact)
      .map((match) => match.target.conceptId),
  ).size;
  const keywordScore = targetConcepts.length
    ? clamp((exactTargetCount / targetConcepts.length) * 100)
    : clamp(
        (supportedRequirements / Math.max(1, committedRequirements.length)) *
          100,
      );
  const semanticScore = bestTarget?.exact
    ? clamp(75 + bestTarget.strength * 0.25)
    : bestTarget?.strength || 0;
  const locationScore = !plan.requiredLocations.length
    ? 0
    : requirementEvaluations.some(
          (requirement) =>
            requirement.kind === "location" &&
            requirement.state === "supported",
        )
      ? 100
      : 0;
  const employerScore = plan.targetCompanies.some(
    (company) =>
      input.currentEmployer && bounded(input.currentEmployer, company),
  )
    ? 100
    : 0;
  const deliveryScore = clamp(
    implementationEvidenceCount >= 6
      ? 100
      : implementationEvidenceCount >= 3
        ? 85
        : implementationEvidenceCount === 2
          ? 70
          : implementationEvidenceCount === 1
            ? 45
            : 0,
  );
  const criterionWeights = {
    most_important: 3,
    important: 2,
    nice_to_have: 1,
  } as const;
  let criterionWeightedScore = 0,
    criterionTotal = 0;
  const criterionEvaluations = plan.rankingCriteria.map((criterion) => {
    const weight = criterionWeights[criterion.importance];
    criterionTotal += weight;
    const criterionConcepts = conceptsInText(criterion.label);
    const asksForImplementationDepth =
      lifecyclePattern.test(criterion.label) &&
      /\b(?:depth|multiple|full|end[ -]?to[ -]?end|life[ -]?cycle|implementation)\b/i.test(
        criterion.label,
      );
    const directRecords = records.filter(
      (record) =>
        bounded(record.text, criterion.label) ||
        (criterionConcepts.length > 0 &&
          criterionConcepts.every((conceptId) =>
            recordSupportsConcept(record, conceptId),
          )),
    );
    const score = asksForImplementationDepth
      ? deliveryScore
      : directRecords.length
        ? Math.max(
            ...directRecords.map((record) =>
              record.kind === "title" ? 95 : record.kind === "skill" ? 85 : 75,
            ),
          )
        : 0;
    criterionWeightedScore += score * weight;
    return {
      id: criterion.id,
      label: criterion.label,
      importance: criterion.importance,
      score,
      evidenceCount: asksForImplementationDepth
        ? implementationEvidenceCount
        : directRecords.length,
    };
  });
  const criteriaScore = criterionTotal
    ? clamp(criterionWeightedScore / criterionTotal)
    : 0;
  const professional = clamp(
    titleScore * 0.35 +
      skillScore * 0.25 +
      keywordScore * 0.2 +
      semanticScore * 0.2,
  );
  const evidenceConfidence = Math.min(
    85,
    clamp(
      20 +
        Math.min(45, providerEvidence.length * 8) +
        Math.min(
          20,
          committedRequirements.length ? requirementCoverage * 0.2 : 0,
        ) +
        Math.min(15, implementationEvidenceCount * 5),
    ),
  );
  const overallMatchScore = canonicalOverallMatchScore({
    criteriaScore,
    hasCriteria: criterionTotal > 0,
    professionalRelevance: professional,
    deliveryDepth: deliveryScore,
    evidenceConfidence,
  });
  const rankingScore = overallMatchScore;
  const profileCompleteness = clamp(
    ([
      input.displayName,
      input.headline,
      input.location,
      input.currentEmployer,
      input.profileUrl,
      input.experienceSummary,
      (input.skills || []).length,
      (input.employmentText || []).length,
      (input.education || []).length,
      (input.certifications || []).length,
    ].filter(Boolean).length /
      10) *
      100,
  );
  const candidate: ExternalTalentCandidate = {
    ...input,
    currentTitle: input.currentTitle || input.headline,
    employmentText: input.employmentText || [],
    projectText: input.projectText || [],
    education: input.education || [],
    certifications: input.certifications || [],
    totalYearsExperience: input.totalYearsExperience ?? null,
    providerEvidence,
    requirementEvaluations,
    targetEvidence,
    requirementCoverage,
    rankingScore,
    keywordScore,
    semanticScore,
    skillScore,
    titleScore,
    employerScore,
    locationScore,
    criteriaScore,
    criterionEvaluations,
    deliveryScore,
    implementationEvidenceCount,
    evidenceConfidence,
    profileCompleteness,
    overallMatchScore,
    matchTier: externalMatchTier(overallMatchScore),
  };
  return { candidate, eligible };
}
export function scoreExternalCandidate(
  input: Parameters<typeof evaluateExternalCandidate>[0],
  plan: ExternalTalentSearchPlan,
): ExternalTalentCandidate | null {
  const evaluated = evaluateExternalCandidate(input, plan);
  return evaluated.eligible ? evaluated.candidate : null;
}
export function sortExternalCandidates(items: ExternalTalentCandidate[]) {
  return [...items].sort(
    (a, b) =>
      b.overallMatchScore - a.overallMatchScore ||
      b.evidenceConfidence - a.evidenceConfidence ||
      b.providerEvidence.length - a.providerEvidence.length ||
      b.profileCompleteness - a.profileCompleteness ||
      a.externalCandidateId.localeCompare(b.externalCandidateId),
  );
}
