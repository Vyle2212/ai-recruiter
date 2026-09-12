import {
  normalizeActualCandidateSchema,
  type EnterpriseProject,
} from "./candidate360SchemaNormalize";
import type { CandidateSearchV2Document } from "./candidateSearchV2Types";
import { redactSearchV2VisibleEvidence } from "./searchV2VisibleEvidence";
import { conceptsInText, searchConcept } from "./candidateSearchConcepts";

export const SEARCH_V2_LIFECYCLE_INDEX_VERSION =
  "candidate360-canonical-lifecycle-index-v20-strict-assignment-boundaries";

type LifecycleEvidence = NonNullable<
  CandidateSearchV2Document["lifecycleEvidence"]
>[number];
export type TargetModuleDeliveryAssignment = Readonly<{
  assignmentId: string;
  classification: "direct" | "adjacent" | "unsupported";
  reasonCode:
    | "direct_target_delivery"
    | "security_authorization_context"
    | "cross_module_integration_touchpoint"
    | "target_mentioned_without_delivery"
    | "generic_lifecycle_without_target";
  evidence: LifecycleEvidence;
  lifecycleEvidence: readonly LifecycleEvidence[];
  /** All grounded lifecycle labels on this canonical assignment. */
  lifecycleTypes: readonly string[];
}>;
export type TargetModuleDeliveryEvidence = Readonly<{
  totalGroundedProjects: number;
  directTargetAssignments: readonly TargetModuleDeliveryAssignment[];
  adjacentAssignments: readonly TargetModuleDeliveryAssignment[];
  unsupportedAssignments: readonly TargetModuleDeliveryAssignment[];
}>;

const normalized = (value: unknown) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
function recordContextConceptIds(project: EnterpriseProject, source: string, includeStructuredModules = false) {
  const concepts = new Set<string>();
  for (const value of [...(includeStructuredModules ? project.modules : []), source])
    for (const conceptId of conceptsInText(value)) concepts.add(conceptId);
  const text = normalized(source);
  const sapGrounded = /\bsap\b|\bs\/4hana\b|\becc\b/.test(text) || project.modules.some(value => /\bsap\b|\b(?:fi|co|fico)\b/i.test(value));
  if (sapGrounded && /\b(?:fi\/?co|fico|sap finance|sap controlling|general ledger|accounts payable|accounts receivable|asset accounting|cost center accounting|profit center accounting)\b/i.test(source))
    concepts.add("FICO");
  return [...concepts].sort();
}
const assignmentClauses=(value:string)=>value.split(/(?:\r?\n)+|(?<=[.!?;])\s+|\s+(?=(?:in charge|duties|responsibilities|deliverables|project\s*:|client\s*:)[\s:])/i).map(item=>item.trim()).filter(Boolean);

export function canonicalLifecycleAssignmentId(
  item: NonNullable<CandidateSearchV2Document["lifecycleEvidence"]>[number],
) {
  // Compatibility for already-persisted v3 snapshots: those snapshots used a
  // sentence ordinal as the project id. It is not an assignment identity and
  // must not multiply delivery depth while the v4 snapshot is rebuilding.
  if (
    /^resume\.narrativeProjects\.\d+(?:\.|$)/i.test(item.sourceField) &&
    /:resume-narrative-project-\d+$/i.test(item.projectId)
  )
    return `${item.sourceRecordId}:resume-narrative-unattributed`;
  return item.projectId;
}

const regexEscape = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function targetLiteralPattern(targetConcept: string) {
  if (targetConcept === "FICO")
    return /\b(?:sap\s+)?(?:fi\s*[/&-]\s*co|fico|fi\s+and\s+co|financial accounting|controlling|general ledger|accounts payable|accounts receivable|asset accounting|financial closing)\b/i;
  const concept = searchConcept(targetConcept);
  const values = [
    concept?.label,
    ...(concept?.aliases || []),
    ...(concept?.contextAliases || []),
  ]
    .filter((value): value is string => Boolean(value && value.length >= 2))
    .sort((left, right) => right.length - left.length);
  return values.length
    ? new RegExp(`(?:^|[^a-z0-9])(?:${values.map(regexEscape).join("|")})(?:$|[^a-z0-9])`, "i")
    : new RegExp(`(?:^|[^a-z0-9])${regexEscape(targetConcept)}(?:$|[^a-z0-9])`, "i");
}

