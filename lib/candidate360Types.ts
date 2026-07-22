export enum Candidate360FieldSource {
  ParserExtracted = "parser_extracted",
  AiExtracted = "ai_extracted",
  RecruiterApproved = "recruiter_approved",
  CandidateConfirmed = "candidate_confirmed",
  CandidateEdited = "candidate_edited",
  Imported = "imported",
  Unknown = "unknown",
}

export enum Candidate360VerificationStatus {
  Unverified = "unverified",
  NeedsCandidateConfirmation = "needs_candidate_confirmation",
  CandidateConfirmed = "candidate_confirmed",
  CandidateEditedNeedsRecruiterReview = "candidate_edited_needs_recruiter_review",
  RecruiterVerified = "recruiter_verified",
  ConflictDetected = "conflict_detected",
  Stale = "stale",
}

export type Candidate360Field<T = unknown> = {
  fieldName: string;
  value: T;
  source: Candidate360FieldSource;
  verificationStatus: Candidate360VerificationStatus;
  confidence: number;
  lastConfirmedAt: string | null;
  lastConfirmedBy: string | null;
  evidence: string;
  conflictReason: string;
  editableByCandidate: boolean;
};

export type Candidate360Experience = {
  id: string;
  title: Candidate360Field<string>;
  company: Candidate360Field<string>;
  startDate: Candidate360Field<string>;
  endDate: Candidate360Field<string>;
  description: Candidate360Field<string>;
};

export type Candidate360Education = {
  id: string;
  institution: Candidate360Field<string>;
  qualification: Candidate360Field<string>;
  fieldOfStudy: Candidate360Field<string>;
  graduationYear: Candidate360Field<string>;
};

export type Candidate360Skill = {
  name: Candidate360Field<string>;
  category: "sap_module" | "technical" | "functional" | "other";
};

export type Candidate360Language = {
  language: Candidate360Field<string>;
  proficiency: Candidate360Field<string>;
};

export type Candidate360ContactInfo = {
  email: Candidate360Field<string>;
  phone: Candidate360Field<string>;
};

export type Candidate360ProfileCompleteness = {
  score: number;
  completedFields: number;
  totalFields: number;
  highCompleteness: boolean;
  lowCompleteness: boolean;
  missingFields: string[];
};

export type Candidate360Profile = {
  candidateId: string;
  displayName: Candidate360Field<string>;
  headline: Candidate360Field<string>;
  currentTitle: Candidate360Field<string>;
  currentCompany: Candidate360Field<string>;
  location: Candidate360Field<string>;
  contactInfo: Candidate360ContactInfo;
  yearsOfExperience: Candidate360Field<number | null>;
  sapModules: Candidate360Skill[];
  techSkills: Candidate360Skill[];
  workExperience: Candidate360Experience[];
  education: Candidate360Education[];
  languages: Candidate360Language[];
  workExperienceSummary: string;
  educationSummary: string;
  verificationSummary: Record<Candidate360VerificationStatus, number>;
  completeness: Candidate360ProfileCompleteness;
  missingFields: string[];
  recommendedCandidateActions: string[];
  recommendedRecruiterActions: string[];
  workflowStatus: string;
  repairQueueStatus: string;
  selfConfirmStatus: string;
  readiness: {
    searchable: boolean;
    readyForShortlist: boolean;
    needsCandidateConfirmation: boolean;
    needsRecruiterReview: boolean;
  };
  mode: "read-only Candidate360 profile; no candidate DB writes";
};
