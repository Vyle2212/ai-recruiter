export type CandidateSearchV2Mode =
  | "keyword"
  | "semantic"
  | "hybrid"
  | "jd_match";

export type CandidateSearchV2Filters = {
  countries?: string[];
  locations?: string[];
  currentTitles?: string[];
  currentEmployers?: string[];
  skills?: string[];
  sapModules?: string[];
  industries?: string[];
  languages?: string[];
  workflowStatuses?: string[];
  qualityStatuses?: string[];

  minimumTotalYearsExperience?: number;
  maximumTotalYearsExperience?: number;

  minimumRelevantYearsExperience?: number;
  maximumRelevantYearsExperience?: number;

  maximumNoticePeriodDays?: number;
  maximumExpectedSalary?: number;

  workAuthorization?: string[];
};

export type CandidateSearchV2Request = {
  query: string;
  mode?: CandidateSearchV2Mode;
  filters?: CandidateSearchV2Filters;

  page?: number;
  pageSize?: number;

  semanticWeight?: number;
  keywordWeight?: number;
  qualityWeight?: number;
  recencyWeight?: number;

  minimumScore?: number;
};

export type CandidateSearchV2Document = {
  candidateId: string;

  candidateName?: string | null;
  currentTitle?: string | null;
  currentEmployer?: string | null;

  country?: string | null;
  location?: string | null;

  totalYearsExperience?: number | null;
  relevantYearsExperience?: number | null;

  skills?: string[];
  sapModules?: string[];
  industries?: string[];
  languages?: string[];

  salaryExpectation?: number | null;
  noticePeriodDays?: number | null;
  workAuthorization?: string[];

  workflowStatus?: string | null;
  qualityStatus?: string | null;

  profileQualityScore?: number | null;
  dataConfidenceScore?: number | null;

  updatedAt?: string | null;

  searchableText?: string | null;

  semanticSimilarity?: number | null;

  evidence?: Array<{
    label: string;
    value: string;
    source?: string | null;
  }>;
};

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

  confidenceLevel:
    | "high"
    | "medium"
    | "low";
};

export type CandidateSearchV2Result = {
  candidateId: string;

  candidateName: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  location: string | null;
  country: string | null;

  score: CandidateSearchV2ScoreBreakdown;
  explanation: CandidateSearchV2Explanation;

  evidence: CandidateSearchV2Document["evidence"];
};

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
    returned: number;
    page: number;
    pageSize: number;
  };

  results: CandidateSearchV2Result[];

  safety: {
    readOnly: true;
    candidateWrites: 0;
    workflowWrites: 0;
    automaticShortlists: 0;
    emailSends: 0;
  };
};