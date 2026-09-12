import {
  canonicalSearchConcept,
  conceptsInText,
  lifecycleTermsInText,
  mostSpecificSearchConcepts,
  searchConcept,
  searchConceptExpansion,
  searchConceptRelation,
  titleSupportsSearchConcept,
} from "./candidateSearchConcepts";
import type {
  CandidateSpecializationEvidenceLevel,
  CandidateTargetEvidence,
} from "./candidateSearchV2Types";
import { isCentralNicheTarget } from "./nicheTargetEvidence";

export type RecruiterSearchIntent = {
  seniority: string[];
  countries: string[];
  skills: string[];
  sapModules: string[];
  roleConcepts: string[];
  expandedConcepts: string[];
  lifecycle: string[];
};

export type RecruiterSearchSignal = {
  score: {
    skillScore: number;
    titleScore: number;
    locationScore: number;
    recencyScore: number;
    finalScore: number;
    dimensionScore?: number;
    weakestDimensionStrength?: number;
    profileQualityFactor?: number;
    roleEvidenceKind?:
      | "current_direct"
      | "historical_direct"
      | "same_domain"
      | "exposure_only"
      | "keyword_only"
      | "none";
    roleProximityRank?: number;
    professionalRoleContext?: boolean;
  };
  explanation: {
    matchedSkills: string[];
    matchedSapModules: string[];
    matchedTerms: string[];
    missingSkills: string[];
    warnings: string[];
  };
  profileEvidence?: {
    name: boolean;
    title: boolean;
    employer: boolean;
    location: boolean;
    experienceDuration: boolean;
    employmentHistory: boolean;
    projectHistory: boolean;
    education: boolean;
    certifications: boolean;
    skills: boolean;
  };
  currentTitle?: string | null;
  location?: string | null;
  country?: string | null;
  verifiedSkills?: string[];
  verifiedSapModules?: string[];
  implementationEvidenceCount?: number;
  implementationEvidenceLevel?:
    | "verified_structured_evidence"
    | "source_text_evidence"
    | "inferred_evidence"
    | "search_expansion"
    | "contradicted_evidence"
    | "unverified";
  seniorityEvidenceLevel?:
    | "verified_structured_evidence"
    | "source_text_evidence"
    | "inferred_evidence"
    | "search_expansion"
    | "contradicted_evidence"
    | "unverified";
  domainEvidence?: Record<
    string,
    "PRIMARY" | "STRONG" | "SUPPORTED" | "EXPOSURE" | "UNVERIFIED"
  >;
  ficoRelevance?:
    | "PRIMARY_FICO"
    | "STRONG_FICO"
    | "FICO_EXPOSURE"
    | "RELATED_SAP"
    | "NO_FICO";
  primaryRoleFit?:
    "exact" | "adjacent" | "exposure_only" | "conflicting" | "unknown";
  implementationFit?:
    | "verified_domain_implementation"
    | "supported_domain_implementation"
    | "generic_implementation"
    | "implementation_exposure"
    | "not_verified"
    | "mismatch";
  seniorityFit?: "verified" | "supported" | "unverified" | "mismatch";
  locationFit?: "verified" | "supported" | "not_verified" | "conflicting";
  specializationEvidenceLevel?: CandidateSpecializationEvidenceLevel;
  targetEvidence?: CandidateTargetEvidence;
};

export type RecruiterProfileConfidence = "high" | "medium" | "limited";

const normalizedTargetTier = (
  result: RecruiterSearchSignal,
): CandidateTargetEvidence["tier"] =>
  result.targetEvidence?.tier ||
  (result.specializationEvidenceLevel === "exact_verified"
    ? "exact_verified"
    : result.specializationEvidenceLevel === "exact_supported"
      ? "exact_supported"
      : ["parent_verified", "adjacent"].includes(
            result.specializationEvidenceLevel || "",
          )
        ? "related"
        : "none");

