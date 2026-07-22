import type { Candidate360FieldSource } from "./candidate360Types";

export type ImportStagingBatchStatus = "uploaded" | "parsed" | "matched" | "reviewed" | "ready_for_merge" | "merged" | "archived";
export type ImportStagingMatchStatus = "exact_match" | "likely_match" | "possible_match" | "new_candidate" | "duplicate_risk" | "conflict" | "rejected";
export type ImportStagingRecommendation = "update_existing" | "create_new_candidate" | "skip_duplicate" | "needs_recruiter_review" | "needs_candidate_confirmation" | "reject_import";
export type ImportStagingDecision = "pending" | "approve_update" | "approve_create" | "keep_existing" | "request_candidate_confirmation" | "reject";
export type ImportStagingConflictLevel = "none" | "low" | "medium" | "high";

export type ImportStagingField = {
  fieldName: string;
  existingValue: unknown;
  importedValue: unknown;
  existingSource: Candidate360FieldSource | string;
  importedSource: Candidate360FieldSource | string;
  importedConfidence: number;
  recommendation: ImportStagingRecommendation;
  conflictLevel: ImportStagingConflictLevel;
  reasons: string[];
  blocked: boolean;
};

export type ImportStagingMatch = {
  existingCandidateId: string | null;
  existingCandidateName: string;
  status: ImportStagingMatchStatus;
  confidence: number;
  reasons: string[];
  competingCandidateIds: string[];
};

export type ImportStagingConflict = {
  fieldName: string;
  conflictLevel: ImportStagingConflictLevel;
  existingValue: unknown;
  importedValue: unknown;
  reason: string;
};

export type ImportStagingCandidate = {
  stagingCandidateId: string;
  importedCandidate: Record<string, unknown>;
  match: ImportStagingMatch;
  fields: ImportStagingField[];
  conflicts: ImportStagingConflict[];
  recommendation: ImportStagingRecommendation;
  decision: ImportStagingDecision;
  preservedCandidateId: string | null;
  blockedGenericValues: string[];
  readyForMergePreview: boolean;
};

export type ImportStagingBatch = {
  batchId: string;
  batchName: string;
  generatedAt: string;
  status: ImportStagingBatchStatus;
  mode: "import staging only; no candidate DB writes";
  importedCandidatesLoaded: number;
  existingCandidatesLoaded: number;
  candidates: ImportStagingCandidate[];
  summary: {
    exactMatches: number;
    likelyMatches: number;
    possibleMatches: number;
    newCandidates: number;
    duplicateRisks: number;
    conflicts: number;
    readyForMergePreview: number;
    needsRecruiterReview: number;
    blockedGenericValues: number;
  };
  preservationPolicy: {
    preserveExistingCandidateIds: true;
    preserveApplyHistory: true;
    preserveApprovals: true;
    preserveDecisions: true;
    preserveWorkflowState: true;
    candidateDbWrites: false;
    fullReuploadIntoMainDb: false;
  };
};
