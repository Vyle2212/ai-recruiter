import {
  canonicalSearchConcept,
  conceptsInText,
  lifecycleTermsInText,
  mostSpecificSearchConcepts,
  searchConcept,
  searchConceptRelation,
} from "./candidateSearchConcepts";
import { normalizeCandidateSearchV2Request } from "./candidateSearchV2Request";
import type {
  CandidateSearchV2Document,
  CandidateSearchV2Request,
  CandidateSearchV2Result,
  TrustedCandidateEvidenceValue,
} from "./candidateSearchV2Types";
import {
  identityBoundTrustedCandidateValues,
  isCentralNicheTarget,
  qualifyNicheTargetEvidence,
} from "./nicheTargetEvidence";
import {
  candidateMeetsRequiredLocation,
  requiredLocationAlternatives,
  requiredLocationDisplay,
  type RequiredLocationAlternative,
} from "./searchV2RequiredLocation";
import {
  canonicalLanguage,
  experienceRangeInText,
  languagesInText,
  professionalRolesInText,
  seniorityInText,
} from "./searchV2RequirementOntology";
import type {
  CandidateSearchCriterion,
  CandidateSearchTalentPool,
} from "./candidateSearchV2Types";
import {
  evaluateSearchCriteria,
  dedupeSearchCriteria,
} from "./searchV2Criteria";
import {
  canonicalMatchLabel,
  canonicalOverallMatchScore,
  SEARCH_V2_RANKING_VERSION,
} from "./searchV2Match";
import {
  canonicalLifecycleAssignmentId,
  lifecycleRecordSupportsRequirement,
  targetModuleDeliveryEvidence,
} from "./searchV2Lifecycle";
export const COMMITTED_SEARCH_REQUIREMENTS_VERSION =
  "search-v2-committed-requirements-v3-compound-lifecycle";
export type RequirementSource =
  | "query"
  | "jd"
  | "clarification"
  | "manual_filter"
  | "criterion_promotion"
  | "guided"
  | "history"
  | "ai_suggestion"
  | "prepared";
export type CommittedSearchRequirement =
  | Readonly<{
      id: string;
      kind: "target";
      label: string;
      conceptId: string;
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "professional_role";
      label: string;
      roleId: string;
      alternatives: readonly string[];
      titleScope: "current" | "any";
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "location";
      label: string;
      alternatives: readonly RequiredLocationAlternative[];
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "experience";
      label: string;
      minimum: number | null;
      maximum: number | null;
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "seniority";
      label: string;
      value: string;
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "company";
      label: string;
      value: string;
      scope: "current" | "any";
      conceptId: null;
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind: "lifecycle";
      label: string;
      value: string;
      values: readonly string[];
      operator: "any" | "all";
      conceptId: string | null;
      contextConceptIds: readonly string[];
      source: RequirementSource;
    }>
  | Readonly<{
      id: string;
      kind:
        | "skill"
        | "sap_module"
        | "language"
        | "industry"
        | "education"
        | "certification"
        | "exclusion";
      label: string;
      value: string;
      conceptId: string | null;
      source: RequirementSource;
    }>;
export type CommittedSearchRequirements = Readonly<{
  version: typeof COMMITTED_SEARCH_REQUIREMENTS_VERSION;
  query: string;
  normalizedQuery: string;
  summary: string;
  semanticIdentity: string;
  includeRelocationRemote: boolean;
  talentPool: CandidateSearchTalentPool;
  criteria: readonly CandidateSearchCriterion[];
  clarificationAnswers: Readonly<Record<string, string | string[]>>;
  requirements: readonly CommittedSearchRequirement[];
}>;
export type CommittedRequirementState =
  "verified" | "supported" | "related" | "missing" | "conflicting";
export type CommittedRequirementEvaluation = Readonly<{
  id: string;
  criterionId: string;
  label: string;
  kind: CommittedSearchRequirement["kind"];
  required: true;
  state: CommittedRequirementState;
  reason: string;
  provenance: Readonly<{
    candidateId: string;
    sourceRecordId: string | null;
    sourceType: string;
    sourceField: string | null;
    matchedLiteral: string | null;
    qualificationLevel: CommittedRequirementState;
    trusted: boolean;
  }> | null;
}>;
export type CommittedCandidateEvaluation = Readonly<{
  version: typeof COMMITTED_SEARCH_REQUIREMENTS_VERSION;
  semanticIdentity: string;
  eligible: boolean;
  broadeningApplied: boolean;
  requirements: readonly CommittedRequirementEvaluation[];
  verified: number;
  supported: number;
  attention: number;
  matchedLocation: string | null;
}>;
export type SearchV2ExclusionFunnelItem = Readonly<{
  requirementId: string;
  label: string;
  kind: CommittedSearchRequirement["kind"];
  entering: number;
  excluded: number;
  remaining: number;
  evaluated: boolean;
  evidencePolicy: string;
  explanation: string;
}>;
export type SearchV2EligibilityDiagnostic = Readonly<{
  selectedPool: CandidateSearchTalentPool;
  poolPopulation: number;
  emptyPool: boolean;
  funnel: readonly SearchV2ExclusionFunnelItem[];
}>;
export type CommittedPopulationEvaluation = Readonly<{
  eligibleCandidateIds: ReadonlySet<string>;
  evaluations: ReadonlyMap<string, CommittedCandidateEvaluation>;
  diagnostic: SearchV2EligibilityDiagnostic;
}>;
export type SearchV2HardFilterProfile = Readonly<{
  requirementPreparationMs: number;
  candidateProjectionAccessMs: number;
  roleTitleLookupMs: number;
  locationLookupMs: number;
  experienceLookupMs: number;
  seniorityLookupMs: number;
  languageLookupMs: number;
  deliveryLookupMs: number;
  evidenceConstructionMs: number;
  funnelAggregationMs: number;
  regexOrTextScanMs: number;
  canonicalizationMs: number;
  diagnosticSerializationMs: number;
  candidateRequirementEvaluations: number;
  cacheHits: number;
  cacheMisses: number;
  byKind: Readonly<Record<string, { calls: number; ms: number }>>;
}>;
export type CanonicalHardRequirementSection =
  | "general"
  | "location"
  | "experience"
  | "relevantExperience"
  | "company"
  | "industry"
  | "skills"
  | "delivery"
  | "education"
  | "languages"
  | "certifications"
  | "availability"
  | "authorization"
  | "status"
  | "exclusions";
