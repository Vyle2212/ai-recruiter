import type { AiExtractionApproval } from "./aiExtractionApprovalStore";
import { validateStagingApproval, type StagingApplyReadiness, type StagingValidationStatus } from "./aiExtractionStagingValidator";
import type { ReviewWorkspace } from "./aiExtractionReviewUi";

export type AiExtractionStagingRecord = {
  stagingId: string;
  candidateId: string;
  candidateName: string;
  fieldName: string;
  currentValue: string;
  approvedValue: string;
  parserValue: string;
  aiEvidence: string;
  aiConfidence: number;
  approvalDecision: string;
  reviewerNote: string;
  overrideReason: string;
  riskLevel: string;
  applyReadiness: StagingApplyReadiness;
  validationStatus: StagingValidationStatus;
  validationReasons: string[];
  sourceApprovalId: string;
  createdAt: string;
  updatedAt: string;
  stagedBy: "local-review";
  appliedToCandidate: false;
};

export type StagingRejectedItem = {
  sourceApprovalId: string;
  candidateId: string;
  fieldName: string;
  approvedValue: string;
  validationReasons: string[];
};

export type AiExtractionStagingPreview = {
  mode: string;
  noDbWrites: true;
  candidatesReviewed: number;
  approvalsRead: number;
  validStagingItems: number;
  warnings: number;
  rejectedStagingItems: number;
  blockedCandidates: number;
  stagedSafeCount: number;
  manualReviewCount: number;
  fieldCount: number;
  candidateCount: number;
  items: AiExtractionStagingRecord[];
  rejectedItems: StagingRejectedItem[];
  blockedCandidateIds: string[];
  beforeAfterPreview: Array<{ candidateId: string; fieldName: string; beforeValue: string; afterValue: string; validationStatus: string; validationReasons: string[] }>;
};

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function stagingIdFor(approval: AiExtractionApproval) {
  return `${approval.candidateId}:${approval.fieldName}:${approval.approvalId}`;
}

export function buildStagingRecord(approval: AiExtractionApproval, workspace: ReviewWorkspace, now = new Date().toISOString()): AiExtractionStagingRecord {
  const validation = validateStagingApproval(approval, workspace);
  return {
    stagingId: stagingIdFor(approval),
    candidateId: clean(approval.candidateId),
    candidateName: clean(validation.candidate?.candidateName),
    fieldName: clean(approval.fieldName),
    currentValue: clean(approval.currentValue),
    approvedValue: clean(approval.suggestedValue),
    parserValue: clean(approval.parserValue),
    aiEvidence: clean(approval.aiEvidence),
    aiConfidence: Number(approval.aiConfidence || 0),
    approvalDecision: clean(approval.decision),
    reviewerNote: clean(approval.reviewerNote),
    overrideReason: clean(approval.overrideReason),
    riskLevel: clean(approval.riskLevel),
    applyReadiness: validation.applyReadiness,
    validationStatus: validation.validationStatus,
    validationReasons: validation.validationReasons,
    sourceApprovalId: clean(approval.approvalId),
    createdAt: now,
    updatedAt: now,
    stagedBy: "local-review",
    appliedToCandidate: false,
  };
}

export function buildAiExtractionStagingPreview(workspace: ReviewWorkspace, approvals: AiExtractionApproval[]): AiExtractionStagingPreview {
  const now = new Date().toISOString();
  const records = approvals.map((approval) => buildStagingRecord(approval, workspace, now));
  const items = records.filter((record) => record.validationStatus === "valid" || record.validationStatus === "warning");
  const rejectedItems = records.filter((record) => record.validationStatus === "rejected").map((record) => ({
    sourceApprovalId: record.sourceApprovalId,
    candidateId: record.candidateId,
    fieldName: record.fieldName,
    approvedValue: record.approvedValue,
    validationReasons: record.validationReasons,
  }));
  const blockedCandidateIds = Array.from(new Set(rejectedItems.map((item) => item.candidateId).filter(Boolean)));
  return {
    mode: "dry-run staging preview; no candidate DB writes; no apply; no delete; no OpenAI calls",
    noDbWrites: true,
    candidatesReviewed: workspace.candidates.length,
    approvalsRead: approvals.length,
    validStagingItems: items.filter((item) => item.validationStatus === "valid").length,
    warnings: items.filter((item) => item.validationStatus === "warning").length,
    rejectedStagingItems: rejectedItems.length,
    blockedCandidates: blockedCandidateIds.length,
    stagedSafeCount: items.filter((item) => item.applyReadiness === "staged_safe").length,
    manualReviewCount: items.filter((item) => item.applyReadiness === "staged_manual_review").length,
    fieldCount: items.length,
    candidateCount: new Set(items.map((item) => item.candidateId)).size,
    items,
    rejectedItems,
    blockedCandidateIds,
    beforeAfterPreview: records.map((record) => ({
      candidateId: record.candidateId,
      fieldName: record.fieldName,
      beforeValue: record.currentValue,
      afterValue: record.approvedValue,
      validationStatus: record.validationStatus,
      validationReasons: record.validationReasons,
    })),
  };
}
