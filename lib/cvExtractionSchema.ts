export type AnyRecord = Record<string, any>;

export type FieldValue<T = string> = {
  value: T | null;
  normalizedValue?: T | null;
  confidence: number;
  sourceSection: string;
  evidence: string;
  rejectReason?: string;
};

export type ReviewClassification =
  | "search_ready_after_extraction"
  | "parser_recoverable"
  | "manual_review_required"
  | "likely_non_sap_or_low_quality"
  | "likely_reupload_required"
  | "blocked_identity"
  | "blocked_title"
  | "blocked_contact_location";

export type RawAiCandidateExtraction = {
  identity: {
    fullName: FieldValue;
    normalizedFullName?: string;
    alternateNames?: string[];
  };
  contact: {
    email: FieldValue;
    phone: FieldValue;
    linkedInUrl: FieldValue;
  };
  location: {
    city: FieldValue;
    country: FieldValue;
  };
  role: {
    currentTitle: FieldValue;
    seniorityLevel?: string;
  };
  employer: {
    currentEmployer: FieldValue;
    currentCompanyStartDate: FieldValue;
    currentCompanyEndDate: FieldValue;
    currentCompanyYearsExperience: FieldValue<number>;
    currentCompanyTenureText: FieldValue;
    previousEmployer: FieldValue;
    previousCompanyStartDate: FieldValue;
    previousCompanyEndDate: FieldValue;
    previousCompanyYearsExperience: FieldValue<number>;
    previousCompanyTenureText: FieldValue;
    employerHistory: AnyRecord[];
  };
  clientProjects: {
    clientCompanies: string[];
    projectCompanies: string[];
    projectHistory: AnyRecord[];
    clientVsEmployerDecision: string;
    clientVsEmployerEvidence: string;
  };
  sap: {
    primarySapModule: FieldValue;
    secondarySapModules: string[];
    sapModules: string[];
    sapSkills: string[];
    functionalSkills: string[];
    technicalSkills: string[];
    integrationSkills: string[];
    businessProcesses: string[];
    projectTypes: string[];
    s4hanaEvidence: string;
    eccEvidence: string;
    riseEvidence: string;
  };
  experience: {
    totalYearsExperience: FieldValue<number>;
    sapYearsExperience: FieldValue<number>;
    implementationCount: number;
    rolloutCount: number;
    supportCount: number;
    amsExperience: boolean;
    employmentHistory: AnyRecord[];
    projectHistory: AnyRecord[];
  };
  compensation: {
    currentSalary: FieldValue;
    expectedSalary: FieldValue;
    salaryCurrency: string;
    salaryPeriod: string;
    noticePeriod: FieldValue;
    availability: FieldValue;
    compensationEvidence: string;
  };
  providerMeta?: AiExtractionProviderMeta;
  quality: {
    extractionConfidenceOverall: number;
    fieldCompletenessScore: number;
    rawTextQuality: string;
    evidenceSummary: Record<string, any>;
  };
};

export type ValidatedAiCandidateExtraction = RawAiCandidateExtraction & {
  candidateId: string;
  displayName: string;
  existingDisplayName: string;
  normalizedFullName: string;
  nameConfidence: number;
  nameEvidence: string;
  nameSourceSection: string;
  isNameValid: boolean;
  nameRejectReason: string;
  email: string;
  phone: string;
  linkedInUrl: string;
  hasContact: boolean;
  contactConfidence: number;
  contactEvidence: string;
  city: string;
  locationCity: string;
  country: string;
  locationCountry: string;
  normalizedCountry: string;
  currentLocationEvidence: string;
  locationConfidence: number;
  currentTitle: string;
  title: string;
  normalizedCurrentTitle: string;
  seniorityLevel: string;
  titleConfidence: number;
  titleEvidence: string;
  titleSourceSection: string;
  isTitleValid: boolean;
  titleRejectReason: string;
  currentEmployer: string;
  currentCompany: string;
  normalizedCurrentEmployer: string;
  currentCompanyStartDate: string;
  currentCompanyEndDate: string;
  currentCompanyYearsExperience: number;
  currentCompanyTenureText: string;
  previousEmployer: string;
  previousCompany: string;
  previousCompanyStartDate: string;
  previousCompanyEndDate: string;
  previousCompanyYearsExperience: number;
  previousCompanyTenureText: string;
  employmentHistory: AnyRecord[];
  clientCompanies: string[];
  projectCompanies: string[];
  currentEmployerEvidence: string;
  employerConfidence: number;
  isEmployerValid: boolean;
  employerRejectReason: string;
  primarySapModule: string;
  secondarySapModules: string[];
  sapModules: string[];
  sapSkills: string[];
  extractionConfidenceOverall: number;
  fieldCompletenessScore: number;
  searchReadiness: boolean;
  reviewClassification: ReviewClassification;
  validationStatus: string;
  reviewReasons: string[];
  safeToApply: boolean;
  requiresManualReview: boolean;
  requiresReupload: boolean;
  parserRecoverable: boolean;
  rawTextQuality: string;
  evidenceSummary: Record<string, any>;
  recoveredByAiFromCurrentParserBlocked: boolean;
  currentParserClassification: string;
  currentParserSearchReady: boolean;
  provider: string;
  providerMode: AiExtractionProviderMode;
  providerUsed: AiExtractionProviderMode;
  model: string;
  modelUsed: string;
  cacheHit: boolean;
  fallbackParserUsed: boolean;
  fallbackReason: string;
  openAiExtractionUsed: boolean;
  openAiRequestAttempted: boolean;
  openAiRequestSucceeded: boolean;
  openAiErrorType: string;
  openAiErrorMessage: string;
};

export type AiExtractionProviderMode = "mock" | "fallback" | "openai";

export type AiExtractionProviderMeta = {
  mode: AiExtractionProviderMode;
  model: string;
  cacheHit?: boolean;
  fallbackParserUsed?: boolean;
  openAiExtractionUsed?: boolean;
  providerUsed?: AiExtractionProviderMode;
  fallbackReason?: string;
  openAiRequestAttempted?: boolean;
  openAiRequestSucceeded?: boolean;
  openAiErrorType?: string;
  openAiErrorMessage?: string;
  error?: string;
};

export type AiExtractionProvider = {
  name: string;
  mode: AiExtractionProviderMode;
  model?: string;
  extractCandidateFromCv(rawText: string, existingCandidateData: AnyRecord): Promise<RawAiCandidateExtraction>;
};

export type AiCandidateExtractionReport = {
  providerMode: AiExtractionProviderMode;
  model: string;
  sampleSize: number;
  openAiProviderEnabled: boolean;
  summary: Record<string, number>;
  distributions: Record<string, Record<string, number>>;
  items: ValidatedAiCandidateExtraction[];
  searchReadyItems: ValidatedAiCandidateExtraction[];
  parserRecoverableItems: ValidatedAiCandidateExtraction[];
  manualReviewItems: ValidatedAiCandidateExtraction[];
  requiresReuploadItems: ValidatedAiCandidateExtraction[];
  recoveredFromBlockedItems: ValidatedAiCandidateExtraction[];
  rejectedItems: ValidatedAiCandidateExtraction[];
  safeApplyCandidates: ValidatedAiCandidateExtraction[];
  examples: Record<string, any[]>;
};

export function field<T = string>(value: T | null, confidence: number, sourceSection: string, evidence: string, normalizedValue?: T | null, rejectReason = ""): FieldValue<T> {
  return { value, normalizedValue, confidence, sourceSection, evidence, rejectReason };
}