export function canonicalHardRequirementCounts(
  committed: Pick<CommittedSearchRequirements, "requirements">,
) {
  const counts: Record<CanonicalHardRequirementSection, number> = {
    general: 0,
    location: 0,
    experience: 0,
    relevantExperience: 0,
    company: 0,
    industry: 0,
    skills: 0,
    delivery: 0,
    education: 0,
    languages: 0,
    certifications: 0,
    availability: 0,
    authorization: 0,
    status: 0,
    exclusions: 0,
  };
  for (const requirement of committed.requirements) {
    const section: CanonicalHardRequirementSection =
      requirement.kind === "location"
        ? "location"
        : requirement.kind === "experience"
          ? "experience"
          : requirement.kind === "company"
            ? "company"
            : requirement.kind === "industry"
              ? "industry"
              : requirement.kind === "education"
                ? "education"
                : requirement.kind === "certification"
                  ? "certifications"
                  : requirement.kind === "language"
                    ? "languages"
                    : requirement.kind === "lifecycle"
                      ? "delivery"
                      : requirement.kind === "exclusion"
                        ? "exclusions"
                        : ["professional_role", "seniority"].includes(
                              requirement.kind,
                            )
                          ? "general"
                          : "skills";
    counts[section] += 1;
  }
  return { counts, total: committed.requirements.length };
}
const norm = (v: unknown) =>
  String(v || "")
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundedRegexCache = new Map<string, RegExp>();
const boundedNormalized = (source: string, literal: string) => {
  const key = norm(literal);
  let regex = boundedRegexCache.get(key);
  if (!regex) {
    regex = new RegExp(`(?:^|[^a-z0-9])${esc(key)}(?:$|[^a-z0-9])`, "i");
    boundedRegexCache.set(key, regex);
  }
  return regex.test(source);
};
const entryBounded = (entry: TrustedCandidateEvidenceValue, literal: string) =>
  boundedNormalized(entry.normalizedValue || norm(entry.value), literal);
const bounded = (s: string, l: string) =>
  new RegExp(`(?:^|[^a-z0-9])${esc(norm(l))}(?:$|[^a-z0-9])`, "i").test(
    norm(s),
  );
const unique = (v: string[]) => [
  ...new Map(v.filter(Boolean).map((x) => [norm(x), x])).values(),
];
const professionalRoleAlternatives = (
  role: ReturnType<typeof professionalRolesInText>[number],
) =>
  role.id === "consultant"
    ? [
        ...role.aliases,
        "functional consultant",
        "technical consultant",
        "specialist",
        "lead",
      ]
    : role.aliases;
