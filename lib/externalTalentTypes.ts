import type { ExternalEmploymentRecord } from "./externalCandidateSourceProvider";

export type ExternalTalentSource = "external_talent_network";
export type ExternalTalentErrorCode =
  | "SOURCE_NOT_CONFIGURED"
  | "SOURCE_NOT_CONNECTED"
  | "AUTHENTICATION_FAILED"
  | "SOURCE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "NO_PROVIDER_MATCHES"
  | "UNSUPPORTED_FILTER"
  | "INVALID_PROVIDER_CURSOR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_PROFILE_URL";
export type ExternalTalentSearchPlan = {
  version: "exa-people-plan-v1";
  requirements: ExternalPlanRequirement[];
  targetConcepts: Array<{ conceptId: string; label: string }>;
  normalizedRoles: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  requiredLocations: string[];
  acceptableLocationVariants: string[];
  includeRelocationRemote: boolean;
  seniority: string[];
  minimumYearsExperience: number | null;
  maximumYearsExperience: number | null;
  languages: string[];
  industry: string[];
  targetCompanies: string[];
  excludedCompanies: string[];
  requiredDeliveryContext: string[];
  rankingCriteria: Array<{
    id: string;
    label: string;
    importance: "most_important" | "important" | "nice_to_have";
  }>;
  semanticQuery: string;
  unsupportedRequirements: string[];
  assumptions: string[];
};
export type ExternalPlanRequirement = {
  id: string;
  label: string;
  kind:
    | "target"
    | "professional_role"
    | "location"
    | "experience"
    | "seniority"
    | "company"
    | "lifecycle"
    | "skill"
    | "sap_module"
    | "language"
    | "industry"
    | "education"
    | "certification"
    | "exclusion";
  conceptId?: string | null;
  alternatives?: string[];
  titleScope?: "current" | "any";
  value?: string;
  values?: string[];
  operator?: "any" | "all";
  contextConceptIds?: string[];
  minimum?: number | null;
  maximum?: number | null;
  scope?: "current" | "any";
};
export type ExternalTalentEvidence = {
  requirementId: string;
  label: string;
  state: "verified" | "supported" | "unverified" | "conflicting";
  excerpt: string;
  sourceField: string;
  sourceUrl: string;
};
export type ExternalTargetEvidence = {
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
    | "related_concept"
    | "none";
  matchedLiteral: string | null;
  matchedIndicators: string[];
  sourceField: string | null;
  trusted: boolean;
  reasonCode:
    | "trusted_literal"
    | "candidate_related_concept"
    | "no_candidate_target_evidence";
  relatedConcepts: string[];
  professionalContextType:
    | "title"
    | "certification"
    | "direct_skill"
    | "project"
    | "experience"
    | "sentence"
    | "related"
    | "none";
};
export type ExternalRequirementEvaluation = {
  id: string;
  label: string;
  kind:
    | "target"
    | "professional_role"
    | "skill"
    | "location"
    | "language"
    | "seniority"
    | "experience"
    | "lifecycle"
    | "sap_module"
    | "company"
    | "industry"
    | "education"
    | "certification"
    | "exclusion";
  state: "verified" | "supported" | "unverified" | "conflicting";
  evidence: ExternalTalentEvidence | null;
};
export type ExternalTalentCandidate = {
  source: ExternalTalentSource;
  provider: "exa";
  externalCandidateId: string;
  displayName?: string;
  headline?: string;
  currentTitle?: string;
  location?: string;
  currentEmployer?: string;
  skills: string[];
  experienceSummary?: string;
  employment?: ExternalEmploymentRecord[];
  employmentText?: string[];
  projectText?: string[];
  education?: string[];
  certifications?: string[];
  totalYearsExperience?: number | null;
  profileUrl?: string;
  profileUrlDomain?: string;
  providerEvidence: ExternalTalentEvidence[];
  requirementEvaluations: ExternalRequirementEvaluation[];
  targetEvidence: ExternalTargetEvidence;
  sourceRequestId: string;
  providerRank: number;
  overallMatchScore: number;
  matchTier: "Strong Match" | "Good Match" | "Potential Match";
  requirementCoverage: number;
  rankingScore: number;
  keywordScore: number;
  semanticScore: number;
  skillScore: number;
  titleScore: number;
  employerScore: number;
  locationScore: number;
  criteriaScore: number;
  criterionEvaluations: Array<{
    id: string;
    label: string;
    importance: "most_important" | "important" | "nice_to_have";
    score: number;
    evidenceCount: number;
  }>;
  deliveryScore: number;
  implementationEvidenceCount: number;
  evidenceConfidence: number;
  profileCompleteness: number;
  explanationStatus: "grounded" | "pending" | "unavailable";
  duplicateReviewStatus: "not_reviewed" | "possible_match" | "clear";
};
export type ExternalTalentSearchResponse = {
  items: ExternalTalentCandidate[];
  evaluatedTotal: number;
  eligibleEvaluatedTotal: number;
  loadedExternalTotal: number;
  bucketCounts: { strong: number; good: number; potential: number };
  nextCursor: string | null;
  nextProviderBatchCursor: string | null;
  providerExhausted: boolean;
  committedSearchId: string;
  rankingVersion: string;
  evaluatedWindowId: string;
  provider: "exa";
  sourceRequestId: string;
  timing: {
    requestReceivedMs: number;
    queryMappingMs: number;
    providerMs: number;
    normalizationMs: number;
    eligibilityMs: number;
    scoringMs: number;
    serializationMs: number;
    optionalClaudeMs: number | null;
    totalMs: number;
  };
  warnings: string[];
  unsupportedRequirements: string[];
  rejectionSummary: ExternalRejectionSummary;
  marketMapping: {
    version: string;
    segmentsCompleted: number;
    segmentsPlanned: number;
    profileLimit: number;
    requestSize: number;
  };
};
export type ExternalRejectionSummary = {
  evaluated: number;
  eligible: number;
  requirements: Array<{
    requirementId: string;
    label: string;
    contradictedCount: number;
    unverifiedCount: number;
    supportedCount: number;
  }>;
};