/**
 * Classifies delivery at the assignment boundary. Candidate skills and target
 * evidence outside these project records are intentionally not inputs.
 */
export function targetModuleDeliveryEvidence(
  candidate: Pick<CandidateSearchV2Document, "lifecycleEvidence">,
  targetConcept: string,
): TargetModuleDeliveryEvidence {
  const byAssignment = new Map<string, LifecycleEvidence[]>();
  for (const item of candidate.lifecycleEvidence || []) {
    const id = canonicalLifecycleAssignmentId(item);
    byAssignment.set(id, [...(byAssignment.get(id) || []), item]);
  }
  const targetPattern = targetLiteralPattern(targetConcept);
  const assignments: TargetModuleDeliveryAssignment[] = [];
  for (const [assignmentId, records] of byAssignment) {
    const text = [...new Set(records.map((item) => item.excerpt).filter(Boolean))].join(" ");
    const targetMentioned = targetPattern.test(text);
    const securityContext =
      /\b(?:security|grc|authori[sz]ation|user administration|role maintenance|maintain roles?|access control|segregation of duties|\bsod\b|fire fighter)\b/i.test(text);
    const crossModuleIntegration =
      /\b(?:integration|integrating|integrated|interface|touchpoint)\b[^.]{0,100}\b(?:fi\s*[/&-]\s*co|fico|sap\s+fi|sap\s+co)\b/i.test(text) &&
      /\b(?:mm|material management|procurement|purchasing|ptp|ariba|sd|pp)\b/i.test(text);
    const directRole =
      /\b(?:role|position)\s*:\s*[^.;\n]{0,70}\b(?:fi\s*[/&-]\s*co|fico|sap\s+fi|sap\s+co)\b[^.;\n]{0,50}\b(?:consultant|analyst|lead|specialist|conversion|migration)\b/i.test(text) ||
      /\b(?:sap\s+)?(?:fi\s*[/&-]\s*co|fico)\s+(?:functional\s+)?(?:consultant|analyst|lead|specialist|conversion|data migration)\b/i.test(text);
    const targetDeliveryPhrase = new RegExp(
      `(?:${targetPattern.source})[^.]{0,90}\\b(?:implement(?:ation|ed|ing)?|configur(?:ation|ed|ing)?|conversion|migrat(?:ion|ed|ing)?|test(?:ing|ed)?|cutover|go[ -]?live|rollout|support(?:ed|ing)?|process design|deliver(?:y|ed|ing)?|own(?:ed|ership)?)\\b|\\b(?:implement(?:ation|ed|ing)?|configur(?:ation|ed|ing)?|conversion|migrat(?:ion|ed|ing)?|test(?:ing|ed)?|cutover|go[ -]?live|rollout|support(?:ed|ing)?|process design|deliver(?:y|ed|ing)?|own(?:ed|ership)?)\\b[^.]{0,90}(?:${targetPattern.source})`,
      "i",
    );
    const financialAreaDelivery =
      /\b(?:implement(?:ed|ation|ing)?|configur(?:ed|ation|ing)?|conversion|migrat(?:ed|ion|ing)?|test(?:ed|ing)?|cutover|go[ -]?live|support(?:ed|ing)?|design(?:ed|ing)?|owned?)\b[^.]{0,90}\b(?:general ledger|accounts payable|accounts receivable|asset accounting|financial closing|cost center accounting|profit center accounting)\b/i.test(text) ||
      /\b(?:general ledger|accounts payable|accounts receivable|asset accounting|financial closing|cost center accounting|profit center accounting)\b[^.]{0,90}\b(?:implement(?:ed|ation|ing)?|configur(?:ed|ation|ing)?|conversion|migrat(?:ed|ion|ing)?|test(?:ed|ing)?|cutover|go[ -]?live|support(?:ed|ing)?|design(?:ed|ing)?|owned?)\b/i.test(text);
    const meaningfulDelivery =
      directRole ||
      targetDeliveryPhrase.test(text) ||
      financialAreaDelivery ||
      (targetMentioned &&
        records.some((item) =>
          [
            "Implementation",
            "Rollout",
            "Migration",
            "Support / Enhancement",
            "Configuration",
            "Go-live",
            "Delivery responsibility",
          ].includes(item.lifecycleType),
        ));
    const disqualifiedContext =
      (securityContext && !directRole && !financialAreaDelivery) ||
      (crossModuleIntegration && !directRole && !financialAreaDelivery);
    const representative =
      records.find(
        (item) =>
          targetPattern.test(item.excerpt) &&
          !/^\s*(implementation|integration|migration|rollout|support(?: \/ enhancement)?|configuration)(?:\s+\1)?\s*$/i.test(item.excerpt),
      ) || records.find((item) => targetPattern.test(item.excerpt)) || records[0];
    const classification =
      targetMentioned && meaningfulDelivery && !disqualifiedContext
        ? "direct"
        : targetMentioned ||
            records.some((item) =>
              (item.contextConceptIds || []).includes(targetConcept),
            )
          ? "adjacent"
          : "unsupported";
    const reasonCode =
      classification === "direct"
        ? "direct_target_delivery"
        : securityContext
          ? "security_authorization_context"
          : crossModuleIntegration
            ? "cross_module_integration_touchpoint"
            : classification === "adjacent"
              ? "target_mentioned_without_delivery"
              : "generic_lifecycle_without_target";
    assignments.push({
      assignmentId,
      classification,
      reasonCode,
      evidence: representative,
      lifecycleEvidence: records,
      lifecycleTypes: [...new Set(records.map((item) => item.lifecycleType))].sort(),
    });
  }
  return {
    totalGroundedProjects: byAssignment.size,
    directTargetAssignments: assignments.filter((item) => item.classification === "direct"),
    adjacentAssignments: assignments.filter((item) => item.classification === "adjacent"),
    unsupportedAssignments: assignments.filter((item) => item.classification === "unsupported"),
  };
}

