export type CandidateSearchV2Mode =
  "keyword" | "semantic" | "hybrid" | "jd_match";

export type CandidateEvidenceLevel =
  | "verified_structured_evidence"
  | "source_text_evidence"
  | "inferred_evidence"
  | "search_expansion"
  | "contradicted_evidence"
  | "unverified";

export type CandidateSeniorityMatch =
  "verified" | "supported" | "unverified" | "mismatch";
export type CandidatePrimaryRoleFit =
  "exact" | "adjacent" | "exposure_only" | "conflicting" | "unknown";
export type CandidateImplementationFit =
  | "verified_domain_implementation"
  | "supported_domain_implementation"
  | "generic_implementation"
  | "implementation_exposure"
  | "not_verified"
  | "mismatch";
export type CandidateLocationFit =
  "verified" | "supported" | "not_verified" | "conflicting";
export type CandidateRoleEvidenceKind =
  | "current_direct"
  | "historical_direct"
  | "same_domain"
  | "exposure_only"
  | "keyword_only"
  | "none";

export type CandidateSearchV2Filters = {
  candidateNames?: string[];
  countries?: string[];
  locations?: string[];
  currentTitles?: string[];
  anyTitles?: string[];
  professionalRoles?: string[];
  seniorities?: string[];
  currentEmployers?: string[];
  anyEmployers?: string[];
  skills?: string[];
  sapModules?: string[];
  deliveryExperience?: string[];
  deliveryExperienceOperator?: "any" | "all";
  industries?: string[];
  languages?: string[];
  languageProficiencies?: Record<string, string>;
  workflowStatuses?: string[];
  qualityStatuses?: string[];

  minimumTotalYearsExperience?: number;
  maximumTotalYearsExperience?: number;

  minimumRelevantYearsExperience?: number;
  maximumRelevantYearsExperience?: number;

  maximumNoticePeriodDays?: number;
  maximumExpectedSalary?: number;

  workAuthorization?: string[];
  education?: string[];
  certifications?: string[];
  exclusions?: string[];
};

export type CandidateSearchTalentPool =
  "internal_profiles" | "linkedin_talent_pool";

export type CandidateSearchCriterion = {
  id: string;
  label: string;
  conceptId?: string | null;
  importance: "most_important" | "important" | "nice_to_have";
  source:
    "query" | "jd" | "clarification" | "filter" | "ai_suggestion" | "history";
};

export type CandidateSearchV2Request = {
  query: string;
  rawQuery?: string;
  mode?: CandidateSearchV2Mode;
  filters?: CandidateSearchV2Filters;

  page?: number;
  pageSize?: number;
  cursor?: string;
  externalBatchCursor?: string;

  semanticWeight?: number;
  keywordWeight?: number;
  qualityWeight?: number;
  recencyWeight?: number;

  minimumScore?: number;
  includeRelocationRemote?: boolean;
  talentPool?: CandidateSearchTalentPool;
  criteria?: CandidateSearchCriterion[];
  clarificationAnswers?: Record<string, string | string[]>;
};

export type CandidateSearchV2ProfilePreview = Readonly<{
  employmentCount: number;
  projectCount: number;
  educationCount: number;
  certificationCount: number;
  trainingCount: number;
  skillCount: number;
  currentEmployment: {
    id: string;
    title: string | null;
    employer: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    location?: string | null;
    summary?: string | null;
  } | null;
  latestEmployment: {
    id: string;
    title: string | null;
    employer: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    location?: string | null;
    summary?: string | null;
  } | null;
  employment: Array<{
    id: string;
    title: string | null;
    employer: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    location?: string | null;
    summary?: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string | null;
    client: string | null;
    role: string | null;
    start: string | null;
    end: string | null;
    lifecycle: string[];
    modules: string[];
  }>;
  education: {
    qualification: string | null;
    fieldOfStudy: string | null;
    institution: string | null;
  } | null;
  certifications: string[];
  training: string[];
  skills: string[];
}>;