const COUNTRY_PATTERNS: Array<[string, RegExp]> = [
  ["Malaysia", /\bmalaysia(?:n)?\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["Indonesia", /\bindonesia(?:n)?\b/i],
  ["Thailand", /\bthailand|\bthai\b/i],
  ["Vietnam", /\bvietnam(?:ese)?\b/i],
  ["Philippines", /\bphilippines|\bfilipino\b/i],
  ["India", /\bindia(?:n)?\b/i],
  ["Australia", /\baustralia(?:n)?\b/i],
];
const SENIORITY_PATTERNS: Array<[string, RegExp]> = [
  ["Lead", /\b(?:lead|principal)\b/i],
  ["Senior", /\bsenior|\bsr\.?\b/i],
  ["Manager", /\bmanager\b/i],
  ["Director", /\bdirector|\bhead of\b/i],
];
const MODULE_PATTERNS: Array<[string, RegExp]> = [
  ["FI", /\b(?:sap\s*)?fi\b|\bfico\b|\bfi\/co\b/i],
  ["CO", /\b(?:sap\s*)?co\b|\bfico\b|\bfi\/co\b/i],
  ["FICO", /\b(?:sap\s*)?fico\b|\bfi\/co\b/i],
  ["MM", /\b(?:sap\s*)?mm\b/i],
  ["SD", /\b(?:sap\s*)?sd\b/i],
  ["PP", /\b(?:sap\s*)?pp\b/i],
  ["HCM", /\b(?:sap\s*)?hcm\b/i],
  ["BW", /\b(?:sap\s*)?bw\b/i],
  ["BTP", /\b(?:sap\s*)?btp\b/i],
  ["S/4HANA", /\bs\/?4\s*hana\b|\bs4hana\b/i],
  ["SAP PI/PO", /\b(?:sap\s*)?pi\s*\/\s*po\b/i],
];
const SKILL_PATTERNS: Array<[string, RegExp]> = [
  ["SAP FICO", /\b(?:sap\s*)?fico\b|\bfi\/co\b/i],
  ["S/4HANA", /\bs\/?4\s*hana\b|\bs4hana\b/i],
  ["Implementation", /\bimplement(?:ation|ations|ed|ing)?\b/i],
  ["Rollout", /\broll[ -]?out(?:s)?\b/i],
  ["AMS", /\bams\b/i],
  ["Support", /\bsupport\b/i],
  ["Java", /\bjava\b|\bj2ee\b/i],
  ["Microservices", /\bmicro[ -]?services?\b/i],
  ["Data Engineer", /\bdata engineer(?:ing)?\b/i],
  ["Azure", /\bazure\b/i],
  ["Databricks", /\bdatabricks\b/i],
  ["Finance", /\bfinance manager\b|\bfinancial reporting\b/i],
  ["IFRS", /\bifrs\b|international financial reporting standards/i],
  ["SAP PI/PO", /\b(?:sap\s*)?pi\s*\/\s*po\b/i],
  ["C++", /(?:^|\s)c\+\+(?=\s|$)/i],
  ["C#", /(?:^|\s)c#(?=\s|$)/i],
  [".NET", /(?:^|\s)\.net(?=\s|$)/i],
  ["Node.js", /\bnode\.js\b/i],
  ["O2C", /\bo2c\b/i],
];

function matches(source: string, patterns: Array<[string, RegExp]>) {
  return patterns
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
}

export function parseRecruiterSearchIntent(
  query: string,
): RecruiterSearchIntent {
  const source = String(query || "")
    .normalize("NFKC")
    .trim();
  const roleConcepts = conceptsInText(source);
  const lifecycle = lifecycleTermsInText(source).map((value) =>
    value === "e-commerce"
      ? "E-commerce"
      : value[0].toUpperCase() + value.slice(1),
  );
  return {
    seniority: matches(source, SENIORITY_PATTERNS),
    countries: matches(source, COUNTRY_PATTERNS),
    skills: recruiterSearchChips(
      [
        ...matches(source, SKILL_PATTERNS),
        ...roleConcepts.map((id) => searchConcept(id)?.label || id),
        ...lifecycle,
      ],
      20,
    ),
    sapModules: matches(source, MODULE_PATTERNS),
    roleConcepts,
    expandedConcepts: recruiterSearchChips(
      roleConcepts.flatMap((id) => searchConceptExpansion(id)),
      16,
    ),
    lifecycle,
  };
}

export function removeRecruiterSearchIntent(query: string, label: string) {
  let pattern = [
    ...COUNTRY_PATTERNS,
    ...SENIORITY_PATTERNS,
    ...MODULE_PATTERNS,
    ...SKILL_PATTERNS,
  ].find(([name]) => name === label)?.[1];
  if (!pattern) {
    const conceptId = canonicalSearchConcept(label);
    const concept = conceptId ? searchConcept(conceptId) : undefined;
    const terms = concept
      ? [concept.label, ...concept.aliases]
          .filter(Boolean)
          .sort((a, b) => b.length - a.length)
      : [];
    if (terms.length)
      pattern = new RegExp(
        `\\b(?:${terms.map((term) => term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").replace(/[-/\\s]+/g, "[-/\\s]*")).join("|")})\\b`,
        "i",
      );
  }
  if (!pattern) return query;
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  return String(query || "")
    .replace(new RegExp(pattern.source, flags), " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchQualityMinimumScore(value: "any" | "relevant" | "strong") {
  return value === "strong" ? 85 : value === "relevant" ? 50 : 0;
}

function canonicalChip(value: string) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .trim();
  if (/^sap$/i.test(normalized)) return "";
  if (/^(?:sap\s*)?fico$/i.test(normalized)) return "FICO";
  if (/^s\/?4\s*hana$/i.test(normalized)) return "S/4HANA";
  return normalized.replace(/^sap\s+/i, "");
}

export function recruiterSearchChips(values: string[], maximum = 7) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const chip = canonicalChip(value);
    if (chip) unique.set(chip.toLowerCase(), chip);
  }
  return [...unique.values()].slice(0, maximum);
}

