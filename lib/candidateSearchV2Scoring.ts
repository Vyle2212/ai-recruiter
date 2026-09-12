import type {
  CandidateSearchV2Document,
  CandidateSearchV2Explanation,
  CandidateSearchV2Result,
  CandidateSearchV2ScoreBreakdown,
  CandidateSpecializationEvidenceLevel,
} from "./candidateSearchV2Types";

import type { NormalizedCandidateSearchV2Request } from "./candidateSearchV2Request";

import { candidateSearchV2PrimaryModuleScore } from "./candidateSearchV2ModuleRelevance";
import {
  canonicalSearchConcept,
  conceptSupportOrder,
  conceptsInText,
  lifecycleTermsInText,
  mostSpecificSearchConcepts,
  searchConcept,
  searchConceptRelation,
  searchConceptRelationStrength,
  searchConceptSemanticEvidence,
  titleSupportsSearchConcept,
} from "./candidateSearchConcepts";
import { parseRecruiterSearchIntent } from "./recruiterSearchPresentation";
import {
  hasStableNicheEligibility,
  isCentralNicheTarget,
  qualifyNicheTargetEvidence,
  type QualifiedNicheTargetEvidence,
} from "./nicheTargetEvidence";
import { targetModuleDeliveryEvidence } from "./searchV2Lifecycle";