export function readableLifecycleEvidenceLabel(
  evidence: LifecycleEvidence,
  targetLabel: string,
) {
  const cleaned = redactSearchV2VisibleEvidence(evidence.excerpt)
    .replace(/^\s*(implementation|integration|migration|rollout|support \/ enhancement|configuration)\s+\1\s+/i, "$1 ")
    .replace(/\s*[?]+\s*$/g, "")
    .trim();
  if (!cleaned || /^(?:implementation|integration|migration|rollout|support \/ enhancement|configuration)(?:\s+(?:fi|co|fico))?$/i.test(cleaned))
    return `${targetLabel} ${evidence.lifecycleType.toLowerCase()} assignment`;
  return cleaned.slice(0, 220);
}

const lifecycleRules: ReadonlyArray<readonly [string, RegExp]> = [
  ["Implementation", /\b(?:implementation|implemented|greenfield|brownfield|full[ -]?life[ -]?cycle)\b/i],
  ["Rollout", /\b(?:rollout|roll-out|rolled out)\b/i],
  ["Migration", /\b(?:migration|migrated|migrating)\b/i],
  ["Integration", /\b(?:integration|integrated|integrating)\b/i],
  ["Support / Enhancement", /\b(?:support|supported|enhancement|enhanced|ams)\b/i],
  ["Configuration", /\b(?:configuration|configured|configuring)\b/i],
  ["Upgrade", /\b(?:upgrade|upgraded|upgrading)\b/i],
  ["Transformation", /\b(?:transformation|transformed|transforming)\b/i],
  ["Go-live", /\b(?:go-live|go live|cutover)\b/i],
  ["Delivery responsibility", /\b(?:delivered|delivery|responsible for|owned|ownership)\b/i],
  ["Project leadership", /\b(?:led|lead|managed|project manager|program manager)\b/i],
];

const criterionScopedLifecycleLabels = new Set([
  "Implementation",
  "Rollout",
  "Migration",
  "Integration",
  "Support / Enhancement",
  "Configuration",
  "Upgrade",
  "Transformation",
  "Go-live",
]);