export type CandidateSearchV2Document = {
  candidateId: string;
  talentPool?: CandidateSearchTalentPool;
  linkedInProfileUrl?: string | null;
  sourceRecordId?: string;
  canonicalCandidateId?: string;
  sourceCandidateIds?: string[];
  alternateNames?: string[];
  historicalEmployers?: string[];
  identitySignals?: {
    email?: string | null;
    phone?: string | null;
    normalizedName?: string | null;
    employer?: string | null;
    location?: string | null;
    title?: string | null;
    verifiedEmailHash?: string | null;
    verifiedPhoneHash?: string | null;
    sourceProfileId?: string | null;
    sourceDocumentHash?: string | null;
    documentEvidenceKeys?: string[];
    employmentKeys?: string[];
    projectKeys?: string[];
  };

  candidateName?: string | null;
  currentTitle?: string | null;
  currentEmployer?: string | null;

  country?: string | null;
  location?: string | null;

  totalYearsExperience?: number | null;
  relevantYearsExperience?: number | null;
  historicalTitles?: string[];
  canonicalRoleEvidence?: Array<{
    title: string;
    sourceType: "canonical_employment" | "canonical_project";
    sourceRecordId: string;
    sourceField: string;
    current: boolean;
  }>;
  implementationEvidenceCount?: number;
  groundedImplementationProjectCount?: number;
  canonicalCurrentEmployment?: {
    title: string;
    employer: string;
    location: string;
    start: string;
    end: string;
    duration: string;
  } | null;
  implementationEvidenceLevel?: CandidateEvidenceLevel;
  seniorityEvidenceLevel?: CandidateEvidenceLevel;
  ficoRelevance?:
    | "PRIMARY_FICO"
    | "STRONG_FICO"
    | "FICO_EXPOSURE"
    | "RELATED_SAP"
    | "NO_FICO";
  domainEvidence?: Record<
    string,
    "PRIMARY" | "STRONG" | "SUPPORTED" | "EXPOSURE" | "UNVERIFIED"
  >;
  domainImplementationEvidence?: Record<
    string,
    "VERIFIED" | "SUPPORTED" | "UNVERIFIED"
  >;
  locationEvidenceState?: "VERIFIED" | "SUPPORTED" | "UNKNOWN" | "CONFLICTING";

  skills?: string[];
  sapModules?: string[];
  industries?: string[];
  languages?: string[];

  salaryExpectation?: number | null;
  noticePeriodDays?: number | null;
  workAuthorization?: string[];
  profilePreview?: CandidateSearchV2ProfilePreview;

  workflowStatus?: string | null;
  qualityStatus?: string | null;

  profileQualityScore?: number | null;
  canonicalProfileCompletenessScore?: number | null;
  dataConfidenceScore?: number | null;
  sourceCompletenessScore?: number | null;

  updatedAt?: string | null;

  searchableText?: string | null;
  /** Candidate-originated evidence only; every value is identity-bound and provenance-auditable. */
  trustedCandidateEvidence?: Readonly<{
    candidateId: string;
    values: readonly TrustedCandidateEvidenceValue[];
  }>;
  /** Compact, dataset-versioned strict-target decisions for interactive search. */
  searchTargetEvidence?: Record<string, CandidateTargetEvidence>;
  searchConceptIds?: string[];
  searchConceptEvidence?: Record<
    string,
    Readonly<{
      sourceType: TrustedCandidateEvidenceValue["sourceType"];
      sourceField: string;
      sourceRecordId: string;
      matchedLiteral: string;
      trusted: boolean;
    }>
  >;
  /** Canonical Candidate 360 project lifecycle projection, indexed at snapshot build time. */
  lifecycleEvidence?: ReadonlyArray<
    Readonly<{
      projectId: string;
      lifecycleType: string;
      sourceType:
        "candidate_field" | "parsed_resume" | "employment" | "project";
      sourceField: string;
      sourceRecordId: string;
      excerpt: string;
      evidenceLevel: "verified" | "supported";
      modules: readonly string[];
      /** Professional concepts grounded in this exact project/assignment record. */
      contextConceptIds?: readonly string[];
    }>
  >;

  semanticSimilarity?: number | null;

  evidence?: Array<{
    label: string;
    value: string;
    source?: string | null;
  }>;
  profileEvidence?: CandidateSearchV2ProfileEvidence;
};