function clampScore(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function isGroundedProfessionalTitle(value: string | null | undefined) {
  const title = String(value || "")
    .normalize("NFKC")
    .trim();
  if (!title || title.length > 140 || title.split(/\s+/).length > 18)
    return false;
  if (/^[\s\u2022\u25cf\u25aa\uf0b7]/u.test(title)) return false;
  if (
    /^(?:a|an)\s+(?:passionate|dedicated|resourceful|experienced|results[- ]driven)\b/i.test(
      title,
    )
  )
    return false;
  return !/\b(?:professional summary|career objective|profile summary)\b/i.test(
    title,
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function calculateTermCoverage(terms: string[], text: string) {
  if (terms.length === 0) {
    return 0;
  }

  const matched = terms.filter((term) => text.includes(term));

  return (matched.length / terms.length) * 100;
}

function calculateListCoverage(required: string[], available: string[]) {
  if (required.length === 0) {
    return 0;
  }

  const normalizedAvailable = available.map(normalize);

  const matched = required.filter((requiredValue) =>
    normalizedAvailable.some(
      (availableValue) =>
        availableValue.includes(requiredValue) ||
        requiredValue.includes(availableValue),
    ),
  );

  return (matched.length / required.length) * 100;
}

function calculateRecencyScore(
  updatedAt: string | null | undefined,
  now: Date = new Date(),
) {
  if (!updatedAt) {
    return 0;
  }

  const timestamp = Date.parse(updatedAt);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const ageInDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);

  if (ageInDays <= 30) {
    return 100;
  }

  if (ageInDays <= 90) {
    return 80;
  }

  if (ageInDays <= 180) {
    return 60;
  }

  if (ageInDays <= 365) {
    return 40;
  }

  return 20;
}

export function scoreCandidateSearchV2Document(
  candidate: CandidateSearchV2Document,
  request: NormalizedCandidateSearchV2Request,
): CandidateSearchV2Result {
  const searchableText = normalize(
    [
      candidate.candidateName,
      candidate.currentTitle,
      candidate.currentEmployer,
      candidate.country,
      candidate.location,
      ...(candidate.skills || []),
      ...(candidate.sapModules || []),
      ...(candidate.industries || []),
      ...(candidate.languages || []),
      candidate.searchableText,
    ].join(" "),
  );

  const matchedTerms = request.terms.filter((term) =>
    searchableText.includes(term),
  );

  const requestedSkills = request.filters.skills || [];

  const requestedSapModules = request.filters.sapModules || [];

  const requestedIndustries = request.filters.industries || [];

  const candidateSkills = (candidate.skills || []).map(normalize);

  const candidateSapModules = (candidate.sapModules || []).map(normalize);

  const candidateIndustries = (candidate.industries || []).map(normalize);

  const matchedSkills = requestedSkills.filter((skill) =>
    candidateSkills.some(
      (candidateSkill) =>
        candidateSkill.includes(skill) || skill.includes(candidateSkill),
    ),
  );

  const matchedSapModules = requestedSapModules.filter((moduleName) =>
    candidateSapModules.some(
      (candidateModule) =>
        candidateModule.includes(moduleName) ||
        moduleName.includes(candidateModule),
    ),
  );

  const matchedIndustries = requestedIndustries.filter((industry) =>
    candidateIndustries.some(
      (candidateIndustry) =>
        candidateIndustry.includes(industry) ||
        industry.includes(candidateIndustry),
    ),
  );

  const missingSkills = requestedSkills.filter(
    (skill) => !matchedSkills.includes(skill),
  );

  const keywordScore = calculateTermCoverage(request.terms, searchableText);

  const semanticScore = clampScore((candidate.semanticSimilarity ?? 0) * 100);

  const primaryModuleScore = candidateSearchV2PrimaryModuleScore(
    candidate,
    request,
  );

  const skillScore = Math.max(
    calculateListCoverage(requestedSkills, candidate.skills || []),
    calculateListCoverage(requestedSapModules, candidate.sapModules || []),
    primaryModuleScore,
  );

  const titleScore = calculateTermCoverage(
    request.terms,
    normalize(candidate.currentTitle),
  );

  const employerScore = calculateTermCoverage(
    request.terms,
    normalize(candidate.currentEmployer),
  );

  const locationScore = calculateTermCoverage(
    request.terms,
    normalize([candidate.location, candidate.country].join(" ")),
  );

  const industryScore = calculateListCoverage(
    requestedIndustries,
    candidate.industries || [],
  );

  const qualityScore = clampScore(candidate.profileQualityScore ?? 0);

  const confidenceScore = clampScore(candidate.dataConfidenceScore ?? 0);

  const recencyScore = calculateRecencyScore(candidate.updatedAt);

  const baseKeywordComponent =
    keywordScore * 0.4 +
    skillScore * 0.25 +
    titleScore * 0.15 +
    employerScore * 0.05 +
    locationScore * 0.05 +
    industryScore * 0.1;

  const weightedScore =
    baseKeywordComponent * request.keywordWeight +
    semanticScore * request.semanticWeight +
    qualityScore * request.qualityWeight +
    recencyScore * request.recencyWeight;

  const denominator =
    request.keywordWeight +
    request.semanticWeight +
    request.qualityWeight +
    request.recencyWeight;

  const baseRelevanceScore = denominator > 0 ? weightedScore / denominator : 0;
  const dimensions: number[] = [];
  const requestedDomains = mostSpecificSearchConcepts([
    ...new Set([
      ...conceptsInText(request.query),
      ...[...requestedSkills, ...requestedSapModules]
        .map(canonicalSearchConcept)
        .filter((value): value is string => Boolean(value)),
    ]),
  ]);
  const stableNicheEligibility = new Map(
    requestedDomains.map((domain) => [
      domain,
      hasStableNicheEligibility(domain, candidate),
    ]),
  );
  const professionalTitleConcepts = new Set([
    ...(isGroundedProfessionalTitle(candidate.currentTitle)
      ? conceptsInText(candidate.currentTitle)
      : []),
    ...(candidate.historicalTitles || [])
      .filter(isGroundedProfessionalTitle)
      .flatMap(conceptsInText),
  ]);
  const candidateConcepts = new Set([
    ...professionalTitleConcepts,
    ...Object.keys(candidate.domainEvidence || {}).filter((id) =>
      ["PRIMARY", "STRONG", "SUPPORTED"].includes(
        candidate.domainEvidence?.[id] || "UNVERIFIED",
      ),
    ),
  ]);
  const skillConcepts = new Set(
    [
      ...(candidate.skills || []).flatMap((value) => [
        canonicalSearchConcept(value),
        ...conceptsInText(value),
      ]),
      ...(candidate.sapModules || []).flatMap((value) => [
        canonicalSearchConcept(value),
        ...conceptsInText(value),
      ]),
    ].filter((value): value is string => Boolean(value)),
  );
  const sourceTextConcepts = new Set(conceptsInText(candidate.searchableText));
  const domainStrengths: number[] = [];
  const specializationLevels: CandidateSpecializationEvidenceLevel[] = [];
  const qualifiedProfessionalContexts: boolean[] = [];
  const qualifiedNicheEvidences: QualifiedNicheTargetEvidence[] = [];
  let hasPrecomputedTargetContext = false;
  const candidateSemanticConcepts = new Set([
    ...candidateConcepts,
    ...skillConcepts,
    ...sourceTextConcepts,
  ]);
  const candidateSemanticText = [
    candidate.currentTitle,
    ...(candidate.historicalTitles || []),
    ...(candidate.skills || []),
    ...(candidate.sapModules || []),
    candidate.searchableText,
  ]
    .filter(Boolean)
    .join(" ");
  for (const domain of requestedDomains) {
    const titleDirect =
      isGroundedProfessionalTitle(candidate.currentTitle) &&
      titleSupportsSearchConcept(candidate.currentTitle, domain);
    const historicalTitleDirect = (candidate.historicalTitles || []).some(
      (title) =>
        isGroundedProfessionalTitle(title) &&
        titleSupportsSearchConcept(title, domain),
    );
    const classification = candidate.domainEvidence?.[domain] || "UNVERIFIED";
    const explicitlyNotVerified =
      Object.prototype.hasOwnProperty.call(
        candidate.domainEvidence || {},
        domain,
      ) && ["UNVERIFIED", "EXPOSURE"].includes(classification);
    const relationshipStrength = [...candidateConcepts].reduce(
      (best, evidence) => {
        const relation = searchConceptRelation(domain, evidence);
        const directChild = searchConcept(evidence)?.parent === domain;
        return Math.max(
          best,
          relation === "EXACT"
            ? 0.82
            : relation === "CHILD"
              ? directChild
                ? 0.65
                : 0.5
              : searchConceptRelationStrength(relation),
        );
      },
      0,
    );
    const structuredConceptStrength = searchConcept(domain)?.parent
      ? [...skillConcepts].reduce((best, evidence) => {
          const relation = searchConceptRelation(domain, evidence);
          return Math.max(
            best,
            relation === "EXACT"
              ? 0.72
              : searchConceptRelationStrength(relation),
          );
        }, 0)
      : 0;
    const relations = [...candidateSemanticConcepts].map((evidence) =>
      searchConceptRelation(domain, evidence),
    );
    const structuredRelations = [...skillConcepts].map((evidence) =>
      searchConceptRelation(domain, evidence),
    );
    const exactStructured = structuredRelations.includes("EXACT");
    const parentVerified = relations.includes("PARENT");
    const adjacentEvidence = relations.some((relation) =>
      ["CHILD", "RELATED", "ADJACENT"].includes(relation),
    );
    const directChildProfessionalEvidence = [...professionalTitleConcepts].some(
      (evidence) => searchConcept(evidence)?.parent === domain,
    );
    const semanticEvidence = searchConceptSemanticEvidence(
      domain,
      candidateSemanticText,
    );
    const structuredPrimaryConcept = canonicalSearchConcept(
      candidate.sapModules?.[0],
    );
    const competingStructuredPrimary = Boolean(
      structuredPrimaryConcept &&
      !["EXACT", "PARENT"].includes(
        searchConceptRelation(domain, structuredPrimaryConcept),
      ),
    );
    const competingPrimaryEvidence =
      competingStructuredPrimary ||
      Object.entries(candidate.domainEvidence || {}).some(
        ([evidenceDomain, evidenceClass]) =>
          !["EXACT", "PARENT"].includes(
            searchConceptRelation(domain, evidenceDomain),
          ) &&
          (evidenceClass === "PRIMARY" || evidenceClass === "STRONG"),
      );
    const hasSapEvidence = [...candidateSemanticConcepts].some(
      (evidence) => searchConcept(evidence)?.ecosystem === "SAP",
    );
    const centralNicheTarget = isCentralNicheTarget(domain);
    const qualifiedNicheEvidence = centralNicheTarget
      ? qualifyNicheTargetEvidence(domain, candidate)
      : null;
    if (qualifiedNicheEvidence)
      qualifiedNicheEvidences.push(qualifiedNicheEvidence);
    const precomputedTargetContext =
      centralNicheTarget &&
      (classification !== "UNVERIFIED" || exactStructured);
    hasPrecomputedTargetContext ||= precomputedTargetContext;
    if (qualifiedNicheEvidence?.professionalContext)
      qualifiedProfessionalContexts.push(true);
    const targetSpecificSupport =
      directChildProfessionalEvidence || semanticEvidence.supported;
    const evidenceLevel: CandidateSpecializationEvidenceLevel =
      centralNicheTarget
        ? qualifiedNicheEvidence?.level === "exact_verified"
          ? "exact_verified"
          : qualifiedNicheEvidence?.level === "exact_supported"
            ? "exact_supported"
            : qualifiedNicheEvidence?.level === "related"
              ? qualifiedNicheEvidence.relatedConcepts.some(
                  (evidence) =>
                    searchConceptRelation(domain, evidence) === "PARENT",
                )
                ? "parent_verified"
                : "adjacent"
              : hasSapEvidence
                ? "generic_sap"
                : "not_verified"
        : !explicitlyNotVerified &&
            (titleDirect ||
              historicalTitleDirect ||
              classification === "PRIMARY" ||
              classification === "STRONG" ||
              exactStructured ||
              (semanticEvidence.directExact && !competingPrimaryEvidence))
          ? "exact_verified"
          : !explicitlyNotVerified && targetSpecificSupport
            ? "exact_supported"
            : parentVerified
              ? "parent_verified"
              : adjacentEvidence || classification === "EXPOSURE"
                ? "adjacent"
                : hasSapEvidence
                  ? "generic_sap"
                  : "not_verified";
    const supportedStrength =
      qualifiedNicheEvidence?.level === "exact_supported"
        ? qualifiedNicheEvidence.strength
        : semanticEvidence.strongMatches.length ||
            semanticEvidence.clusteredPartialMatches.length >=
              (searchConcept(domain)?.semanticEvidence?.minimumPartialMatches ??
                3)
          ? 0.84
          : semanticEvidence.exactMatches.length
            ? 0.72
            : 0.78;
    const strength =
      evidenceLevel === "exact_verified"
        ? 1
        : evidenceLevel === "exact_supported"
          ? supportedStrength * (competingPrimaryEvidence ? 0.85 : 1)
          : evidenceLevel === "parent_verified"
            ? 0.48
            : evidenceLevel === "adjacent"
              ? Math.max(0.28, relationshipStrength, structuredConceptStrength)
              : evidenceLevel === "generic_sap"
                ? 0.12
                : 0;
    specializationLevels.push(evidenceLevel);
    domainStrengths.push(strength);
    dimensions.push(strength);
  }
  const seniorityRequested = request.terms.some((term) =>
    /^(?:senior|sr|lead|principal|manager|architect|head|director)$/i.test(
      term,
    ),
  );
  const normalizedTitle = normalize(candidate.currentTitle);
  const explicitJunior = /\b(?:junior|jr\.?|trainee|intern|graduate)\b/i.test(
    normalizedTitle,
  );
  const explicitSenior =
    /\b(?:senior|sr\.?|lead|principal|manager|architect|head|director)\b/i.test(
      normalizedTitle,
    );
  const seniorityMatch = !seniorityRequested
    ? "unverified"
    : explicitJunior
      ? "mismatch"
      : explicitSenior ||
          candidate.seniorityEvidenceLevel === "verified_structured_evidence"
        ? "verified"
        : candidate.seniorityEvidenceLevel === "source_text_evidence" ||
            candidate.seniorityEvidenceLevel === "inferred_evidence" ||
            Number(candidate.totalYearsExperience || 0) >= 8
          ? "supported"
          : "unverified";
  if (seniorityRequested)
    dimensions.push(
      seniorityMatch === "verified"
        ? 1
        : seniorityMatch === "supported"
          ? 0.65
          : 0,
    );
  const requestedCountries = [
    ...new Set([
      ...(request.filters.countries || []),
      ...parseRecruiterSearchIntent(request.query).countries.map(normalize),
    ]),
  ];
  let locationFit: "verified" | "supported" | "not_verified" | "conflicting" =
    "not_verified";
  if (requestedCountries.length) {
    const candidateLocation = normalize(
      `${candidate.location || ""} ${candidate.country || ""}`,
    );
    const matchesLocation = requestedCountries.some((country) =>
      candidateLocation.includes(normalize(country)),
    );
    locationFit = matchesLocation
      ? candidate.locationEvidenceState === "VERIFIED"
        ? "verified"
        : "supported"
      : candidateLocation &&
          ["VERIFIED", "SUPPORTED", "CONFLICTING"].includes(
            candidate.locationEvidenceState || "",
          )
        ? "conflicting"
        : "not_verified";
    dimensions.push(
      locationFit === "verified" ? 1 : locationFit === "supported" ? 0.7 : 0,
    );
  }
  const requestedLifecycle =
    lifecycleTermsInText(request.query)[0] ||
    requestedSkills.find((skill) => lifecycleTermsInText(skill).length > 0) ||
    null;
  const capabilityRequested = Boolean(requestedLifecycle);
  const implementationRequested =
    normalize(requestedLifecycle) === "implementation";
  const titleTokens = request.terms.filter(
    (term) =>
      !(request.filters.countries || []).includes(term) &&
      !/^(?:senior|sr|lead|principal|manager|architect|head|director|implementation|rollout|greenfield|brownfield)$/i.test(
        term,
      ),
  );
  const titleTermScore = calculateTermCoverage(titleTokens, normalizedTitle);
  const titleSupportsDomain = (domain: string) =>
    isGroundedProfessionalTitle(candidate.currentTitle) &&
    titleSupportsSearchConcept(normalizedTitle, domain);
  const directDomainTitle = requestedDomains.some(titleSupportsDomain);
  const historicalDirectDomain = requestedDomains.some((domain) =>
    (candidate.historicalTitles || []).some(
      (title) =>
        isGroundedProfessionalTitle(title) &&
        titleSupportsSearchConcept(title, domain),
    ),
  );
  const competingPrimaryDomain = Object.entries(
    candidate.domainEvidence || {},
  ).some(
    ([domain, strength]) =>
      !requestedDomains.includes(domain) &&
      (strength === "PRIMARY" || strength === "STRONG"),
  );
  const strongestDomain = domainStrengths.length
    ? Math.max(...domainStrengths)
    : 0;
  const specializationStrength = domainStrengths.length
    ? domainStrengths.reduce((sum, strength) => sum + strength, 0) /
      domainStrengths.length
    : 0;
  const evidenceRank = (level: CandidateSpecializationEvidenceLevel) =>
    level === "exact_verified"
      ? 5
      : level === "exact_supported"
        ? 4
        : level === "parent_verified"
          ? 3
          : level === "adjacent"
            ? 2
            : level === "generic_sap"
              ? 1
              : 0;
  const specializationEvidenceRank = specializationLevels.length
    ? Math.min(...specializationLevels.map(evidenceRank))
    : 0;
  const specializationEvidenceLevel: CandidateSpecializationEvidenceLevel =
    specializationEvidenceRank === 5
      ? "exact_verified"
      : specializationEvidenceRank === 4
        ? "exact_supported"
        : specializationEvidenceRank === 3
          ? "parent_verified"
          : specializationEvidenceRank === 2
            ? "adjacent"
            : specializationEvidenceRank === 1
              ? "generic_sap"
              : "not_verified";
  const normalizedTierRank = (level: QualifiedNicheTargetEvidence["tier"]) =>
    level === "exact_verified"
      ? 4
      : level === "exact_supported"
        ? 3
        : level === "related"
          ? 2
          : 1;
  const matchedProfessionalTargetTitle = [
    candidate.currentTitle,
    ...(candidate.historicalTitles || []),
  ].find(
    (title): title is string =>
      Boolean(title) &&
      isGroundedProfessionalTitle(title) &&
      requestedDomains.some((domain) =>
        titleSupportsSearchConcept(title!, domain),
      ),
  );
  const professionalExactTarget = Boolean(matchedProfessionalTargetTitle);
  const targetEvidence = qualifiedNicheEvidences.length
    ? [...qualifiedNicheEvidences].sort(
        (left, right) =>
          normalizedTierRank(right.tier) - normalizedTierRank(left.tier) ||
          right.strength - left.strength,
      )[0]
    : {
        target: requestedDomains[0] || "",
        tier: professionalExactTarget
          ? ("exact_verified" as const)
          : specializationEvidenceRank >= 4
            ? ("exact_supported" as const)
            : specializationEvidenceRank >= 2
              ? ("related" as const)
              : ("none" as const),
        strength: specializationStrength,
        evidenceSourceType: professionalExactTarget
          ? ("raw_title" as const)
          : specializationEvidenceRank >= 4
            ? ("direct_skill" as const)
            : ("none" as const),
        matchedLiteral: matchedProfessionalTargetTitle || null,
        matchedIndicators: [],
        sourceField: professionalExactTarget
          ? "candidates.title"
          : specializationEvidenceRank >= 4
            ? "candidates.skills"
            : null,
        trusted: professionalExactTarget || specializationEvidenceRank >= 4,
        reasonCode: professionalExactTarget
          ? ("trusted_literal" as const)
          : specializationEvidenceRank >= 4
            ? ("trusted_professional_cluster" as const)
            : ("no_candidate_target_evidence" as const),
        relatedConcepts: [],
        sourceRecordId: professionalExactTarget ? candidate.candidateId : null,
        sourceValueProvenance: professionalExactTarget
          ? ("candidate_record_raw" as const)
          : null,
        professionalContextType: professionalExactTarget
          ? ("title" as const)
          : specializationEvidenceRank >= 4
            ? ("direct_skill" as const)
            : ("none" as const),
      };
  const contextStopWords = new Set([
    "and",
    "the",
    "for",
    "with",
    "consultant",
    "developer",
    "engineer",
    "manager",
    "lead",
    "senior",
  ]);
  const titleWords = new Set(
    normalizedTitle
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !contextStopWords.has(word)),
  );
  const sharesDomainTitleContext = requestedDomains.some((domain) => {
    const concept = searchConcept(domain);
    return [concept?.label, ...(concept?.aliases || [])]
      .flatMap((value) => normalize(value).split(/\s+/))
      .some(
        (word) =>
          word.length >= 3 &&
          !contextStopWords.has(word) &&
          titleWords.has(word),
      );
  });
  const sameDomainProfessionalContext =
    qualifiedProfessionalContexts.length > 0 ||
    sharesDomainTitleContext ||
    requestedDomains.some((domain) =>
      [...professionalTitleConcepts].some((evidence) =>
        ["EXACT", "CHILD", "PARENT", "RELATED", "ADJACENT"].includes(
          searchConceptRelation(domain, evidence),
        ),
      ),
    );
  const exactSkillOnly = requestedDomains.some((domain) =>
    [...skillConcepts].some(
      (evidence) => searchConceptRelation(domain, evidence) === "EXACT",
    ),
  );
  const roleEvidenceKind = directDomainTitle
    ? "current_direct"
    : historicalDirectDomain
      ? "historical_direct"
      : sameDomainProfessionalContext && strongestDomain >= 0.55
        ? "same_domain"
        : sameDomainProfessionalContext ||
            exactSkillOnly ||
            hasPrecomputedTargetContext
          ? "exposure_only"
          : strongestDomain > 0
            ? "keyword_only"
            : "none";
  const roleProximityRank =
    roleEvidenceKind === "current_direct"
      ? 5
      : roleEvidenceKind === "historical_direct"
        ? 4
        : roleEvidenceKind === "same_domain"
          ? 3
          : roleEvidenceKind === "exposure_only"
            ? 2
            : roleEvidenceKind === "keyword_only"
              ? 1
              : 0;
  const genericAnchorTitle =
    /^(?:senior\s+)?(?:sap\s+)?(?:consultant|project manager|program manager|manager)$/i.test(
      normalizedTitle,
    );
  const genericManagerAnchor =
    /^(?:senior\s+)?(?:sap\s+)?(?:project manager|program manager|manager)$/i.test(
      normalizedTitle,
    );
  const roleEvidenceEligible =
    requestedDomains.length === 0 ||
    (roleProximityRank >= 2 &&
      !(
        (competingPrimaryDomain &&
          specializationEvidenceRank <= 2 &&
          !directDomainTitle &&
          !historicalDirectDomain) ||
        (roleEvidenceKind === "exposure_only" &&
          genericAnchorTitle &&
          (!exactSkillOnly || genericManagerAnchor)) ||
        (roleEvidenceKind === "same_domain" &&
          competingPrimaryDomain &&
          !sameDomainProfessionalContext)
      ));
  const groundedTargetAssignment = requestedDomains.some(
    (domain) =>
      targetModuleDeliveryEvidence(candidate, domain).directTargetAssignments
        .length > 0,
  );
  const professionalTargetSupport =
    professionalExactTarget ||
    qualifiedProfessionalContexts.length > 0 ||
    groundedTargetAssignment;
  const primaryRoleFit = requestedDomains.length
    ? specializationEvidenceRank >= 4 && professionalTargetSupport
      ? "exact"
      : specializationEvidenceRank >= 4
        ? "adjacent"
        : competingPrimaryDomain && strongestDomain <= 0.25
          ? "conflicting"
          : specializationEvidenceRank >= 2
            ? "adjacent"
            : strongestDomain > 0
              ? "exposure_only"
              : "unknown"
    : titleTermScore >= 60
      ? "exact"
      : titleTermScore >= 35
        ? "adjacent"
        : titleTermScore > 0
          ? "exposure_only"
          : "unknown";
  const roleRelevanceScore =
    primaryRoleFit === "exact"
      ? 100
      : primaryRoleFit === "adjacent"
        ? 75
        : primaryRoleFit === "exposure_only"
          ? 35
          : primaryRoleFit === "conflicting"
            ? 10
            : 20;
  const lifecyclePresent = requestedLifecycle
    ? candidateSkills.some(
        (skill) => normalize(skill) === normalize(requestedLifecycle),
      )
    : false;
  const rawImplementationStrength =
    normalize(requestedLifecycle) === "implementation"
      ? candidate.implementationEvidenceLevel === "verified_structured_evidence"
        ? 1
        : candidate.implementationEvidenceLevel === "source_text_evidence"
          ? 0.6
          : candidate.implementationEvidenceLevel === "inferred_evidence"
            ? 0.2
            : 0
      : lifecyclePresent
        ? 1
        : 0;
  const linkedImplementationVerdicts = requestedDomains.map(
    (domain) =>
      candidate.domainImplementationEvidence?.[domain] || "UNVERIFIED",
  );
  const linkedImplementationStrength = linkedImplementationVerdicts.includes(
    "VERIFIED",
  )
    ? 1
    : linkedImplementationVerdicts.includes("SUPPORTED")
      ? 0.6
      : 0;
  const implementationFit = !implementationRequested
    ? "not_verified"
    : candidate.implementationEvidenceLevel === "contradicted_evidence"
      ? "mismatch"
      : rawImplementationStrength === 0
        ? "not_verified"
        : linkedImplementationStrength >= 1
          ? "verified_domain_implementation"
          : linkedImplementationStrength >= 0.5
            ? "supported_domain_implementation"
            : primaryRoleFit === "exact" && rawImplementationStrength >= 0.5
              ? "supported_domain_implementation"
              : rawImplementationStrength >= 0.5
                ? "generic_implementation"
                : "implementation_exposure";
  const implementationStrength =
    implementationFit === "verified_domain_implementation"
      ? 1
      : implementationFit === "supported_domain_implementation"
        ? 0.6
        : implementationFit === "generic_implementation"
          ? 0.25
          : implementationFit === "implementation_exposure"
            ? 0.1
            : implementationFit === "mismatch"
              ? -0.35
              : 0;
  const requestedCapabilityStrength = implementationRequested
    ? implementationStrength
    : capabilityRequested && lifecyclePresent
      ? 1
      : 0;
  const requestedQualifierCount =
    Number(seniorityRequested) +
    Number(requestedCountries.length > 0) +
    Number(capabilityRequested);
  const supportedQualifierCount =
    Number(
      !seniorityRequested ||
        seniorityMatch === "verified" ||
        seniorityMatch === "supported",
    ) +
    Number(
      requestedCountries.length === 0 ||
        locationFit === "verified" ||
        locationFit === "supported",
    ) +
    Number(!capabilityRequested || requestedCapabilityStrength >= 0.5);
  const explicitAnchorExposure = requestedDomains.some(
    (domain) => candidate.domainEvidence?.[domain] === "EXPOSURE",
  );
  const weakSameDomainTail =
    roleEvidenceKind === "same_domain" &&
    requestedQualifierCount >= 2 &&
    supportedQualifierCount < 2;
  // Stable eligibility is independent of the final niche qualification tier.
  const nicheEligibility = requestedDomains.every(
    (domain) =>
      !isCentralNicheTarget(domain) ||
      stableNicheEligibility.get(domain) === true,
  );
  const roleDomainEligible = requestedDomains.some(isCentralNicheTarget)
    ? nicheEligibility
    : roleEvidenceEligible && !weakSameDomainTail;
  if (capabilityRequested) dimensions.push(requestedCapabilityStrength);
  const highValueConstraints = [
    ...domainStrengths.map((strength) => ({
      weight: 45 / Math.max(1, domainStrengths.length),
      strength,
    })),
    ...(requestedCountries.length
      ? [
          {
            weight: 25,
            strength:
              locationFit === "verified"
                ? 1
                : locationFit === "supported"
                  ? 0.7
                  : locationFit === "conflicting"
                    ? -0.4
                    : 0,
          },
        ]
      : []),
    ...(seniorityRequested
      ? [
          {
            weight: 20,
            strength:
              seniorityMatch === "verified"
                ? 1
                : seniorityMatch === "supported"
                  ? 0.65
                  : seniorityMatch === "mismatch"
                    ? -0.25
                    : 0,
          },
        ]
      : []),
    ...(capabilityRequested
      ? [{ weight: 10, strength: requestedCapabilityStrength }]
      : []),
  ];
  const highValueConstraintWeight = highValueConstraints.reduce(
    (sum, constraint) => sum + constraint.weight,
    0,
  );
  const highValueConstraintCoverageScore = highValueConstraintWeight
    ? clampScore(
        (highValueConstraints.reduce(
          (sum, constraint) => sum + constraint.weight * constraint.strength,
          0,
        ) /
          highValueConstraintWeight) *
          100,
      )
    : clampScore(baseRelevanceScore);
  const supportedHighValueConstraints = highValueConstraints.filter(
    (constraint) => constraint.strength >= 0.5,
  ).length;
  const matchedDimensions = dimensions.filter((value) => value >= 0.5).length;
  const dimensionScore = dimensions.length
    ? (dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length) *
      100
    : baseRelevanceScore;
  const weakestDimensionStrength = dimensions.length
    ? Math.min(...dimensions) * 100
    : 100;
  const profileFields = candidate.profileEvidence
    ? Object.values(candidate.profileEvidence)
    : [];
  const observedProfileQuality = profileFields.length
    ? profileFields.filter(Boolean).length / profileFields.length
    : 0.5;
  const profileQualityFactor = Math.max(
    0.2,
    Math.min(1, qualityScore > 0 ? qualityScore / 100 : observedProfileQuality),
  );
  const rolePoints =
    primaryRoleFit === "exact"
      ? 35
      : primaryRoleFit === "adjacent"
        ? 27
        : primaryRoleFit === "exposure_only"
          ? 12
          : primaryRoleFit === "conflicting"
            ? 4
            : 8;
  const implementationPoints = implementationRequested
    ? implementationFit === "verified_domain_implementation"
      ? 20
      : implementationFit === "supported_domain_implementation"
        ? 12
        : implementationFit === "generic_implementation"
          ? 5
          : implementationFit === "implementation_exposure"
            ? 2
            : implementationFit === "mismatch"
              ? -8
              : 0
    : capabilityRequested
      ? requestedCapabilityStrength * 20
      : 0;
  const seniorityPoints = !seniorityRequested
    ? 15
    : seniorityMatch === "verified"
      ? 15
      : seniorityMatch === "supported"
        ? 10
        : 0;
  const locationPoints = !requestedCountries.length
    ? 15
    : locationFit === "verified"
      ? 15
      : locationFit === "supported"
        ? 11
        : locationFit === "not_verified"
          ? 4
          : -10;
  const supportingDomainPoints = Math.min(8, strongestDomain * 8);
  const qualityPoints = profileQualityFactor * 7;
  const finalScoreValue =
    rolePoints +
    implementationPoints +
    seniorityPoints +
    locationPoints +
    supportingDomainPoints +
    qualityPoints;
  const tierCap =
    specializationEvidenceRank <= 3 ||
    !roleDomainEligible ||
    primaryRoleFit === "exposure_only" ||
    primaryRoleFit === "conflicting" ||
    primaryRoleFit === "unknown" ||
    seniorityMatch === "mismatch" ||
    (requestedCountries.length > 0 &&
      (locationFit === "not_verified" || locationFit === "conflicting"))
      ? "potential"
      : primaryRoleFit === "adjacent" ||
          (capabilityRequested && requestedCapabilityStrength < 0.5) ||
          profileQualityFactor < 0.55
        ? "good"
        : "strong";
  const tierScoreCap =
    seniorityMatch === "mismatch"
      ? 69
      : tierCap === "potential"
        ? 74
        : tierCap === "good"
          ? 89
          : 100;
  const discoveryFloor =
    strongestDomain > 0 &&
    (primaryRoleFit === "exposure_only" || primaryRoleFit === "conflicting")
      ? 50
      : 0;
  const finalScore = clampScore(
    Math.min(Math.max(finalScoreValue, discoveryFloor), tierScoreCap),
  );

  const score: CandidateSearchV2ScoreBreakdown = {
    keywordScore: clampScore(keywordScore),

    semanticScore: clampScore(semanticScore),

    skillScore: clampScore(skillScore),

    titleScore: clampScore(titleScore),

    employerScore: clampScore(employerScore),

    locationScore: clampScore(locationScore),

    industryScore: clampScore(industryScore),

    qualityScore: clampScore(qualityScore),

    confidenceScore: clampScore(confidenceScore),

    recencyScore: clampScore(recencyScore),

    requestedDimensions: dimensions.length,
    matchedDimensions,
    dimensionScore: clampScore(dimensionScore),
    weakestDimensionStrength: clampScore(weakestDimensionStrength),
    roleRelevanceScore,
    specializationStrength,
    specializationEvidenceRank,
    seniorityMatch,
    implementationStrength,
    profileQualityFactor,
    tierCap,
    roleEvidenceKind,
    roleProximityRank,
    roleDomainEligible,
    professionalRoleContext: sameDomainProfessionalContext,
    highValueConstraintCoverageScore,
    supportedHighValueConstraints,
    requestedHighValueConstraints: highValueConstraints.length,

    finalScore,
  };

  const reasons: string[] = [];

  if (primaryModuleScore >= 100) {
    reasons.push("Primary SAP module exactly matches the search requirement.");
  } else if (primaryModuleScore >= 80) {
    reasons.push("Current title provides direct SAP module evidence.");
  }

  if (matchedSkills.length) {
    reasons.push(`Matched skills: ${matchedSkills.join(", ")}`);
  }

  if (matchedSapModules.length) {
    reasons.push(`Matched SAP modules: ${matchedSapModules.join(", ")}`);
  }

  if (titleScore >= 50) {
    reasons.push("Current title is relevant to the search query.");
  }

  if (semanticScore >= 70) {
    reasons.push("Profile has strong semantic similarity.");
  }

  if (qualityScore >= 80) {
    reasons.push("Candidate profile quality is high.");
  }

  const warnings: string[] = [];

  if (missingSkills.length) {
    warnings.push(`Missing requested skills: ${missingSkills.join(", ")}`);
  }

  if (confidenceScore < 50) {
    warnings.push("Candidate data confidence is low.");
  }

  if (!candidate.currentEmployer) {
    warnings.push("Current employer is missing.");
  }

  const confidenceLevel: CandidateSearchV2Explanation["confidenceLevel"] =
    confidenceScore >= 75 ? "high" : confidenceScore >= 45 ? "medium" : "low";

  return {
    candidateId: candidate.candidateId,
    talentPool: candidate.talentPool || "internal_profiles",
    linkedInProfileUrl: candidate.linkedInProfileUrl || null,
    canonicalCandidateId:
      candidate.canonicalCandidateId || candidate.candidateId,
    sourceCandidateIds: candidate.sourceCandidateIds || [candidate.candidateId],

    candidateName: candidate.candidateName ?? null,

    currentTitle: candidate.currentTitle ?? null,

    currentEmployer: candidate.currentEmployer ?? null,

    location: candidate.location ?? null,

    country: candidate.country ?? null,

    totalYearsExperience: candidate.totalYearsExperience ?? null,

    profilePreview: candidate.profilePreview,

    score,

    explanation: {
      matchedTerms: unique(matchedTerms),

      matchedSkills: unique(matchedSkills),

      matchedSapModules: unique(matchedSapModules),

      matchedIndustries: unique(matchedIndustries),

      missingSkills: unique(missingSkills),

      reasons,
      warnings,
      confidenceLevel,
    },

    evidence: candidate.evidence || [],
    profileEvidence: candidate.profileEvidence || {
      name: Boolean(candidate.candidateName),
      title: Boolean(candidate.currentTitle),
      employer: Boolean(candidate.currentEmployer),
      location: Boolean(candidate.location || candidate.country),
      experienceDuration: Boolean(
        candidate.totalYearsExperience && candidate.totalYearsExperience > 0,
      ),
      employmentHistory: false,
      projectHistory: false,
      education: false,
      certifications: false,
      skills: Boolean(candidate.skills?.length || candidate.sapModules?.length),
    },
    verifiedSkills: unique(candidate.skills || []),
    verifiedSapModules: unique(candidate.sapModules || []),
    queryRelevantSkills: (() => {
      const all = unique([
        ...(candidate.sapModules || []),
        ...(candidate.skills || []),
      ]);
      const supportOrder = unique(
        requestedDomains.flatMap(conceptSupportOrder),
      );
      const requested = unique([
        ...requestedSapModules,
        ...requestedSkills,
      ]).map(normalize);
      const relevant = all.filter((skill) => {
        const normalizedSkill = normalize(skill);
        const skillConcept = canonicalSearchConcept(skill);
        const invalidNicheTargetTag = Boolean(
          skillConcept &&
          requestedDomains.some(
            (domain) =>
              isCentralNicheTarget(domain) &&
              searchConceptRelation(domain, skillConcept) === "EXACT",
          ) &&
          !["exact_verified", "exact_supported"].includes(
            specializationEvidenceLevel,
          ),
        );
        if (invalidNicheTargetTag) return false;
        if (
          requested.some(
            (item) =>
              normalizedSkill.length >= 2 &&
              (normalizedSkill.includes(item) ||
                item.includes(normalizedSkill)),
          )
        )
          return true;
        if (
          skillConcept &&
          requestedDomains.some((domain) =>
            ["EXACT", "CHILD", "PARENT", "RELATED"].includes(
              searchConceptRelation(domain, skillConcept),
            ),
          )
        )
          return true;
        return (
          !skillConcept &&
          supportOrder.some((item) => normalize(item) === normalizedSkill)
        );
      });
      if (implementationRequested && implementationStrength >= 0.5)
        relevant.push("Implementation");
      return unique(relevant).sort((left, right) => {
        const leftIndex = supportOrder.findIndex(
          (item) => normalize(item) === normalize(left),
        );
        const rightIndex = supportOrder.findIndex(
          (item) => normalize(item) === normalize(right),
        );
        const leftRank = leftIndex < 0 ? 100 : leftIndex;
        const rightRank = rightIndex < 0 ? 100 : rightIndex;
        return leftRank - rightRank || left.localeCompare(right);
      });
    })(),
    implementationEvidenceCount: candidate.implementationEvidenceCount || 0,
    implementationEvidenceLevel:
      candidate.implementationEvidenceLevel || "unverified",
    seniorityEvidenceLevel: candidate.seniorityEvidenceLevel || "unverified",
    domainEvidence: candidate.domainEvidence || {},
    domainImplementationEvidence: candidate.domainImplementationEvidence || {},
    ficoRelevance: candidate.ficoRelevance || "NO_FICO",
    locationEvidenceState: candidate.locationEvidenceState || "UNKNOWN",
    primaryRoleFit,
    implementationFit,
    seniorityFit: seniorityMatch,
    locationFit,
    specializationEvidenceLevel,
    targetEvidence,
  };
}
