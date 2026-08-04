export type RepairQueueCategory =
  | "quick_fix_missing_company"
  | "quick_fix_missing_title"
  | "quick_fix_missing_module"
  | "quick_fix_missing_location"
  | "ai_extractable"
  | "manual_review_required"
  | "duplicate_conflict"
  | "requires_original_file_reupload"
  | "low_evidence_profile"
  | "already_repaired_or_verified"
  | "blocked_from_repair"
  | "archive_candidate_review";

export type RepairPriority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export type RepairBatchType =
  | "company_title_quick_fix"
  | "module_skill_quick_fix"
  | "location_contact_quick_fix"
  | "ai_extraction_batch"
  | "manual_review_batch"
  | "duplicate_resolution_batch"
  | "reupload_required_batch"
  | "archive_review_batch";

export type RepairQueueItem = {
  repairId: string;
  candidateId: string;
  candidateName: string;
  workflowStatus: string;
  repairCategory: RepairQueueCategory;
  categories: RepairQueueCategory[];
  priority: RepairPriority;
  missingFields: string[];
  evidenceAvailability: "good_evidence" | "partial_evidence" | "low_evidence" | "missing_evidence";
  recommendedRepairAction: string;
  blockerReason: string;
  suggestedBatch: RepairBatchType;
  readyAfterQuickFix: boolean;
  safetyNote: string;
  sortScore: number;
};

export type RepairQueueAuditReport = {
  generatedAt: string;
  mode: string;
  totalWorkflowStates: number;
  needsRepairCandidates: number;
  summary: RepairQueueSummary;
  items: RepairQueueItem[];
  files: Record<string, { path: string; found: boolean }>;
};

export type RepairQueueSummary = {
  needsRepair: number;
  quickFixes: number;
  aiExtractable: number;
  manualReview: number;
  duplicateConflicts: number;
  reuploadRequired: number;
  lowEvidence: number;
  archiveReview: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
};

export type RepairBatchPlan = {
  generatedAt: string;
  mode: string;
  batchSize: number;
  focus: string;
  needsRepairCandidates: number;
  batchesGenerated: number;
  warnings: string[];
  errors: string[];
  batches: Array<{ batchId: string; batchType: RepairBatchType; priority: RepairPriority; category: RepairQueueCategory; items: RepairQueueItem[] }>;
  summary: RepairQueueSummary & { p1QuickFixBatchCount: number; p2AiExtractionBatchCount: number; p3ManualReviewBatchCount: number; p4ReuploadBatchCount: number };
};