/** Generic "delivery depth" remains lifecycle-agnostic. */
export function lifecycleScopeFromCriterion(label: string) {
  return lifecycleRules
    .filter(
      ([lifecycleType, pattern]) =>
        criterionScopedLifecycleLabels.has(lifecycleType) && pattern.test(label),
    )
    .map(([lifecycleType]) => lifecycleType);
}

export function assignmentSupportsLifecycle(
  assignment: TargetModuleDeliveryAssignment,
  lifecycleTypes: readonly string[],
) {
  if (!lifecycleTypes.length) return true;
  return lifecycleTypes.some((required) =>
    assignment.lifecycleTypes.some(
      (actual) => normalized(actual) === normalized(required),
    ),
  );
}

export function canonicalLifecycleEvidence(
  candidateId: string,
  projects: readonly EnterpriseProject[],
): NonNullable<CandidateSearchV2Document["lifecycleEvidence"]> {
  const indexed: NonNullable<CandidateSearchV2Document["lifecycleEvidence"]>[number][] = [];
  for (const project of projects) {
    const source = [
      project.projectType,
      project.implementationType,
      project.name,
      project.role,
      ...project.responsibilities,
    ]
      .filter(Boolean)
      .join(" ");
    const provenance = Object.values(project.fieldEvidence)
      .flatMap((field) => field?.provenance || [])
      .find((item) => item.sourceRef || item.fieldPath);
    if (!source || !provenance) continue;
    const structuredContext=[project.projectType,project.implementationType,project.name,project.role].filter(Boolean).join(" ");
    const clauses=[structuredContext,...project.responsibilities.flatMap(assignmentClauses)].filter(Boolean);
    for (const [lifecycleType, pattern] of lifecycleRules) {
      const matchingClauses=clauses.map((clause,index)=>({clause,index})).filter(item=>pattern.test(item.clause));
      if (!matchingClauses.length) continue;
      const contextConceptIds=[...new Set(matchingClauses.flatMap(item=>recordContextConceptIds(project,item.clause,item.index===0)))].sort();
      const strongestClause = (lifecycleType === "Support / Enhancement" ? [...matchingClauses].sort((left, right) => {
        const strength = (item: { clause: string; index: number }) =>
          recordContextConceptIds(project, item.clause, item.index === 0).length * 20 +
          Number(/\b(?:configur|implement|migrat|support|cutover|go-live|deliver|responsible|provide|troubleshoot|break\s*\/\s*fix)/i.test(item.clause)) * 10 +
          Math.min(9, Math.floor(item.clause.length / 40));
        return strength(right) - strength(left) || left.index - right.index;
      }) : matchingClauses)[0];
      const excerpt=redactSearchV2VisibleEvidence(strongestClause.clause).slice(0,320);
      indexed.push({
        projectId: `${candidateId}:${project.id}`,
        lifecycleType,
        sourceType:
          provenance.sourceType === "candidate_confirmation" ||
          provenance.sourceType === "recruiter_confirmation" ||
          provenance.sourceType === "system_derived"
            ? "candidate_field"
            : provenance.sourceType,
        sourceField: provenance.fieldPath || provenance.sourceRef || "candidate.projects",
        sourceRecordId: candidateId,
        excerpt,
        evidenceLevel:
          project.evidenceState === "verified" ? "verified" : "supported",
        modules: project.modules,
        contextConceptIds,
      });
    }
  }
  return [...new Map(indexed.map((item) => [`${item.projectId}:${item.lifecycleType}`, item])).values()];
}

export function lifecycleRecordSupportsRequirement(
  item: NonNullable<CandidateSearchV2Document["lifecycleEvidence"]>[number],
  lifecycleValues: readonly string[],
  operator: "any" | "all",
  contextConceptIds: readonly string[] = [],
) {
  const lifecycleMatches = lifecycleValues.map(value => normalized(item.lifecycleType) === normalized(value));
  const lifecyclePasses = operator === "all" ? lifecycleMatches.every(Boolean) : lifecycleMatches.some(Boolean);
  if (!lifecyclePasses) return false;
  if (!contextConceptIds.length) return true;
  const recordConcepts = new Set(item.contextConceptIds || item.modules.flatMap(value => conceptsInText(value)));
  return contextConceptIds.some(conceptId => recordConcepts.has(conceptId));
}

