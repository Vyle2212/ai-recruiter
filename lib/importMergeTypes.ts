import type { ImportStagingConflictLevel, ImportStagingRecommendation } from "./importStagingTypes";

export type ImportMergeDecision = "approve_merge" | "reject_merge" | "hold_for_review" | "keep_existing" | "ask_candidate_to_confirm";
export type ImportMergeRiskLevel = "safe" | "low" | "medium" | "high" | "blocked";

export type ImportMergeProposal = {
  proposalId: string;
  importBatchId: string;
  candidateId: string | null;
  importedCandidateId: string;
  fieldName: string;
  dbFieldName: string;
  existingValue: unknown;
  importedValue: unknown;
  existingTrustLevel: string;
  importedSource: string;
  importedConfidence: number;
  recommendation: ImportStagingRecommendation;
  riskLevel: ImportMergeRiskLevel;
  conflictLevel: ImportStagingConflictLevel;
  evidence: string[];
  decision: ImportMergeDecision;
  blockedReasons: string[];
};

export type ImportMergePlanItem = {
  proposalId: string;
  candidateId: string;
  fieldName: string;
  dbFieldName: string;
  beforeValue: unknown;
  afterValue: unknown;
  decision: "approve_merge";
  eligible: true;
};

export type ImportMergePlan = {
  generatedAt: string;
  mode: "import merge plan preview only; no candidate DB writes";
  decisionsLoaded: number;
  approvedMerges: number;
  excludedDecisions: number;
  candidateRecordsAffected: number;
  fieldUpdatesPlanned: number;
  conflicts: number;
  backupRequired: true;
  rollbackReady: true;
  items: ImportMergePlanItem[];
  excluded: ImportMergeProposal[];
};

export type ImportMergeBackup = {
  generatedAt: string;
  mode: "import merge backup; created before candidate DB writes";
  items: Array<{ proposalId: string; candidateId: string; fieldName: string; dbFieldName: string; oldValue: unknown; newValue: unknown }>;
};

export type ImportMergeRollback = {
  generatedAt: string;
  mode: "import merge rollback plan; no automatic rollback";
  safe: boolean;
  items: Array<{ proposalId: string; candidateId: string; dbFieldName: string; rollbackValue: unknown }>;
};

export type ImportMergeResult = {
  generatedAt: string;
  mode: "dry-run import merge; no candidate DB writes" | "confirmed import merge apply";
  dryRun: boolean;
  expectedFieldUpdates: number;
  appliedCount: number;
  pendingCount: number;
  failedCount: number;
  backupPath: string;
  rollbackPath: string;
  items: Array<{ proposalId: string; candidateId: string; dbFieldName: string; expectedValue: unknown; status: "preview" | "applied" | "failed"; error: string }>;
};

export type ImportMergePostAudit = {
  generatedAt: string;
  mode: "read-only import merge post-audit; no candidate DB writes";
  expectedFieldUpdates: number;
  appliedVerified: number;
  pending: number;
  mismatch: number;
  backupAvailable: boolean;
  rollbackAvailable: boolean;
  rollbackSafe: boolean;
  items: Array<{ proposalId: string; candidateId: string; dbFieldName: string; expectedValue: unknown; actualValue: unknown; status: "verified" | "pending" | "mismatch" }>;
};

export type ImportMergeDecisionFile = {
  generatedAt: string;
  mode: "local import merge decisions only; no candidate DB writes";
  decisions: Array<{ proposalId: string; decision: ImportMergeDecision; reviewerNote: string }>;
};