const hash = (v: string) => {
  let h = 2166136261;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const evaluationCache = new WeakMap<
  CandidateSearchV2Document,
  Map<string, CommittedRequirementEvaluation>
>();
const indexedTargetCache = new WeakMap<
  CandidateSearchV2Document,
  ReadonlySet<string>
>();
function indexedTargets(candidate: CandidateSearchV2Document) {
  const cached = indexedTargetCache.get(candidate);
  if (cached) return cached;
  const targets = new Set<string>();
  for (const conceptId of candidate.searchConceptIds || [])
    targets.add(String(conceptId).toUpperCase());
  for (const [conceptId, evidence] of Object.entries(
    candidate.searchTargetEvidence || {},
  ))
    if (evidence && evidence.tier !== "none" && evidence.tier !== "related")
      targets.add(conceptId.toUpperCase());
  if (targets.size) {
    indexedTargetCache.set(candidate, targets);
    return targets;
  }
  for (const value of [
    ...(candidate.sapModules || []),
    ...(candidate.skills || []),
  ]) {
    const concept = canonicalSearchConcept(value);
    if (concept) targets.add(concept);
  }
  for (const entry of identityBoundTrustedCandidateValues(candidate).filter(
    (item) =>
      item.sourceType === "raw_title" || item.sourceType === "direct_skill",
  ))
    for (const concept of conceptsInText(entry.value)) targets.add(concept);
  indexedTargetCache.set(candidate, targets);
  return targets;
}
function cachedEvaluation(
  candidate: CandidateSearchV2Document,
  req: CommittedSearchRequirement,
) {
  let candidateCache = evaluationCache.get(candidate);
  if (!candidateCache) {
    candidateCache = new Map();
    evaluationCache.set(candidate, candidateCache);
  }
  const key = JSON.stringify(req);
  const cached = candidateCache.get(key);
  if (cached) return { value: cached, hit: true };
  const value = evaluation(candidate, req);
  candidateCache.set(key, value);
  return { value, hit: false };
}
export function buildCommittedSearchRequirements(
  raw: CandidateSearchV2Request,
  source: RequirementSource = "query",
): CommittedSearchRequirements {
  const r = normalizeCandidateSearchV2Request(raw),
    rawAnswerValues = (id: string) => {
      const value = r.clarificationAnswers[id];
      return Array.isArray(value) ? value : value ? [value] : [];
    },
    answerValues = (id: string) =>
      rawAnswerValues(id).filter(
        (value) => !/^(?:no preference|skip)$/i.test(value),
      ),
    targets = mostSpecificSearchConcepts([
      ...conceptsInText(r.query),
      ...(r.filters.skills || [])
        .map(canonicalSearchConcept)
        .filter((v): v is string => Boolean(v)),
      ...(r.filters.sapModules || [])
        .map(canonicalSearchConcept)
        .filter((v): v is string => Boolean(v)),
    ]);
  const queryLocations = requiredLocationAlternatives(r.query),
    filterLocations = requiredLocationAlternatives("", [
      ...(r.filters.countries || []),
      ...(r.filters.locations || []),
    ]),
    locationResolution = rawAnswerValues("conflict_location").join(" ");
  const locations = /description\/jd/i.test(locationResolution)
      ? queryLocations
      : /filter locations/i.test(locationResolution)
        ? filterLocations
        : /no preference/i.test(locationResolution)
          ? []
          : requiredLocationAlternatives(r.query, [
              ...(r.filters.countries || []),
              ...(r.filters.locations || []),
              ...answerValues("location"),
            ]),
    requirements: CommittedSearchRequirement[] = targets.map((conceptId) => ({
      id: `target:${conceptId}`,
      kind: "target",
      label: searchConcept(conceptId)?.label || conceptId,
      conceptId,
      source,
    }));
  const confirmedTitleScope = answerValues("title_scope").some((value) =>
    /current job title/i.test(value),
  )
    ? "current"
    : "any";
  for (const role of professionalRolesInText(r.query))
    requirements.push({
      id: `professional-role:${role.id}`,
      kind: "professional_role",
      label: role.label,
      roleId: role.id,
      alternatives: professionalRoleAlternatives(role),
      titleScope: confirmedTitleScope,
      source,
    });
  for (const title of r.filters.currentTitles || [])
    requirements.push({
      id: `professional-role:current:${norm(title)}`,
      kind: "professional_role",
      label: title,
      roleId: `current:${norm(title)}`,
      alternatives: [title],
      titleScope: "current",
      source: "manual_filter",
    });
  for (const title of r.filters.anyTitles || []) {
    const role = professionalRolesInText(title)[0];
    requirements.push(
      role
        ? {
            id: `professional-role:${role.id}`,
            kind: "professional_role",
            label: role.label,
            roleId: role.id,
            alternatives: professionalRoleAlternatives(role),
            titleScope: "any",
            source: "manual_filter",
          }
        : {
            id: `professional-role:any:${norm(title)}`,
            kind: "professional_role",
            label: title,
            roleId: `any:${norm(title)}`,
            alternatives: [title],
            titleScope: "any",
            source: "manual_filter",
          },
    );
  }
  for (const value of r.filters.professionalRoles || []) {
    const role = professionalRolesInText(value)[0];
    requirements.push({
      id: `professional-role:${role?.id || norm(value)}`,
      kind: "professional_role",
      label: role?.label || value,
      roleId: role?.id || norm(value),
      alternatives: role ? professionalRoleAlternatives(role) : [value],
      titleScope: "any",
      source: "manual_filter",
    });
  }
  if (locations.length)
    requirements.push({
      id: "location:required",
      kind: "location",
      label: `Location: ${requiredLocationDisplay(locations)} · Required`,
      alternatives: locations,
      source:
        r.filters.countries?.length || r.filters.locations?.length
          ? "manual_filter"
          : source,
    });
  const queryExperience = experienceRangeInText(r.query),
    answerExperience = experienceRangeInText(
      answerValues("experience").join(" "),
    ),
    minimum =
      r.filters.minimumTotalYearsExperience ??
      queryExperience?.minimum ??
      answerExperience?.minimum ??
      null,
    maximum =
      r.filters.maximumTotalYearsExperience ??
      queryExperience?.maximum ??
      answerExperience?.maximum ??
      null;
  if (minimum !== null || maximum !== null)
    requirements.push({
      id: "experience:total",
      kind: "experience",
      label:
        minimum !== null
          ? `Experience: ${minimum}+ years`
          : `Experience: up to ${maximum} years`,
      minimum,
      maximum,
      source:
        r.filters.minimumTotalYearsExperience !== undefined ||
        r.filters.maximumTotalYearsExperience !== undefined
          ? "manual_filter"
          : source,
    });
  const seniority = seniorityInText(r.query);
  if (seniority)
    requirements.push({
      id: `seniority:${norm(seniority)}`,
      kind: "seniority",
      label: `Seniority: ${seniority}`,
      value: seniority,
      source,
    });
  for (const value of r.filters.seniorities || [])
    requirements.push({
      id: `seniority:${norm(value)}`,
      kind: "seniority",
      label: `Seniority: ${value}`,
      value,
      source: "manual_filter",
    });
  for (const value of r.filters.currentEmployers || [])
    requirements.push({
      id: `company:current:${norm(value)}`,
      kind: "company",
      label: `Current company: ${value}`,
      value,
      scope: "current",
      conceptId: null,
      source: "manual_filter",
    });
  for (const value of r.filters.anyEmployers || [])
    requirements.push({
      id: `company:any:${norm(value)}`,
      kind: "company",
      label: `Any company: ${value}`,
      value,
      scope: "any",
      conceptId: null,
      source: "manual_filter",
    });
  const targetSet = new Set(targets),
    add = (
      kind: "skill" | "sap_module" | "language",
      values: string[],
      requirementSource: RequirementSource = "manual_filter",
    ) => {
      for (const value of unique(values)) {
        const conceptId = canonicalSearchConcept(value);
        if (conceptId && targetSet.has(conceptId)) continue;
        requirements.push({
          id: `${kind}:${norm(value)}`,
          kind,
          label:
            kind === "language"
              ? `Language: ${value}`
              : kind === "sap_module"
                ? `SAP module: ${value}`
                : value,
          value,
          conceptId,
          source: requirementSource,
        });
      }
    };
  add("skill", r.filters.skills || []);
  add("sap_module", r.filters.sapModules || []);
  const queryLanguages = languagesInText(r.query).map((item) => item.label),
    filterLanguages = (r.filters.languages || []).map(
      (value) => canonicalLanguage(value)?.label || value,
    ),
    languageResolution = rawAnswerValues("conflict_language").join(" "),
    resolvedLanguages = /description\/jd/i.test(languageResolution)
      ? queryLanguages
      : /filter languages/i.test(languageResolution)
        ? filterLanguages
        : /no preference/i.test(languageResolution)
          ? []
          : [
              ...filterLanguages,
              ...queryLanguages,
              ...answerValues("language").map(
                (value) => canonicalLanguage(value)?.label || value,
              ),
            ];
  add(
    "language",
    unique(resolvedLanguages),
    filterLanguages.length
      ? "manual_filter"
      : answerValues("language").length
        ? "clarification"
        : source,
  );
  const lifecycleValues = unique([
    ...lifecycleTermsInText(r.query),
    ...(r.filters.deliveryExperience || []),
    ...answerValues("delivery"),
  ]);
  if (lifecycleValues.length) {
    const operator =
      r.filters.deliveryExperienceOperator === "all" ? "all" : "any";
    const contextConceptIds = [...targets];
    const contextLabel =
      contextConceptIds.length === 1
        ? searchConcept(contextConceptIds[0])?.label
        : null;
    requirements.push({
      id:
        lifecycleValues.length === 1
          ? `lifecycle:${norm(lifecycleValues[0])}`
          : `lifecycle-group:${operator}:${lifecycleValues.map(norm).sort().join("|")}`,
      kind: "lifecycle",
      label:
        lifecycleValues.length === 1
          ? `${contextLabel ? `${contextLabel} ` : ""}${lifecycleValues[0]}`
          : `${operator === "all" ? "All of" : "Any of"}: ${lifecycleValues.join(", ")}`,
      value: lifecycleValues[0],
      values: lifecycleValues,
      operator,
      conceptId: contextConceptIds.length === 1 ? contextConceptIds[0] : null,
      contextConceptIds,
      source: r.filters.deliveryExperience?.length
        ? "manual_filter"
        : answerValues("delivery").length
          ? "clarification"
          : source,
    });
  }
  for (const [language, proficiency] of Object.entries(
    r.filters.languageProficiencies || {},
  ))
    requirements.push({
      id: `language-proficiency:${norm(language)}:${norm(proficiency)}`,
      kind: "language",
      label: `Language proficiency: ${language} · ${proficiency}`,
      value: `${language} ${proficiency}`,
      conceptId: null,
      source: "manual_filter",
    });
  for (const value of r.filters.industries || [])
    requirements.push({
      id: `industry:${norm(value)}`,
      kind: "industry",
      label: `Industry: ${value}`,
      value,
      conceptId: null,
      source: "manual_filter",
    });
  for (const value of r.filters.education || [])
    requirements.push({
      id: `education:${norm(value)}`,
      kind: "education",
      label: `Education: ${value}`,
      value,
      conceptId: null,
      source: "manual_filter",
    });
  for (const value of r.filters.certifications || [])
    requirements.push({
      id: `certification:${norm(value)}`,
      kind: "certification",
      label: `Certification: ${value}`,
      value,
      conceptId: null,
      source: "manual_filter",
    });
  for (const value of r.filters.exclusions || [])
    requirements.push({
      id: `exclusion:${norm(value)}`,
      kind: "exclusion",
      label: `Exclude: ${value}`,
      value,
      conceptId: null,
      source: "manual_filter",
    });
  const talentPool = raw.talentPool || "internal_profiles",
    criteria = Object.freeze(dedupeSearchCriteria(raw.criteria || [])),
    clarificationAnswers = Object.freeze({ ...raw.clarificationAnswers });
  const committedRequirements = [
    ...new Map(requirements.map((item) => [item.id, item])).values(),
  ];
  const normalizedQuery = norm(r.query),
    summary = committedRequirements
      .map((item) => item.label.replace(/ · Required$/, ""))
      .join(" · ");
  // Identity describes executed semantics, not the UI path that produced them.
  const {
    countries: _countries,
    locations: _locations,
    currentTitles: _currentTitles,
    anyTitles: _anyTitles,
    skills: _skills,
    sapModules: _sapModules,
    industries: _industries,
    languages: _languages,
    minimumTotalYearsExperience: _minimumTotalYearsExperience,
    maximumTotalYearsExperience: _maximumTotalYearsExperience,
    education: _education,
    certifications: _certifications,
    exclusions: _exclusions,
    ...residualFilters
  } = r.filters;
  const canonicalRequirements = committedRequirements
    .map(({ source: _source, ...requirement }) => requirement)
    .sort((a, b) => a.id.localeCompare(b.id));
  const canonicalCriteria = criteria.map((item, index) => ({
    id: item.id,
    label: norm(item.label),
    conceptId: item.conceptId || null,
    importance: item.importance,
    order: index,
  }));
  const semanticIdentity = hash(
    JSON.stringify({
      version: COMMITTED_SEARCH_REQUIREMENTS_VERSION,
      unresolvedQuery: canonicalRequirements.length ? "" : normalizedQuery,
      includeRelocationRemote: r.includeRelocationRemote,
      talentPool,
      criteria: canonicalCriteria,
      filters: residualFilters,
      requirements: canonicalRequirements,
    }),
  );
  return {
    version: COMMITTED_SEARCH_REQUIREMENTS_VERSION,
    query: String(r.query).normalize("NFKC").replace(/\s+/g, " ").trim(),
    normalizedQuery,
    summary,
    semanticIdentity,
    includeRelocationRemote: r.includeRelocationRemote,
    talentPool,
    criteria,
    clarificationAnswers,
    requirements: Object.freeze(committedRequirements),
  };
}
const prov = (
  candidateId: string,
  entry: TrustedCandidateEvidenceValue | null,
  literal: string | null,
  state: CommittedRequirementState,
) =>
  entry
    ? {
        candidateId,
        sourceRecordId: entry.sourceRecordId,
        sourceType: entry.sourceType,
        sourceField: entry.sourceField,
        matchedLiteral: literal,
        qualificationLevel: state,
        trusted: entry.trusted,
      }
    : null;
function generic(
  candidate: CandidateSearchV2Document,
  value: string,
  conceptId: string | null,
) {
  const indexedEvidence = conceptId
    ? candidate.searchConceptEvidence?.[conceptId]
    : null;
  if (indexedEvidence) {
    const entry: TrustedCandidateEvidenceValue = {
      value: indexedEvidence.matchedLiteral,
      normalizedValue: norm(indexedEvidence.matchedLiteral),
      sourceType: indexedEvidence.sourceType,
      sourceField: indexedEvidence.sourceField,
      sourceRecordId: indexedEvidence.sourceRecordId,
      provenance: "candidate_record_raw",
      trusted: indexedEvidence.trusted,
    };
    return {
      state: (entry.sourceType === "raw_title" ||
      entry.sourceType === "raw_certification"
        ? "verified"
        : "supported") as CommittedRequirementState,
      literal: indexedEvidence.matchedLiteral,
      entry,
    };
  }
  const entries = identityBoundTrustedCandidateValues(candidate),
    concept = conceptId ? searchConcept(conceptId) : null,
    literals = unique([
      value,
      ...(concept
        ? [concept.label, ...concept.aliases, ...(concept.contextAliases || [])]
        : []),
    ]);
  for (const entry of entries) {
    const literal = literals.find((v) => entryBounded(entry, v));
    if (literal)
      return {
        state: (entry.sourceType === "raw_title" ||
        entry.sourceType === "raw_certification"
          ? "verified"
          : "supported") as CommittedRequirementState,
        literal,
        entry,
      };
  }
  const related = Boolean(
    conceptId &&
    (
      candidate.searchConceptIds ||
      entries.flatMap((entry) => conceptsInText(entry.value))
    ).some((id) =>
      ["PARENT", "CHILD", "RELATED", "ADJACENT"].includes(
        searchConceptRelation(conceptId, id),
      ),
    ),
  );
  return {
    state: (related ? "related" : "missing") as CommittedRequirementState,
    literal: null,
    entry: null,
  };
}
function evaluation(
  candidate: CandidateSearchV2Document,
  req: CommittedSearchRequirement,
): CommittedRequirementEvaluation {
  if (req.kind === "location") {
    const matched = req.alternatives.find((a) =>
        candidateMeetsRequiredLocation(candidate, [a]),
      ),
      current = String(candidate.location || candidate.country || "").trim(),
      state: CommittedRequirementState = matched
        ? "verified"
        : candidate.locationEvidenceState === "VERIFIED" && current
          ? "conflicting"
          : "missing";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason: matched
        ? `${matched.label} · Meets required location.`
        : state === "conflicting"
          ? `Verified current location is outside ${requiredLocationDisplay(req.alternatives)}.`
          : "Verified current candidate location was not found.",
      provenance: matched
        ? {
            candidateId: candidate.candidateId,
            sourceRecordId: candidate.candidateId,
            sourceType: "candidate_current_location",
            sourceField: "candidate.location",
            matchedLiteral: matched.label,
            qualificationLevel: "verified",
            trusted: true,
          }
        : null,
    };
  }
  if (req.kind === "professional_role") {
    const trustedEntry =
        identityBoundTrustedCandidateValues(candidate)
          .filter((e) =>
            req.titleScope === "current"
              ? e.sourceType === "raw_title"
              : e.sourceType === "raw_title" ||
                e.sourceType === "raw_experience",
          )
          .find((e) => req.alternatives.some((a) => entryBounded(e, a))) ||
        null,
      canonicalEntry = candidate.canonicalRoleEvidence
        ?.filter((item) => req.titleScope !== "current" || item.current)
        .find((item) => req.alternatives.some((alternative) => bounded(item.title, alternative))) || null,
      entry = trustedEntry || canonicalEntry,
      literal =
        (entry && req.alternatives.find((alternative) =>
          "value" in entry ? entryBounded(entry, alternative) : bounded(entry.title, alternative),
        )) || null,
      state: CommittedRequirementState = entry ? "verified" : "missing",
      historical = entry?.sourceType === "raw_experience" || entry?.sourceType === "canonical_employment";
    return {
      id: req.id,
      criterionId: req.id,
      label: `Professional context: ${req.label}`,
      kind: req.kind,
      required: true,
      state,
      reason: entry
        ? historical
          ? `Qualified through grounded historical role evidence: ${literal || req.label}.`
          : `Current title evidence supports ${req.label}.`
        : `Candidate-bound ${req.titleScope === "current" ? "current title" : "title or employment"} evidence does not establish ${req.label}.`,
      provenance: entry && "value" in entry
        ? prov(candidate.candidateId, entry, literal, state)
        : entry
          ? {
              candidateId: candidate.candidateId,
              sourceRecordId: entry.sourceRecordId,
              sourceType: entry.sourceType,
              sourceField: entry.sourceField,
              matchedLiteral: literal,
              qualificationLevel: state,
              trusted: true,
            }
          : null,
    };
  }
  if (req.kind === "experience") {
    const years = candidate.totalYearsExperience,
      state: CommittedRequirementState =
        typeof years === "number" &&
        Number.isFinite(years) &&
        (req.minimum === null || years >= req.minimum) &&
        (req.maximum === null || years <= req.maximum)
          ? "verified"
          : typeof years === "number" && Number.isFinite(years)
            ? "conflicting"
            : "missing";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason:
        state === "verified"
          ? `Verified dated experience (${years} years) meets the requirement.`
          : state === "conflicting"
            ? `Verified dated experience (${years} years) does not meet the requirement.`
            : "Total experience could not be established from dated candidate employment.",
      provenance:
        state !== "missing"
          ? {
              candidateId: candidate.candidateId,
              sourceRecordId: candidate.sourceRecordId || candidate.candidateId,
              sourceType: "candidate_employment_timeline",
              sourceField: "candidate.totalYearsExperience",
              matchedLiteral: String(years),
              qualificationLevel: state,
              trusted: true,
            }
          : null,
    };
  }
  if (req.kind === "language") {
    const entry =
        identityBoundTrustedCandidateValues(candidate)
          .filter((item) => /language/i.test(item.sourceField))
          .find((item) => entryBounded(item, req.value)) || null,
      state: CommittedRequirementState = entry ? "supported" : "missing";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason: entry
        ? `Structured candidate language evidence supports ${req.value}.`
        : `Verified or policy-supported language evidence for ${req.value} was not found.`,
      provenance: prov(
        candidate.candidateId,
        entry,
        entry ? req.value : null,
        state,
      ),
    };
  }
  if (req.kind === "lifecycle") {
    const requested = req.values.length ? req.values : [req.value];
    const evidence = candidate.lifecycleEvidence || [];
    const matches = requested.map((value) =>
      req.contextConceptIds.length
        ? req.contextConceptIds
            .flatMap(
              (conceptId) =>
                targetModuleDeliveryEvidence(candidate, conceptId)
                  .directTargetAssignments,
            )
            .map((assignment) => assignment.evidence)
            .find((item) =>
              lifecycleRecordSupportsRequirement(item, [value], "any"),
            )
        : evidence.find((item) =>
            lifecycleRecordSupportsRequirement(item, [value], "any"),
          ),
    );
    const passes =
      req.operator === "all" ? matches.every(Boolean) : matches.some(Boolean);
    const match = matches.find(Boolean) || null;
    const state: CommittedRequirementState = passes ? "supported" : "missing";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason: passes
        ? `Grounded candidate project evidence supports ${req.label}.`
        : `No single grounded candidate assignment supports ${req.label}; unrelated evidence records are not combined.`,
      provenance: match
        ? {
            candidateId: candidate.candidateId,
            sourceRecordId: match.projectId,
            sourceType: "raw_project",
            sourceField: match.sourceField,
            matchedLiteral: match.lifecycleType,
            qualificationLevel: state,
            trusted: true,
          }
        : null,
    };
  }
  if (req.kind === "seniority") {
    const e = generic(candidate, req.value, null);
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state: e.state,
      reason: ["verified", "supported"].includes(e.state)
        ? "Trusted candidate title or employment evidence supports the requested seniority."
        : "Requested seniority was not established from candidate-owned evidence.",
      provenance: prov(candidate.candidateId, e.entry, e.literal, e.state),
    };
  }
  if (req.kind === "company") {
    const entries = identityBoundTrustedCandidateValues(candidate).filter(
        (entry) =>
          req.scope === "any"
            ? entry.sourceType === "raw_title" ||
              entry.sourceType === "raw_experience"
            : entry.sourceType === "raw_title",
      ),
      entry = entries.find((item) => entryBounded(item, req.value)) || null,
      state: CommittedRequirementState = entry ? "verified" : "missing";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason: entry
        ? `Candidate-bound ${req.scope} employment evidence names ${req.value}.`
        : `Candidate-bound ${req.scope} employment evidence does not establish ${req.value}.`,
      provenance: prov(
        candidate.candidateId,
        entry,
        entry ? req.value : null,
        state,
      ),
    };
  }
  if (req.kind === "exclusion") {
    const entries = identityBoundTrustedCandidateValues(candidate),
      conflict =
        entries.find((entry) => entryBounded(entry, req.value)) || null,
      state: CommittedRequirementState = conflict ? "conflicting" : "verified";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason: conflict
        ? "Excluded candidate evidence was found."
        : "No excluded candidate evidence was found.",
      provenance: conflict
        ? prov(candidate.candidateId, conflict, req.value, state)
        : {
            candidateId: candidate.candidateId,
            sourceRecordId: candidate.sourceRecordId || candidate.candidateId,
            sourceType: "candidate_requirement_evaluator",
            sourceField: null,
            matchedLiteral: null,
            qualificationLevel: state,
            trusted: true,
          },
    };
  }
  if (req.kind === "target" && isCentralNicheTarget(req.conceptId)) {
    const e =
        candidate.searchTargetEvidence?.[req.conceptId] ||
        qualifyNicheTargetEvidence(req.conceptId, candidate),
      state: CommittedRequirementState =
        e.tier === "exact_verified"
          ? "verified"
          : e.tier === "exact_supported"
            ? "supported"
            : e.tier === "related"
              ? "related"
              : "missing",
      historical = e.evidenceSourceType === "raw_experience";
    return {
      id: req.id,
      criterionId: req.id,
      label: req.label,
      kind: req.kind,
      required: true,
      state,
      reason:
        state === "verified"
          ? historical
            ? `Qualified through grounded historical ${req.label} employment evidence: ${e.matchedLiteral}.`
            : `Candidate-bound current professional evidence contains ${e.matchedLiteral}.`
          : state === "supported"
            ? historical
              ? `Qualified through grounded historical ${req.label} evidence: ${e.matchedIndicators.join(", ")}.`
              : `Meets ${req.label} with policy-approved supported evidence: ${e.matchedIndicators.join(", ")}.`
            : state === "related"
              ? `Only related ${e.relatedConcepts.join(", ")} evidence was found.`
              : `Candidate-bound evidence for ${req.label} was not found.`,
      provenance:
        e.sourceRecordId === candidate.candidateId
          ? {
              candidateId: candidate.candidateId,
              sourceRecordId: e.sourceRecordId,
              sourceType: e.evidenceSourceType,
              sourceField: e.sourceField,
              matchedLiteral: e.matchedLiteral,
              qualificationLevel: state,
              trusted: e.trusted,
            }
          : null,
    };
  }
  const value = req.kind === "target" ? req.label : req.value,
    conceptId = req.kind === "target" ? req.conceptId : req.conceptId,
    e = generic(candidate, value, conceptId);
  return {
    id: req.id,
    criterionId: req.id,
    label: req.label,
    kind: req.kind,
    required: true,
    state: e.state,
    reason: ["verified", "supported"].includes(e.state)
      ? "Trusted candidate-owned evidence supports this requirement."
      : e.state === "related"
        ? "Only related candidate evidence was found."
        : "Trusted candidate evidence for this requirement was not found.",
    provenance: prov(candidate.candidateId, e.entry, e.literal, e.state),
  };
}
const candidateEvaluation = (
  committed: CommittedSearchRequirements,
  requirements: readonly CommittedRequirementEvaluation[],
): CommittedCandidateEvaluation => {
  const locationFailure = requirements.some(
      (r) =>
        r.kind === "location" && !["verified", "supported"].includes(r.state),
    ),
    nonLocationFailure = requirements.some(
      (r) =>
        r.kind !== "location" && !["verified", "supported"].includes(r.state),
    ),
    broadeningApplied =
      committed.includeRelocationRemote &&
      locationFailure &&
      !nonLocationFailure;
  return {
    version: COMMITTED_SEARCH_REQUIREMENTS_VERSION,
    semanticIdentity: committed.semanticIdentity,
    eligible: !nonLocationFailure && (!locationFailure || broadeningApplied),
    broadeningApplied,
    requirements,
    verified: requirements.filter((r) => r.state === "verified").length,
    supported: requirements.filter((r) => r.state === "supported").length,
    attention: requirements.filter(
      (r) => !["verified", "supported"].includes(r.state),
    ).length,
    matchedLocation:
      requirements.find((r) => r.kind === "location" && r.state === "verified")
        ?.provenance?.matchedLiteral || null,
  };
};
export function evaluateCommittedPopulation(
  documents: readonly CandidateSearchV2Document[],
  committed: CommittedSearchRequirements,
  profileOutput?: { profile?: SearchV2HardFilterProfile },
): CommittedPopulationEvaluation {
  const profile = {
    requirementPreparationMs: 0,
    candidateProjectionAccessMs: 0,
    roleTitleLookupMs: 0,
    locationLookupMs: 0,
    experienceLookupMs: 0,
    seniorityLookupMs: 0,
    languageLookupMs: 0,
    deliveryLookupMs: 0,
    evidenceConstructionMs: 0,
    funnelAggregationMs: 0,
    regexOrTextScanMs: 0,
    canonicalizationMs: 0,
    diagnosticSerializationMs: 0,
    candidateRequirementEvaluations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    byKind: {} as Record<string, { calls: number; ms: number }>,
  };
  const preparationStarted = performance.now();
  let remaining = documents.filter(
    (document) =>
      (document.talentPool || "internal_profiles") === committed.talentPool,
  );
  const poolPopulation = remaining.length,
    partials = new Map<string, CommittedRequirementEvaluation[]>(),
    funnel: SearchV2ExclusionFunnelItem[] = [];
  profile.requirementPreparationMs = performance.now() - preparationStarted;
  for (const requirement of committed.requirements) {
    const entering = remaining.length;
    if (!entering) {
      funnel.push({
        requirementId: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        entering: 0,
        excluded: 0,
        remaining: 0,
        evaluated: false,
        evidencePolicy:
          "Candidate-bound verified or policy-approved supported evidence is required.",
        explanation:
          "Not evaluated because no candidates remained after earlier required filters.",
      });
      continue;
    }
    const passed: CandidateSearchV2Document[] = [];
    for (const document of remaining) {
      const accessStarted = performance.now();
      // Central niche targets can be supported by grounded project/process
      // clusters that are intentionally broader than structured module fields.
      // Their index must therefore fail open and rely on the exact evaluator.
      if (
        requirement.kind === "target" &&
        !isCentralNicheTarget(requirement.conceptId)
      ) {
        const indexed = indexedTargets(document);
        profile.candidateProjectionAccessMs +=
          performance.now() - accessStarted;
        if (
          indexed.size &&
          requirement.conceptId &&
          !indexed.has(requirement.conceptId)
        ) {
          profile.candidateRequirementEvaluations++;
          continue;
        }
      } else
        profile.candidateProjectionAccessMs +=
          performance.now() - accessStarted;
      const started = performance.now(),
        evaluated = cachedEvaluation(document, requirement),
        elapsed = performance.now() - started,
        result = evaluated.value;
      profile.candidateRequirementEvaluations++;
      if (evaluated.hit) profile.cacheHits++;
      else profile.cacheMisses++;
      const bucket = profile.byKind[requirement.kind] || { calls: 0, ms: 0 };
      bucket.calls++;
      bucket.ms += elapsed;
      profile.byKind[requirement.kind] = bucket;
      if (requirement.kind === "professional_role")
        profile.roleTitleLookupMs += elapsed;
      else if (requirement.kind === "location")
        profile.locationLookupMs += elapsed;
      else if (requirement.kind === "experience")
        profile.experienceLookupMs += elapsed;
      else if (requirement.kind === "seniority")
        profile.seniorityLookupMs += elapsed;
      else if (requirement.kind === "language")
        profile.languageLookupMs += elapsed;
      else if (requirement.kind === "lifecycle")
        profile.deliveryLookupMs += elapsed;
      else profile.regexOrTextScanMs += elapsed;
      partials.set(document.candidateId, [
        ...(partials.get(document.candidateId) || []),
        result,
      ]);
      if (
        ["verified", "supported"].includes(result.state) ||
        (requirement.kind === "location" && committed.includeRelocationRemote)
      )
        passed.push(document);
    }
    const funnelStarted = performance.now(),
      excluded = entering - passed.length;
    remaining = passed;
    funnel.push({
      requirementId: requirement.id,
      label: requirement.label,
      kind: requirement.kind,
      entering,
      excluded,
      remaining: passed.length,
      evaluated: true,
      evidencePolicy:
        "Candidate-bound verified or policy-approved supported evidence is required.",
      explanation: excluded
        ? `${excluded} candidate${excluded === 1 ? "" : "s"} did not provide qualifying ${requirement.label.toLowerCase()} evidence.`
        : "All remaining candidates met this requirement.",
    });
    profile.funnelAggregationMs += performance.now() - funnelStarted;
  }
  const evidenceStarted = performance.now(),
    eligibleCandidateIds = new Set(
      remaining.map((document) => document.candidateId),
    ),
    evaluations = new Map<string, CommittedCandidateEvaluation>();
  for (const document of remaining)
    evaluations.set(
      document.candidateId,
      candidateEvaluation(committed, partials.get(document.candidateId) || []),
    );
  profile.evidenceConstructionMs = performance.now() - evidenceStarted;
  const diagnostic = {
    selectedPool: committed.talentPool,
    poolPopulation,
    emptyPool: poolPopulation === 0,
    funnel,
  } as SearchV2EligibilityDiagnostic;
  if (profileOutput) {
    const serializationStarted = performance.now();
    JSON.stringify(diagnostic);
    profile.diagnosticSerializationMs =
      performance.now() - serializationStarted;
    profileOutput.profile = profile;
  }
  return { eligibleCandidateIds, evaluations, diagnostic };
}
export function evaluateCommittedCandidate(
  candidate: CandidateSearchV2Document,
  committed: CommittedSearchRequirements,
): CommittedCandidateEvaluation {
  if ((candidate.talentPool || "internal_profiles") !== committed.talentPool)
    return {
      version: COMMITTED_SEARCH_REQUIREMENTS_VERSION,
      semanticIdentity: committed.semanticIdentity,
      eligible: false,
      broadeningApplied: false,
      requirements: [],
      verified: 0,
      supported: 0,
      attention: 1,
      matchedLocation: null,
    };
  return candidateEvaluation(
    committed,
    committed.requirements.map((r) => evaluation(candidate, r)),
  );
}
export function buildSearchV2EligibilityDiagnostic(
  documents: readonly CandidateSearchV2Document[],
  committed: CommittedSearchRequirements,
  evaluations: ReadonlyMap<string, CommittedCandidateEvaluation>,
): SearchV2EligibilityDiagnostic {
  let remaining = documents.filter(
    (document) =>
      (document.talentPool || "internal_profiles") === committed.talentPool,
  );
  const poolPopulation = remaining.length;
  const funnel = committed.requirements.map((requirement) => {
    const entering = remaining.length;
    if (!entering)
      return {
        requirementId: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        entering: 0,
        excluded: 0,
        remaining: 0,
        evaluated: false,
        evidencePolicy:
          "Candidate-bound verified or policy-approved supported evidence is required.",
        explanation:
          "Not evaluated because no candidates remained after earlier required filters.",
      };
    const passed = remaining.filter((document) => {
      const result = evaluations
        .get(document.candidateId)
        ?.requirements.find((item) => item.id === requirement.id);
      return Boolean(
        result &&
        (["verified", "supported"].includes(result.state) ||
          (requirement.kind === "location" &&
            committed.includeRelocationRemote)),
      );
    });
    const excluded = entering - passed.length;
    remaining = passed;
    return {
      requirementId: requirement.id,
      label: requirement.label,
      kind: requirement.kind,
      entering,
      excluded,
      remaining: passed.length,
      evaluated: true,
      evidencePolicy:
        "Candidate-bound verified or policy-approved supported evidence is required.",
      explanation: excluded
        ? `${excluded} candidate${excluded === 1 ? "" : "s"} did not provide qualifying ${requirement.label.toLowerCase()} evidence.`
        : "All remaining candidates met this requirement.",
    };
  });
  return {
    selectedPool: committed.talentPool,
    poolPopulation,
    emptyPool: poolPopulation === 0,
    funnel,
  };
}
export function canonicalInternalDeliveryDepth(
  candidate: CandidateSearchV2Document,
  committed: Pick<CommittedSearchRequirements, "requirements">,
) {
  const targetConcepts = committed.requirements.flatMap((requirement) =>
    requirement.kind === "target" ? [requirement.conceptId] : [],
  );
  const contextual = targetConcepts.length
    ? targetConcepts.flatMap((conceptId) =>
        targetModuleDeliveryEvidence(candidate, conceptId).directTargetAssignments.map(
          (assignment) => assignment.evidence,
        ),
      )
    : [...(candidate.lifecycleEvidence || [])];
  const strengthByType = (lifecycleType: string) =>
    lifecycleType === "Implementation"
      ? 60
      : lifecycleType === "Rollout"
        ? 55
        : lifecycleType === "Migration" || lifecycleType === "Go-live"
          ? 50
          : lifecycleType === "Configuration"
            ? 45
            : lifecycleType === "Support / Enhancement"
              ? 35
              : lifecycleType === "Delivery responsibility" ||
                  lifecycleType === "Project leadership"
                ? 30
                : 20;
  const projects = new Map<string, number>();
  for (const evidence of contextual)
    projects.set(
      canonicalLifecycleAssignmentId(evidence),
      Math.max(
        projects.get(canonicalLifecycleAssignmentId(evidence)) || 0,
        strengthByType(evidence.lifecycleType),
      ),
    );
  const ordered = [...projects.values()].sort((left, right) => right - left);
  return Math.min(
    100,
    Math.round(
      (ordered[0] || 0) +
        ordered.slice(1).reduce((total, strength) => total + strength * 0.3, 0),
    ),
  );
}
export function applyCommittedRequirements(
  results: CandidateSearchV2Result[],
  documents: CandidateSearchV2Document[],
  committed: CommittedSearchRequirements,
  evaluations?: ReadonlyMap<string, CommittedCandidateEvaluation>,
  options: { preserveIneligible?: boolean } = {},
) {
  const docs = new Map(documents.map((d) => [d.candidateId, d]));
  return results.flatMap((result) => {
    const doc = docs.get(result.candidateId);
    if (!doc) return [];
    const integrity =
      evaluations?.get(result.candidateId) ||
      evaluateCommittedCandidate(doc, committed);
    if (!integrity.eligible && !options.preserveIneligible) return [];
    const criteriaDiagnostic = evaluateSearchCriteria(doc, committed.criteria),
      total = integrity.requirements.length,
      requirementEvidenceConfidence = total
        ? Math.round(
            ((integrity.verified + integrity.supported * 0.72) / total) * 100,
          )
        : 100,
      profileEvidenceEntries = Object.entries(doc.profileEvidence || {}),
      profileEvidenceWeight = (field: string) =>
        ["title", "experienceDuration", "employmentHistory", "projectHistory"].includes(field)
          ? 2
          : 1,
      profileEvidenceTotalWeight = profileEvidenceEntries.reduce(
        (total, [field]) => total + profileEvidenceWeight(field),
        0,
      ),
      fallbackProfileCompleteness = profileEvidenceTotalWeight
        ? Math.round(
            (profileEvidenceEntries.reduce(
              (total, [field, present]) =>
                total + (present ? profileEvidenceWeight(field) : 0),
              0,
            ) /
              profileEvidenceTotalWeight) *
              100,
          )
          : 0,
      normalizedQuality =
        typeof doc.profileQualityScore === "number"
          ? Math.round(
              Math.max(
                0,
                Math.min(
                  100,
                  doc.profileQualityScore <= 1
                    ? doc.profileQualityScore * 100
                    : doc.profileQualityScore,
                ),
              ),
            )
          : fallbackProfileCompleteness,
      profileCompleteness = Math.max(
        0,
        Math.min(100, Math.round(doc.canonicalProfileCompletenessScore ?? fallbackProfileCompleteness)),
      ),
      evidenceConfidencePercent = Math.round(
        requirementEvidenceConfidence * 0.55 +
          fallbackProfileCompleteness * 0.3 +
          normalizedQuality * 0.15,
      ),
      requiredCoveragePercent = total
        ? Math.round(((integrity.verified + integrity.supported) / total) * 100)
        : 100,
      supportedProfessionalEvidenceDepth = canonicalInternalDeliveryDepth(
        doc,
        committed,
      ),
      overallMatchScore = canonicalOverallMatchScore({
        criteriaScore: criteriaDiagnostic.scorePercent,
        hasCriteria: criteriaDiagnostic.totalWeight > 0,
        professionalRelevance: result.score.roleRelevanceScore,
        deliveryDepth: supportedProfessionalEvidenceDepth,
        evidenceConfidence: evidenceConfidencePercent,
      }),
      overallMatchPercent = overallMatchScore;
    return [
      Object.assign(result, {
        score: { ...result.score, finalScore: overallMatchScore },
        integrity,
        talentPool: committed.talentPool,
        criteriaDiagnostic,
        requiredCoveragePercent,
        evidenceConfidencePercent,
        overallMatchPercent,
        overallMatchScore,
        rankingScore: overallMatchScore,
        matchLabel: canonicalMatchLabel(overallMatchScore),
        rankingVersion: SEARCH_V2_RANKING_VERSION,
        profileCompletenessPercent: profileCompleteness,
        sourceCompletenessPercent: doc.sourceCompletenessScore == null
          ? undefined
          : Math.max(0, Math.min(100, Math.round(doc.sourceCompletenessScore))),
        profileDataConfidencePercent: Math.max(
          0,
          Math.min(100, Math.round(doc.dataConfidenceScore ?? normalizedQuality)),
        ),
        supportedProfessionalEvidenceDepth,
      }),
    ];
  });
}