export type ProjectRequirementStatus = "supports" | "related_context" | "related_lifecycle" | "unrelated";
export type CanonicalProjectRequirementClassification = Readonly<{
  assignmentId: string;
  targetConcept: string | null;
  deliveryClassification: "direct" | "adjacent" | "unsupported";
  reasonCode: TargetModuleDeliveryAssignment["reasonCode"];
  lifecycleTypes: readonly string[];
  satisfiesRequirement: boolean;
  contributesToDirectDepth: boolean;
  status: ProjectRequirementStatus;
  explanation: string;
}>;

/** One assignment-scoped decision shared by scoring diagnostics and project UI. */
export function canonicalProjectRequirementClassification(
  candidateId: string,
  project: EnterpriseProject,
  requirementLabel: string,
): CanonicalProjectRequirementClassification {
  const indexed = canonicalLifecycleEvidence(candidateId, [project]);
  const targetConcept = conceptsInText(requirementLabel)[0] || null;
  const lifecycleValues = lifecycleRules
    .map(([label]) => label)
    .filter((label) => normalized(requirementLabel).includes(normalized(label)));
  const lifecycleTypes = [...new Set(indexed.map((item) => item.lifecycleType))];
  const targetEvidence = targetConcept
    ? targetModuleDeliveryEvidence({ lifecycleEvidence: indexed }, targetConcept)
    : null;
  const targetDecision = targetEvidence
    ? [
        ...targetEvidence.directTargetAssignments,
        ...targetEvidence.adjacentAssignments,
        ...targetEvidence.unsupportedAssignments,
      ][0]
    : undefined;
  const deliveryClassification = targetDecision?.classification || "unsupported";
  const lifecycleSupported = !lifecycleValues.length || lifecycleValues.some(
    (required) => lifecycleTypes.some((actual) => normalized(actual) === normalized(required)),
  );
  const satisfiesRequirement = deliveryClassification === "direct" && lifecycleSupported;
  const status: ProjectRequirementStatus = satisfiesRequirement
    ? "supports"
    : deliveryClassification === "direct" || deliveryClassification === "adjacent"
      ? "related_context"
      : lifecycleValues.some((required) => lifecycleTypes.some((actual) => normalized(actual) === normalized(required)))
        ? "related_lifecycle"
        : "unrelated";
  const reasonCode = targetDecision?.reasonCode || "generic_lifecycle_without_target";
  const targetLabel = targetConcept === "FICO" ? "SAP FICO" : targetConcept || "target module";
  const explanation = satisfiesRequirement
    ? `Direct ${targetLabel} delivery and the required lifecycle are grounded in this assignment.`
    : deliveryClassification === "direct"
      ? `Direct ${targetLabel} delivery is grounded, but this assignment does not establish the required lifecycle.`
      : deliveryClassification === "adjacent"
        ? `${targetLabel} is mentioned in this assignment without direct target-module delivery responsibility.`
        : status === "related_lifecycle"
          ? `The lifecycle is grounded, but direct ${targetLabel} delivery is not established in this assignment.`
          : `Neither direct ${targetLabel} delivery nor the required lifecycle is grounded in this assignment.`;
  return {
    assignmentId: indexed[0] ? canonicalLifecycleAssignmentId(indexed[0]) : `${candidateId}:${project.id}`,
    targetConcept,
    deliveryClassification,
    reasonCode,
    lifecycleTypes,
    satisfiesRequirement,
    contributesToDirectDepth: deliveryClassification === "direct",
    status,
    explanation,
  };
}

export function projectRequirementStatus(
  candidateId: string,
  project: EnterpriseProject,
  requirementLabel: string,
): ProjectRequirementStatus {
  return canonicalProjectRequirementClassification(candidateId, project, requirementLabel).status;
}

// Snapshot-construction route only. Interactive hard filters consume the
// immutable lifecycleEvidence index and never normalize Candidate 360 data.
export function canonicalLifecycleEvidenceFromCandidateSource(
  candidateId: string,
  sourceRecord: Record<string, unknown> | undefined,
) {
  if (!sourceRecord) return [];
  return canonicalLifecycleEvidence(
    candidateId,
    normalizeActualCandidateSchema(sourceRecord).enterpriseProfile.projects,
  );
}