export type TrustedCandidateEvidenceValue = Readonly<{
  value: string;
  normalizedValue?: string;
  sourceType:
    | "raw_title"
    | "raw_professional_text"
    | "raw_experience"
    | "raw_project"
    | "raw_certification"
    | "direct_skill";
  sourceField: string;
  sourceRecordId: string;
  provenance:
    | "candidate_record_raw"
    | "candidate_record_derived"
    | "search_index"
    | "query"
    | "cache"
    | "presentation"
    | "unknown";
  trusted: boolean;
  normalizedSegments?: readonly string[];
}>;
export type CandidateSearchV2ProfileEvidence = {
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
export type CandidateSpecializationEvidenceLevel =
  | "exact_verified"
  | "exact_supported"
  | "parent_verified"
  | "adjacent"
  | "generic_sap"
  | "not_verified";

export type CandidateSearchV2ScoreBreakdown = {
  keywordScore: number;
  semanticScore: number;
  skillScore: number;
  titleScore: number;
  employerScore: number;
  locationScore: number;
  industryScore: number;
  qualityScore: number;
  confidenceScore: number;
  recencyScore: number;
  requestedDimensions: number;
  matchedDimensions: number;
  dimensionScore: number;
  weakestDimensionStrength: number;
  roleRelevanceScore: number;
  specializationStrength: number;
  specializationEvidenceRank: number;
  seniorityMatch: CandidateSeniorityMatch;
  implementationStrength: number;
  profileQualityFactor: number;
  tierCap: "strong" | "good" | "potential" | "broad";
  roleEvidenceKind: CandidateRoleEvidenceKind;
  roleProximityRank: number;
  roleDomainEligible: boolean;
  professionalRoleContext: boolean;
  highValueConstraintCoverageScore: number;
  supportedHighValueConstraints: number;
  requestedHighValueConstraints: number;
  finalScore: number;
};

export type CandidateSearchV2Explanation = {
  matchedTerms: string[];
  matchedSkills: string[];
  matchedSapModules: string[];
  matchedIndustries: string[];

  missingSkills: string[];
  reasons: string[];
  warnings: string[];

  confidenceLevel: "high" | "medium" | "low";
};

export type CandidateTargetEvidence = {
  target: string;
  tier: "exact_verified" | "exact_supported" | "related" | "none";
  strength: number;
  evidenceSourceType:
    | "raw_title"
    | "raw_professional_text"
    | "raw_experience"
    | "raw_project"
    | "raw_certification"
    | "direct_skill"
    | "professional_cluster"
    | "related_concept"
    | "none";
  matchedLiteral: string | null;
  matchedIndicators: string[];
  sourceField: string | null;
  trusted: boolean;
  reasonCode:
    | "trusted_literal"
    | "trusted_professional_cluster"
    | "candidate_related_concept"
    | "no_candidate_target_evidence";
  relatedConcepts: string[];
  sourceRecordId: string | null;
  sourceValueProvenance: TrustedCandidateEvidenceValue["provenance"] | null;
  professionalContextType:
    | "title"
    | "certification"
    | "direct_skill"
    | "project"
    | "experience"
    | "responsibility"
    | "sentence"
    | "bounded_segment"
    | "professional_cluster"
    | "related"
    | "none";
};

export type CandidateSearchV2Result = {
  retrievalKind?: "evaluated_match";
  evaluation?: { kind: "recruiter_fit" };
  candidateId: string;
  talentPool?: CandidateSearchTalentPool;
  criteriaDiagnostic?: {
    version: string;
    scorePercent: number;
    matchedWeight: number;
    totalWeight: number;
    criteria: Array<{
      id: string;
      label: string;
      importance: CandidateSearchCriterion["importance"];
      state: "verified" | "supported" | "not_verified" | "conflicting";
      score: number;
      weight: number;
      reason: string;
      provenance: {
        candidateId: string;
        sourceRecordId: string;
        sourceType: string;
        sourceField: string;
        excerpt: string;
        talentPool: CandidateSearchTalentPool;
      } | null;
      assignmentEvidence?: {
        totalGroundedProjects: number;
        directTargetAssignments: number;
        directTargetLifecycleAssignments: number;
        requestedLifecycleTypes: readonly string[];
        adjacentAssignments: number;
        unsupportedAssignments: number;
      };
    }>;
  };
  requiredCoveragePercent?: number;
  evidenceConfidencePercent?: number;
  /** Profile-source completeness/confidence. This is not recruiter-fit evidence. */
  profileDataConfidencePercent?: number;
  overallMatchPercent?: number;
  overallMatchScore?: number;
  rankingScore?: number;
  matchLabel?: "Strong Match" | "Good Match" | "Potential Match";
  rankingVersion?: string;
  profileCompletenessPercent?: number;
  sourceCompletenessPercent?: number;
  supportedProfessionalEvidenceDepth?: number;
  linkedInProfileUrl?: string | null;
  profilePreview?: CandidateSearchV2ProfilePreview;
  canonicalCandidateId: string;
  sourceCandidateIds: string[];

  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;
  totalYearsExperience: number | null;
  implementationEvidenceCount: number;
  implementationEvidenceLevel: CandidateEvidenceLevel;
  seniorityEvidenceLevel: CandidateEvidenceLevel;
  domainEvidence: CandidateSearchV2Document["domainEvidence"];
  domainImplementationEvidence: CandidateSearchV2Document["domainImplementationEvidence"];
  ficoRelevance: CandidateSearchV2Document["ficoRelevance"];
  locationEvidenceState: CandidateSearchV2Document["locationEvidenceState"];
  primaryRoleFit: CandidatePrimaryRoleFit;
  implementationFit: CandidateImplementationFit;
  seniorityFit: CandidateSeniorityMatch;
  locationFit: CandidateLocationFit;
  specializationEvidenceLevel: CandidateSpecializationEvidenceLevel;
  targetEvidence: CandidateTargetEvidence;

  score: CandidateSearchV2ScoreBreakdown;
  explanation: CandidateSearchV2Explanation;

  evidence: CandidateSearchV2Document["evidence"];
  profileEvidence: CandidateSearchV2ProfileEvidence;
  verifiedSkills: string[];
  verifiedSapModules: string[];
  queryRelevantSkills: string[];
};

export type CandidateSearchV2IdentityResult = Readonly<{
  retrievalKind: "identity_match";
  evaluation: null;
  score: null;
  matchLabel: null;
  requiredCoveragePercent: null;
  criteriaDiagnostic: null;
  candidateId: string;
  canonicalCandidateId: string;
  sourceCandidateIds: string[];
  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;
  totalYearsExperience: number | null;
  profileDataConfidencePercent?: number;
  profileCompletenessPercent?: number;
  sourceCompletenessPercent?: number;
  profileEvidence?: CandidateSearchV2ProfileEvidence;
  verifiedSkills: string[];
  verifiedSapModules: string[];
  queryRelevantSkills: [];
  profilePreview?: CandidateSearchV2ProfilePreview;
}>;

export type CandidateSearchV2Response = {
  generatedAt: string;

  request: {
    query: string;
    mode: CandidateSearchV2Mode;
    page: number;
    pageSize: number;
    minimumScore: number;
  };

  summary: {
    totalDocuments: number;
    totalMatched: number;
    eligibleTotal?: number;
    visibleTotal?: number;
    verifiedVisible?: number;
    supportedVisible?: number;
    relatedVisible?: number;
    appliedMinimumScore?: number;
    appliedMatchQuality?: "any" | "relevant" | "strong";
    returned: number;
    page: number;
    pageSize: number;
  };

  results: CandidateSearchV2Result[];
  items?: CandidateSearchV2Result[];
  eligibleTotal?: number;
  bucketCounts?: { strong: number; good: number; potential: number };
  nextCursor?: string | null;
  committedSearchId?: string;
  rankingVersion?: string;
  requestId?: string;
  searchIntent?: import("./searchV2UnifiedIntent").SearchV2UnifiedIntent;
  evaluationMode?:
    "identity_only" | "named_candidate_evaluation" | "requirements_ranking";

  eligibilityDiagnostic?: import("./searchV2CommittedRequirements").SearchV2EligibilityDiagnostic;

  safety: {
    readOnly: true;
    candidateWrites: 0;
    workflowWrites: 0;
    automaticShortlists: 0;
    emailSends: 0;
  };
};