export function recruiterCandidateEvidenceChips(
  result: RecruiterSearchSignal & { queryRelevantSkills?: string[] },
  maximum = 7,
  intent?: RecruiterSearchIntent,
) {
  const requestedNicheTargets = mostSpecificSearchConcepts(
    intent?.roleConcepts || [],
  ).filter(isCentralNicheTarget);
  const targetQualified = ["exact_verified", "exact_supported"].includes(
    normalizedTargetTier(result),
  );
  const values = (
    result.queryRelevantSkills !== undefined
      ? result.queryRelevantSkills
      : [...(result.verifiedSapModules || []), ...(result.verifiedSkills || [])]
  )
    .filter(
      (value) =>
        normalizedSignal(value) !== "implementation" ||
        ["verified_structured_evidence", "source_text_evidence"].includes(
          result.implementationEvidenceLevel || "",
        ),
    )
    .filter((value) => {
      const concept = canonicalSearchConcept(value);
      const isRequestedNicheTag = Boolean(
        concept &&
        requestedNicheTargets.some(
          (target) => searchConceptRelation(target, concept) === "EXACT",
        ),
      );
      return !isRequestedNicheTag || targetQualified;
    });
  return recruiterSearchChips(values, maximum);
}

export function recruiterMatchLabel(finalScore: number) {
  return finalScore >= 65
    ? "Strong Match"
    : finalScore >= 45
      ? "Good Match"
      : finalScore >= 25
        ? "Potential Match"
        : "Review";
}

export function recruiterProfileConfidence(
  result: RecruiterSearchSignal,
): RecruiterProfileConfidence {
  const evidence = result.profileEvidence;
  if (!evidence) return "limited";
  const supported = Object.values(evidence).filter(Boolean).length;
  const careerEvidence =
    evidence.experienceDuration ||
    evidence.employmentHistory ||
    evidence.projectHistory;
  if (!careerEvidence || supported < 5) return "limited";
  if (!evidence.name || supported < 8) return "medium";
  return "high";
}

export function evidenceSafeMatchLabel(
  finalScore: number,
  confidence: RecruiterProfileConfidence,
) {
  return recruiterMatchLabel(finalScore);
}

function normalizedSignal(value: string) {
  return canonicalChip(value).toLowerCase();
}

export function recruiterQueryEvidence(
  result: RecruiterSearchSignal,
  intent: RecruiterSearchIntent,
) {
  const confirmed: string[] = [];
  const unverified: string[] = [];
  const title = String(result.currentTitle || "");
  const location = `${result.location || ""} ${result.country || ""}`;
  const verifiedModules = new Set(
    (result.verifiedSapModules || []).map(normalizedSignal),
  );
  const verifiedSkills = new Set(
    (result.verifiedSkills || []).map(normalizedSignal),
  );
  const requestedNicheTargets = mostSpecificSearchConcepts(
    intent.roleConcepts,
  ).filter(isCentralNicheTarget);
  const supports = (value: string) => {
    if (normalizedSignal(value) === "implementation")
      return ["verified_structured_evidence", "source_text_evidence"].includes(
        result.implementationEvidenceLevel || "",
      );
    const concept = canonicalSearchConcept(value);
    if (
      concept &&
      requestedNicheTargets.some(
        (target) => searchConceptRelation(target, concept) === "EXACT",
      )
    )
      return ["exact_verified", "exact_supported"].includes(
        normalizedTargetTier(result),
      );
    return (
      verifiedModules.has(normalizedSignal(value)) ||
      verifiedSkills.has(normalizedSignal(value))
    );
  };

  for (const seniority of intent.seniority) {
    const level = result.seniorityEvidenceLevel || "unverified";
    (level === "verified_structured_evidence" || level === "inferred_evidence"
      ? confirmed
      : unverified
    ).push(
      level === "verified_structured_evidence"
        ? `${seniority}-level role evidence`
        : `${seniority}-level career evidence`,
    );
  }
  for (const country of intent.countries) {
    (new RegExp(`\\b${country}\\b`, "i").test(location)
      ? confirmed
      : unverified
    ).push(country);
  }
  for (const skill of recruiterSearchChips(intent.skills, 6)) {
    (supports(skill) ? confirmed : unverified).push(canonicalChip(skill));
  }
  for (const module of recruiterSearchChips(intent.sapModules, 8)) {
    const label = canonicalChip(module);
    if (
      !label ||
      confirmed.some((item) => item.toLowerCase() === label.toLowerCase()) ||
      unverified.some((item) => item.toLowerCase() === label.toLowerCase())
    )
      continue;
    (supports(label) ? confirmed : unverified).push(label);
  }
  return {
    confirmed: confirmed.slice(0, 4),
    unverified: unverified.slice(0, 3),
  };
}

export function recruiterQueryStatements(
  result: RecruiterSearchSignal,
  intent: RecruiterSearchIntent,
) {
  const title = String(result.currentTitle || "");
  const location = `${result.location || ""} ${result.country || ""}`;
  const verifiedModules = new Set(
    (result.verifiedSapModules || []).map(normalizedSignal),
  );
  const verifiedSkills = new Set(
    (result.verifiedSkills || []).map(normalizedSignal),
  );
  const requestedNicheTargets = mostSpecificSearchConcepts(
    intent.roleConcepts,
  ).filter(isCentralNicheTarget);
  const supports = (value: string) => {
    if (normalizedSignal(value) === "implementation")
      return ["verified_structured_evidence", "source_text_evidence"].includes(
        result.implementationEvidenceLevel || "",
      );
    const concept = canonicalSearchConcept(value);
    if (
      concept &&
      requestedNicheTargets.some(
        (target) => searchConceptRelation(target, concept) === "EXACT",
      )
    )
      return ["exact_verified", "exact_supported"].includes(
        normalizedTargetTier(result),
      );
    return (
      verifiedModules.has(normalizedSignal(value)) ||
      verifiedSkills.has(normalizedSignal(value))
    );
  };
  const supported: string[] = [];
  const gaps: string[] = [];
  const requestedFico =
    intent.roleConcepts.includes("FICO") ||
    [...intent.skills, ...intent.sapModules].some(
      (item) => normalizedSignal(item) === "fico",
    );

  const ficoClass =
    result.domainEvidence?.FICO ||
    (result.ficoRelevance === "PRIMARY_FICO"
      ? "PRIMARY"
      : result.ficoRelevance === "STRONG_FICO"
        ? "STRONG"
        : result.ficoRelevance === "FICO_EXPOSURE"
          ? "EXPOSURE"
          : "UNVERIFIED");
  const resolvedRoleFit =
    result.primaryRoleFit ||
    (/\b(?:fico|fi\s*[\/-]\s*co|fi consultant|co consultant)\b/i.test(title) &&
    (ficoClass === "PRIMARY" || ficoClass === "STRONG")
      ? "exact"
      : ficoClass === "PRIMARY" ||
          ficoClass === "STRONG" ||
          ficoClass === "SUPPORTED"
        ? "adjacent"
        : ficoClass === "EXPOSURE"
          ? "exposure_only"
          : "unknown");
  if (
    requestedFico &&
    resolvedRoleFit === "exact" &&
    ["exact_verified", "exact_supported"].includes(normalizedTargetTier(result))
  )
    supported.push("SAP FICO confirmed in current title");
  else if (
    requestedFico &&
    resolvedRoleFit === "exact" &&
    (ficoClass === "PRIMARY" || ficoClass === "STRONG")
  )
    supported.push("SAP FICO title");
  else if (
    requestedFico &&
    (ficoClass === "PRIMARY" ||
      ficoClass === "STRONG" ||
      ficoClass === "SUPPORTED") &&
    resolvedRoleFit === "adjacent"
  )
    supported.push("SAP FICO experience");
  else if (requestedFico && ficoClass === "EXPOSURE")
    gaps.push("SAP FICO exposure");
  else if (requestedFico)
    gaps.push("Primary FICO specialization not confirmed");
  const candidateConcepts = [
    ...new Set(
      [...(result.verifiedSapModules || []), ...(result.verifiedSkills || [])]
        .flatMap((value) => [
          canonicalSearchConcept(value),
          ...conceptsInText(value),
        ])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const requestedConcepts = mostSpecificSearchConcepts(intent.roleConcepts);
  for (const requested of requestedConcepts.filter(
    (concept) => concept !== "FICO",
  )) {
    const concept = searchConcept(requested);
    const label = canonicalChip(concept?.label || requested);
    const verdict = result.domainEvidence?.[requested];
    const centralizedNicheTarget = isCentralNicheTarget(requested);
    const exact = centralizedNicheTarget
      ? normalizedTargetTier(result) === "exact_verified"
      : verdict !== "UNVERIFIED" &&
        (titleSupportsSearchConcept(title, requested) ||
          verdict === "PRIMARY" ||
          verdict === "STRONG" ||
          candidateConcepts.includes(requested));
    const supportingConcept = centralizedNicheTarget
      ? result.targetEvidence?.relatedConcepts?.[0]
      : candidateConcepts.find(
          (evidence) =>
            ["PARENT", "CHILD", "RELATED", "ADJACENT"].includes(
              searchConceptRelation(requested, evidence),
            ) && evidence !== requested,
        );
    if (exact) supported.push(`${label} verified`);
    else if (
      (centralizedNicheTarget &&
        normalizedTargetTier(result) === "exact_supported") ||
      (!centralizedNicheTarget &&
        (verdict === "SUPPORTED" ||
          (requestedConcepts.includes(requested) &&
            normalizedTargetTier(result) === "exact_supported")))
    ) {
      supported.push(`${label} supported`);
      gaps.push(`${label} not explicitly verified`);
    } else if (supportingConcept) {
      const supportLabel = canonicalChip(
        searchConcept(supportingConcept)?.label || supportingConcept,
      );
      supported.push(`Related ${supportLabel} experience`);
      gaps.push(`${label} not verified`);
    } else gaps.push(`${label} not verified`);
  }
  const country = intent.countries.find((item) =>
    new RegExp(`\\b${item}\\b`, "i").test(location),
  );
  if (country && result.locationFit !== "conflicting") supported.push(country);
  else if (intent.countries.length)
    gaps.push(`${intent.countries[0]} not verified`);
  if (intent.seniority.length && result.seniorityFit === "mismatch")
    gaps.push("Seniority mismatch");
  else if (
    intent.seniority.length &&
    result.seniorityEvidenceLevel &&
    result.seniorityEvidenceLevel !== "unverified"
  )
    supported.push(
      result.seniorityEvidenceLevel === "verified_structured_evidence"
        ? "Seniority role evidence"
        : "Seniority supported",
    );
  else if (intent.seniority.length) gaps.push("Seniority not confirmed");
  const implementationRequested = intent.skills.some(
    (item) => normalizedSignal(item) === "implementation",
  );
  const resolvedImplementationFit =
    result.implementationFit ||
    (result.implementationEvidenceLevel === "verified_structured_evidence" &&
    (resolvedRoleFit === "exact" || resolvedRoleFit === "adjacent")
      ? "verified_domain_implementation"
      : result.implementationEvidenceLevel === "source_text_evidence" &&
          (resolvedRoleFit === "exact" || resolvedRoleFit === "adjacent")
        ? "supported_domain_implementation"
        : "not_verified");
  if (
    implementationRequested &&
    resolvedImplementationFit === "verified_domain_implementation"
  )
    supported.push("Implementation verified");
  else if (
    implementationRequested &&
    resolvedImplementationFit === "supported_domain_implementation"
  )
    supported.push("Implementation supported");
  else if (
    implementationRequested &&
    (resolvedImplementationFit === "generic_implementation" ||
      resolvedImplementationFit === "implementation_exposure")
  )
    gaps.push("Implementation not verified for requested specialization");
  else if (implementationRequested) gaps.push("Implementation not verified");
  // FI/CO are useful depth signals for a FICO search, but query expansion must
  // not turn them into additional recruiter requirements.
  return { supported: supported.slice(0, 4), gaps: gaps.slice(0, 4) };
}

export function recruiterMatchTier(
  result: RecruiterSearchSignal,
  intent: RecruiterSearchIntent,
) {
  const weakestDimension = Number(result.score.weakestDimensionStrength ?? 100);
  const dimensionScore = Number(
    result.score.dimensionScore ?? result.score.finalScore,
  );
  const qualityFactor = Number(result.score.profileQualityFactor ?? 1);
  const implementationRequested = intent.skills.some(
    (item) => normalizedSignal(item) === "implementation",
  );
  const verifiedConcepts = [
    ...(result.verifiedSapModules || []),
    ...(result.verifiedSkills || []),
  ]
    .flatMap((value) => [
      canonicalSearchConcept(value),
      ...conceptsInText(value),
    ])
    .filter((value): value is string => Boolean(value));
  const supportedSpecializationActionable =
    normalizedTargetTier(result) === "exact_supported" &&
    result.score.roleEvidenceKind === "same_domain" &&
    Boolean(result.score.professionalRoleContext) &&
    (!intent.countries.length ||
      ["verified", "supported"].includes(result.locationFit || ""));
  const requestedPrimarySpecializationVerified =
    result.specializationEvidenceLevel
      ? normalizedTargetTier(result) === "exact_verified" ||
        supportedSpecializationActionable
      : intent.roleConcepts.every((requested) => {
          const verdict = result.domainEvidence?.[requested];
          if (verdict === "UNVERIFIED") return false;
          if (verdict) return true;
          return (
            verifiedConcepts.includes(requested) ||
            verifiedConcepts.some(
              (evidence) => searchConcept(evidence)?.parent === requested,
            )
          );
        });
  const strongSpecializationEligible =
    (!result.targetEvidence && !result.specializationEvidenceLevel) ||
    normalizedTargetTier(result) === "exact_verified";
  const strongEligible =
    strongSpecializationEligible &&
    (!result.primaryRoleFit || result.primaryRoleFit === "exact") &&
    (!implementationRequested ||
      !result.implementationFit ||
      [
        "verified_domain_implementation",
        "supported_domain_implementation",
      ].includes(result.implementationFit)) &&
    result.seniorityFit !== "mismatch" &&
    !["not_verified", "conflicting"].includes(result.locationFit || "");
  const goodEligible =
    (normalizedTargetTier(result) !== "exact_supported" ||
      supportedSpecializationActionable) &&
    !["exposure_only", "conflicting", "unknown"].includes(
      result.primaryRoleFit || "",
    ) &&
    result.seniorityFit !== "mismatch" &&
    !["not_verified", "conflicting"].includes(result.locationFit || "");
  const directUnknownSecondaryEligible =
    ["current_direct", "historical_direct"].includes(
      result.score.roleEvidenceKind || "",
    ) &&
    result.primaryRoleFit === "exact" &&
    result.seniorityFit === "verified" &&
    result.locationFit === "verified" &&
    result.implementationFit === "not_verified" &&
    result.implementationEvidenceLevel !== "contradicted_evidence";
  const requestedDimensionsStrong =
    dimensionScore >= 90 &&
    weakestDimension >= 55 &&
    qualityFactor >= 0.55 &&
    strongEligible;
  const directRoleWithUnknownRequestedEvidence =
    ["current_direct", "historical_direct"].includes(
      result.score.roleEvidenceKind || "",
    ) &&
    !implementationRequested &&
    result.primaryRoleFit === "exact" &&
    dimensionScore >= 65 &&
    result.seniorityFit !== "mismatch" &&
    !["not_verified", "conflicting"].includes(result.locationFit || "");
  const requestedDimensionsGood =
    goodEligible &&
    ((dimensionScore >= 65 && weakestDimension >= 50) ||
      directRoleWithUnknownRequestedEvidence);
  const exactWithLocationUncertainty =
    normalizedTargetTier(result) === "exact_verified" &&
    ["current_direct", "historical_direct", "same_domain"].includes(
      result.score.roleEvidenceKind || "",
    ) &&
    result.locationFit === "not_verified" &&
    result.seniorityFit !== "mismatch";
  const baseTier = requestedDimensionsStrong
    ? "Strong Match"
    : requestedDimensionsGood ||
        exactWithLocationUncertainty ||
        (result.score.finalScore >= 80 && goodEligible) ||
        directUnknownSecondaryEligible
      ? "Good Match"
      : result.score.finalScore >= 50
        ? "Potential Match"
        : "Broad Match";
  const roleEvidenceKind = result.score.roleEvidenceKind;
  const roleCeiling =
    roleEvidenceKind === "current_direct" ||
    roleEvidenceKind === "historical_direct"
      ? "Strong Match"
      : roleEvidenceKind === "same_domain" &&
          result.score.professionalRoleContext
        ? "Good Match"
        : roleEvidenceKind
          ? "Potential Match"
          : result.primaryRoleFit === "exact" ||
              (!result.primaryRoleFit && result.score.finalScore >= 90)
            ? "Strong Match"
            : result.primaryRoleFit === "adjacent"
              ? "Good Match"
              : "Potential Match";
  const tierRank = {
    "Broad Match": 0,
    "Potential Match": 1,
    "Good Match": 2,
    "Strong Match": 3,
  } as const;
  const evidenceCeiling = requestedPrimarySpecializationVerified
    ? roleCeiling
    : "Potential Match";
  return tierRank[baseTier] <= tierRank[evidenceCeiling]
    ? baseTier
    : evidenceCeiling;
}

export function recruiterRankingReasons(result: RecruiterSearchSignal) {
  const reasons: string[] = [];
  if (result.explanation.matchedSapModules.length)
    reasons.push(
      `Module match: ${recruiterSearchChips(result.explanation.matchedSapModules, 3).join(", ")}`,
    );
  if (result.score.titleScore >= 50) reasons.push("Relevant current title");
  if (result.score.locationScore >= 50) reasons.push("Location match");
  if (result.explanation.matchedSkills.length)
    reasons.push(
      `Skill match: ${recruiterSearchChips(result.explanation.matchedSkills, 3).join(", ")}`,
    );
  return reasons.filter(Boolean).slice(0, 3);
}

export function recruiterCriticalGap(result: RecruiterSearchSignal) {
  const material = result.explanation.warnings.find((warning) =>
    /location|work authori[sz]ation|certif|availability/i.test(warning),
  );
  if (material) return material;
  const missing = result.explanation.missingSkills.find(
    (skill) => normalizedSignal(skill) !== "implementation",
  );
  return missing ? `Required skill not confirmed: ${missing}` : "";
}
