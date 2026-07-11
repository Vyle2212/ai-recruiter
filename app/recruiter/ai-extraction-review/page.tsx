"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildLocalApprovalSummary, filterFieldsForView, getApprovalDisabledReason, type FieldViewMode } from "@/lib/aiExtractionReviewClient";
import type { ApprovalState, ApplyPreview, FieldApprovalAction, ReviewFilter, ReviewWorkspace, WorkspaceCandidate, WorkspaceField } from "@/lib/aiExtractionReviewUi";

type StagingPreview = {
  mode: string;
  validStagingItems: number;
  warnings: number;
  rejectedStagingItems: number;
  blockedCandidates: number;
  stagedSafeCount: number;
  manualReviewCount: number;
  items: Array<{ stagingId: string; candidateId: string; candidateName: string; fieldName: string; currentValue: string; approvedValue: string; applyReadiness: string; validationStatus: string; validationReasons: string[]; appliedToCandidate: false }>;
  rejectedItems: Array<{ sourceApprovalId: string; candidateId: string; fieldName: string; approvedValue: string; validationReasons: string[] }>;
  beforeAfterPreview: Array<{ candidateId: string; fieldName: string; beforeValue: string; afterValue: string; validationStatus: string; validationReasons: string[] }>;
  existingStagedIds?: string[];
};

type CandidateApplyPreview = {
  mode: string;
  stagedItemsLoaded: number;
  candidatesAffected: number;
  fieldsEligibleForApply: number;
  fieldsBlocked: number;
  conflictsDetected: number;
  backupRequired: boolean;
  rollbackReady: boolean;
  wouldUpdateCount: number;
  wouldPreserveCount: number;
  eligibleItems: Array<{ stagingId: string; candidateId: string; candidateName: string; fieldName: string; candidateField: string; currentDbValue: unknown; approvedValue: string; reasons: string[] }>;
  blockedItems: Array<{ stagingId: string; candidateId: string; candidateName: string; fieldName: string; currentDbValue: unknown; approvedValue: string; reasons: string[] }>;
  conflicts: Array<{ stagingId: string; candidateId: string; candidateName: string; fieldName: string; currentDbValue: unknown; approvedValue: string; reasons: string[] }>;
};

type ApplyHistoryStatus = "staged_pending_apply" | "eligible_for_apply" | "applied_verified" | "preserved_already_applied" | "blocked" | "conflict" | "rollback_available" | "rollback_missing" | "post_apply_mismatch" | "missing_candidate" | "missing_report_file";

type ApplyHistory = {
  generatedAt: string;
  summary: { stagedFields: number; eligibleFields: number; alreadyAppliedPreservedFields: number; appliedFields: number; blockedFields: number; conflicts: number; backupAvailable: boolean; rollbackAvailable: boolean; postApplyVerified: number; postApplyMismatch: number; missingBackupOrRollback: number };
  files: { stagingFound: boolean; backupFound: boolean; rollbackFound: boolean; postAuditFound: boolean; messages: string[] };
  items: Array<{ historyId: string; candidateId: string; candidateName: string; fieldName: string; dbFieldName: string; beforeValue: unknown; stagingCurrentValue: unknown; approvedValue: unknown; currentDbValue: unknown; finalDbValue: unknown; status: ApplyHistoryStatus; source: string; riskLevel: string; backupAvailable: boolean; rollbackAvailable: boolean; backupStatus: string; rollbackStatus: string; backupOldValue: unknown; rollbackValue: unknown; validationMessages: string[]; evidence: string; filePaths: string[]; safetyNote: string; lastChecked: string }>;
};

type BatchPlan = {
  generatedAt: string;
  providerMode: string;
  targetFields: string[];
  selectedCandidates: Array<{ candidateId: string; candidateName: string; missingFields: string[]; selectedTargetFields: string[]; currentStatus: string; aiStatus: string; reviewStatus: string; stagingStatus: string; applyPreviewStatus: string; lastUpdated: string; safetyNote: string }>;
  excludedCandidates: Array<{ candidateId: string; candidateName: string; exclusionReasons: string[] }>;
  summary: { totalCandidateRecords: number; candidatesNeedingAiReview: number; candidatesEligibleForBatch: number; excludedCandidates: number; selectedBatchSize: number; fieldsTargeted: string[]; estimatedAiCalls: number; providerMode: string; safetyStatus: string; warnings: string[]; errors: string[] };
  guardrails: { warnings: string[]; errors: string[]; safetyStatus: string };
};

type BatchProgress = {
  generatedAt: string;
  summary: { plannedCandidates: number; aiCompleted: number; aiFailed: number; reviewPending: number; approved: number; staged: number; appliedVerified: number; blocked: number; conflicts: number };
  items: Array<{ candidateName: string; candidateId: string; missingFields: string[]; selectedTargetFields: string[]; currentStatus: string; aiStatus: string; reviewStatus: string; stagingStatus: string; applyPreviewStatus: string; lastUpdated: string; safetyNote: string }>;
};

type BatchPromotion = {
  generatedAt: string;
  mode: string;
  outputPath?: string;
  summary: { batchReviewItems: number; newReviewItems: number; existingReviewItemsPreserved: number; duplicateReviewItemsSkipped: number; invalidReviewItemsBlocked: number; readyForRecruiterReview: number; existingApprovalsPreserved: number };
  promotedItems: Array<{ promotionId: string; candidateId: string; candidateName: string; fieldName: string; validationStatus: string; validationReasons: string[] }>;
  duplicateItems: Array<{ promotionId: string; candidateId: string; candidateName: string; fieldName: string; validationStatus: string; validationReasons: string[] }>;
  blockedItems: Array<{ promotionId: string; candidateId: string; candidateName: string; fieldName: string; validationStatus: string; validationReasons: string[] }>;
};

type SavedApproval = {
  approvalId?: string;
  candidateId: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  parserValue: string;
  aiEvidence: string;
  aiConfidence: number;
  decision: "approve_suggestion" | "reject_suggestion" | "keep_existing" | "mark_for_review" | "manual_override_approve";
  riskLevel: "safe" | "risky" | "rejected" | "conflict";
  reviewerNote: string;
  overrideReason: string;
  reason?: string;
};

const FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "safe", label: "Safe suggestions" },
  { key: "risky", label: "Risky suggestions" },
  { key: "manual_review", label: "Manual review" },
  { key: "reupload_required", label: "Reupload required" },
  { key: "still_blocked", label: "Still blocked" },
  { key: "search_ready_after_approval", label: "Search-ready after approval" },
  { key: "missing_ai", label: "Missing AI result" },
  { key: "module_conflict", label: "Module conflict" },
  { key: "employer_issue", label: "Employer issue" },
  { key: "title_issue", label: "Title issue" },
  { key: "identity_issue", label: "Identity issue" },
  { key: "batch_promotion", label: "Batch promotion" },
];

const FIELD_VIEWS: Array<{ key: FieldViewMode; label: string }> = [
  { key: "suggested", label: "Suggested fields" },
  { key: "risk", label: "Risky/rejected" },
  { key: "all", label: "All fields" },
];

const TONE: Record<string, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  rejected: "border-red-500/30 bg-red-500/10 text-red-100",
  keep: "border-slate-500/30 bg-slate-500/10 text-slate-100",
  reupload: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100",
  missing: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
};

function empty(value: string) {
  return value || "Not available";
}

function approvalKey(candidateId: string, field: string) {
  return `${candidateId}:${field}`;
}

function localActionFromSaved(decision: SavedApproval["decision"]): FieldApprovalAction {
  if (decision === "approve_suggestion" || decision === "manual_override_approve") return "approve";
  if (decision === "reject_suggestion") return "reject";
  if (decision === "keep_existing") return "keep";
  return "manual_review";
}

function riskLevelForField(field: WorkspaceField): SavedApproval["riskLevel"] {
  if (field.decision === "reject") return "rejected";
  if (field.decision === "conflict") return "conflict";
  if (field.decision === "safe_accept") return "safe";
  return "risky";
}

function persistedDecisionFor(field: WorkspaceField, action: FieldApprovalAction, overrideReason: string): SavedApproval["decision"] {
  if (action === "approve" && field.canApprove) return "approve_suggestion";
  if (action === "approve" && overrideReason.trim()) return "manual_override_approve";
  if (action === "reject") return "reject_suggestion";
  if (action === "keep") return "keep_existing";
  return "mark_for_review";
}

function buildSavedApprovals(workspace: ReviewWorkspace, approvals: ApprovalState): SavedApproval[] {
  const fieldsByKey = new Map<string, WorkspaceField>();
  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) fieldsByKey.set(approvalKey(candidate.candidateId, field.field), field);
  }
  return Object.entries(approvals).flatMap(([key, approval]) => {
    const index = key.indexOf(":");
    const candidateId = key.slice(0, index);
    const fieldName = key.slice(index + 1);
    const field = fieldsByKey.get(key);
    if (!field || !approval?.action || approval.action === "pending") return [];
    return [{
      approvalId: key,
      candidateId,
      fieldName,
      currentValue: field.existingValue,
      suggestedValue: field.aiValue,
      parserValue: field.parserValue,
      aiEvidence: field.evidence,
      aiConfidence: field.confidence,
      decision: persistedDecisionFor(field, approval.action, approval.overrideReason || ""),
      riskLevel: riskLevelForField(field),
      reviewerNote: "",
      overrideReason: approval.overrideReason || "",
      reason: field.reason,
    }];
  });
}
function matchesFilter(candidate: WorkspaceCandidate, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "safe") return candidate.safeCount > 0;
  if (filter === "risky") return candidate.riskyCount > 0;
  if (filter === "manual_review") return candidate.riskyCount > 0 || candidate.rejectedCount > 0 || candidate.recommendedAction === "Review AI suggestions";
  if (filter === "reupload_required") return candidate.reuploadRequired;
  if (filter === "still_blocked") return candidate.stillBlocked;
  if (filter === "search_ready_after_approval") return candidate.searchReadyAfterManualApprovals;
  if (filter === "missing_ai") return candidate.aiStatus === "AI Missing";
  if (filter === "module_conflict") return candidate.fields.some((field) => /module_conflicts|conflict/i.test(field.reason));
  if (filter === "employer_issue") return candidate.fields.some((field) => /employer|Company/i.test(field.field) && /invalid|dirty|review|missing|not_disclosed/i.test(field.reason));
  if (filter === "title_issue") return candidate.fields.some((field) => field.field === "title" && /invalid|generic|missing|review/i.test(field.reason));
  if (filter === "identity_issue") return candidate.fields.some((field) => field.field === "displayName" && /identity|name|missing|invalid|dirty/i.test(field.reason));
  if (filter === "batch_promotion") return candidate.debug?.queueItem?.source === "batch_promotion" || candidate.debug?.source === "batch_promotion";
  return true;
}

function statusTone(candidate: WorkspaceCandidate) {
  if (candidate.reuploadRequired) return TONE.reupload;
  if (candidate.aiStatus === "AI Missing") return TONE.missing;
  if (candidate.rejectedCount) return TONE.rejected;
  if (candidate.riskyCount) return TONE.review;
  if (candidate.safeCount) return TONE.safe;
  return TONE.keep;
}

export default function AiExtractionReviewPage() {
  const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [fieldView, setFieldView] = useState<FieldViewMode>("suggested");
  const [query, setQuery] = useState("");
  const [approvals, setApprovals] = useState<ApprovalState>({});
  const [savedApprovals, setSavedApprovals] = useState<SavedApproval[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [stagingPreview, setStagingPreview] = useState<StagingPreview | null>(null);
  const [stagingStatus, setStagingStatus] = useState("");
  const [stagingLoading, setStagingLoading] = useState(false);
  const [candidateApplyPreview, setCandidateApplyPreview] = useState<CandidateApplyPreview | null>(null);
  const [candidateApplyStatus, setCandidateApplyStatus] = useState("");
  const [candidateApplyLoading, setCandidateApplyLoading] = useState(false);
  const [applyHistory, setApplyHistory] = useState<ApplyHistory | null>(null);
  const [applyHistoryLoading, setApplyHistoryLoading] = useState(false);
  const [applyHistoryError, setApplyHistoryError] = useState("");
  const [applyHistoryFilter, setApplyHistoryFilter] = useState<"all" | "applied_verified" | "preserved_already_applied" | "eligible_for_apply" | "blocked" | "conflict" | "post_apply_mismatch" | "missing_backup_rollback">("all");
  const [applyHistoryQuery, setApplyHistoryQuery] = useState("");
  const [batchPlan, setBatchPlan] = useState<BatchPlan | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchPromotion, setBatchPromotion] = useState<BatchPromotion | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchPromotionLoading, setBatchPromotionLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");
  const [batchPromotionStatus, setBatchPromotionStatus] = useState("");
  const [batchSize, setBatchSize] = useState(10);
  const [batchTargetFields, setBatchTargetFields] = useState<string[]>(["currentCompany", "title", "primarySapModule"]);
  const [batchOptions, setBatchOptions] = useState({ validationQueueOnly: false, includeMustRepair: false, highConfidenceOnly: false, excludeAlreadyApplied: true, excludeDuplicateConflict: true, excludeReupload: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadApprovals() {
      try {
        const res = await fetch("/api/recruiter/ai-extraction-review/approvals", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load saved approvals");
        const loaded = Array.isArray(json.approvals) ? json.approvals as SavedApproval[] : [];
        setSavedApprovals(loaded);
        setApprovals(Object.fromEntries(loaded.map((approval) => [approvalKey(approval.candidateId, approval.fieldName), { action: localActionFromSaved(approval.decision), overrideReason: approval.overrideReason }] as const)));
        setOverrideReasons(Object.fromEntries(loaded.filter((approval) => approval.overrideReason).map((approval) => [approvalKey(approval.candidateId, approval.fieldName), approval.overrideReason] as const)));
        setHasUnsavedChanges(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSaveStatus(err instanceof Error ? err.message : "Unable to load saved approvals");
      }
    }
    loadApprovals();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadApplyHistory() {
      setApplyHistoryLoading(true);
      setApplyHistoryError("");
      try {
        const res = await fetch("/api/recruiter/ai-extraction-review/apply-history", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load apply history");
        setApplyHistory(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setApplyHistoryError(err instanceof Error ? err.message : "Unable to load apply history");
      } finally {
        if (!controller.signal.aborted) setApplyHistoryLoading(false);
      }
    }
    loadApplyHistory();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/recruiter/ai-extraction-review", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load review workspace");
        setWorkspace(json);
        setSelectedId(json.candidates?.[0]?.candidateId || "");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Unable to load review workspace");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const filteredCandidates = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (workspace?.candidates || []).filter((candidate) => {
      const searchText = `${candidate.candidateName} ${candidate.candidateId} ${candidate.decisionAction} ${candidate.missingBlockers.join(" ")}`.toLowerCase();
      return matchesFilter(candidate, filter) && (!text || searchText.includes(text));
    });
  }, [workspace, filter, query]);

  const selected = useMemo(() => {
    return (workspace?.candidates || []).find((candidate) => candidate.candidateId === selectedId) || filteredCandidates[0] || null;
  }, [workspace, selectedId, filteredCandidates]);

  const localSummary = useMemo(() => (workspace ? buildLocalApprovalSummary(workspace, approvals) : { approvedFields: 0, rejectedFields: 0, manualReviewFields: 0, readyForApplyPreview: 0 }), [workspace, approvals]);

  async function saveReviewDecisions() {
    if (!workspace) return;
    setSaveStatus("");
    const payload = buildSavedApprovals(workspace, approvals);
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json.errors || [json.error || "Unable to save approvals"]).join("; "));
      const loaded = Array.isArray(json.approvals) ? json.approvals as SavedApproval[] : [];
      setSavedApprovals(loaded);
      setHasUnsavedChanges(false);
      setSaveStatus("Review decisions saved");
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Unable to save approvals");
    }
  }

  async function buildPreview() {
    setPreviewLoading(true);
    setError("");
    try {
      const previewApprovals = workspace ? buildSavedApprovals(workspace, approvals) : savedApprovals;
      const res = await fetch("/api/recruiter/ai-extraction-review/apply-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: previewApprovals }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to build apply preview");
      setPreview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to build apply preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function previewStaging() {
    setStagingLoading(true);
    setStagingStatus("");
    try {
      const stagingApprovals = workspace ? buildSavedApprovals(workspace, approvals) : savedApprovals;
      const res = await fetch("/api/recruiter/ai-extraction-review/staging-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: stagingApprovals, dryRun: true, noApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to build staging preview");
      setStagingPreview(json);
      setStagingStatus("Staging preview ready. No Talent Search data was changed.");
    } catch (err) {
      setStagingStatus(err instanceof Error ? err.message : "Unable to build staging preview");
    } finally {
      setStagingLoading(false);
    }
  }

  async function stageApprovedChanges() {
    setStagingLoading(true);
    setStagingStatus("");
    try {
      const stagingApprovals = workspace ? buildSavedApprovals(workspace, approvals) : savedApprovals;
      const res = await fetch("/api/recruiter/ai-extraction-review/stage-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals: stagingApprovals, dryRun: true, noApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to stage approved changes");
      setStagingPreview(json);
      setStagingStatus("Dry-run staging complete. This only saves to staging when explicitly run with writeStaging; Talent Search was not updated.");
    } catch (err) {
      setStagingStatus(err instanceof Error ? err.message : "Unable to stage approved changes");
    } finally {
      setStagingLoading(false);
    }
  }
  async function planBatch() {
    setBatchLoading(true);
    setBatchStatus("");
    try {
      const params = new URLSearchParams({ batchSize: String(batchSize), targetFields: batchTargetFields.join(","), provider: "mock" });
      if (batchOptions.validationQueueOnly) params.set("validationQueueOnly", "true");
      if (batchOptions.includeMustRepair) params.set("includeMustRepair", "true");
      if (batchOptions.highConfidenceOnly) params.set("highConfidenceOnly", "true");
      const res = await fetch(`/api/recruiter/ai-extraction-review/batch-plan?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to plan batch");
      setBatchPlan(json);
      setBatchStatus("Batch plan ready. No candidate records were changed.");
    } catch (err) {
      setBatchStatus(err instanceof Error ? err.message : "Unable to plan batch");
    } finally {
      setBatchLoading(false);
    }
  }

  async function refreshBatchProgress() {
    setBatchLoading(true);
    setBatchStatus("");
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/batch-progress");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load batch progress");
      setBatchProgress(json);
      setBatchStatus("Batch progress refreshed. Read-only view only.");
    } catch (err) {
      setBatchStatus(err instanceof Error ? err.message : "Unable to load batch progress");
    } finally {
      setBatchLoading(false);
    }
  }


  async function loadWorkspaceAfterPromotion() {
    const res = await fetch("/api/recruiter/ai-extraction-review");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to refresh review workspace");
    setWorkspace(json);
    setSelectedId(json.candidates?.[0]?.candidateId || "");
  }

  async function previewBatchPromotion() {
    setBatchPromotionLoading(true);
    setBatchPromotionStatus("");
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/batch-promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, noApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to preview batch promotion");
      setBatchPromotion(json);
      setBatchPromotionStatus("Promotion preview ready. Review file was not changed.");
    } catch (err) {
      setBatchPromotionStatus(err instanceof Error ? err.message : "Unable to preview batch promotion");
    } finally {
      setBatchPromotionLoading(false);
    }
  }

  async function promoteBatchToReview() {
    setBatchPromotionLoading(true);
    setBatchPromotionStatus("");
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/batch-promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writeReviewFile: true, noApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to promote batch review items");
      setBatchPromotion(json);
      await loadWorkspaceAfterPromotion();
      setBatchPromotionStatus("Batch review items promoted into the Review Workspace file. No approvals, staging, or candidate updates were made.");
    } catch (err) {
      setBatchPromotionStatus(err instanceof Error ? err.message : "Unable to promote batch review items");
    } finally {
      setBatchPromotionLoading(false);
    }
  }

  async function previewCandidateApply() {
    setCandidateApplyLoading(true);
    setCandidateApplyStatus("");
    try {
      const res = await fetch("/api/recruiter/ai-extraction-review/candidate-apply-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, noApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to preview candidate updates");
      setCandidateApplyPreview(json);
      setCandidateApplyStatus("Candidate update preview ready. Talent Search was not changed.");
    } catch (err) {
      setCandidateApplyStatus(err instanceof Error ? err.message : "Unable to preview candidate updates");
    } finally {
      setCandidateApplyLoading(false);
    }
  }

  function setFieldApproval(candidateId: string, field: WorkspaceField, action: FieldApprovalAction) {
    const key = approvalKey(candidateId, field.field);
    const reason = overrideReasons[key] || "";
    if (action === "approve" && field.requiresOverride && !reason.trim()) return;
    setApprovals((current) => ({ ...current, [key]: { action, overrideReason: reason } }));
    setHasUnsavedChanges(true);
    setSaveStatus("");
  }

  const cards = [
    ["Total queued", workspace?.summary.totalQueued],
    ["AI results available", workspace?.summary.aiResultsAvailable],
    ["Safe field suggestions", workspace?.summary.safeFieldSuggestions],
    ["Risky suggestions", workspace?.summary.riskySuggestions],
    ["Rejected suggestions", workspace?.summary.rejectedSuggestions],
    ["Manual review required", workspace?.summary.manualReviewRequired],
    ["Ready after approval", workspace?.summary.potentialSearchReadyAfterApproval],
    ["Reupload required", workspace?.summary.reuploadRequired],
  ];

  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <div className="border-b border-slate-800 bg-[#080B10]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">AI Extraction Review</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Review AI suggestions before Talent Search changes</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Dry-run only</span>
            <Link href="/search" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Talent Search</Link>
            <Link href="/validation-queue" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-100">Validation Queue</Link>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-6 py-6">
        {error ? <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        {loading ? <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-300">Loading AI extraction review...</div> : null}
        {!loading && !workspace?.reportStatus.reviewReportFound ? (
          <div className="border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">No review report found. Generate `reports/ai-extraction-review.json` before using this workspace.</div>
        ) : null}

        {!loading && workspace ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {cards.map(([label, value]) => (
                <div key={String(label)} className="border border-slate-800 bg-[#0B0F16] p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{value ?? "-"}</div>
                </div>
              ))}
            </div>

            <StickyApprovalSummary summary={localSummary} previewLoading={previewLoading} stagingLoading={stagingLoading} candidateApplyLoading={candidateApplyLoading} onPreview={buildPreview} onSave={saveReviewDecisions} onPreviewStaging={previewStaging} onStageApproved={stageApprovedChanges} onPreviewCandidateApply={previewCandidateApply} hasUnsavedChanges={hasUnsavedChanges} saveStatus={saveStatus} stagingStatus={stagingStatus} candidateApplyStatus={candidateApplyStatus} />

            <div className="mt-5 flex flex-wrap items-center gap-2 border border-slate-800 bg-[#0B0F16] p-4">
              {FILTERS.map((item) => (
                <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === item.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>
                  {item.label}
                </button>
              ))}
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, reason, blocker" className="min-w-72 flex-1 rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
            </div>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="xl:sticky xl:top-24">
                <CandidateList candidates={filteredCandidates} selectedId={selected?.candidateId || ""} onSelect={setSelectedId} />
              </div>
              {selected ? (
                <CandidateDetail
                  candidate={selected}
                  approvals={approvals}
                  fieldView={fieldView}
                  setFieldView={setFieldView}
                  overrideReasons={overrideReasons}
                  setOverrideReasons={setOverrideReasons}
                  setFieldApproval={setFieldApproval}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                  setSaveStatus={setSaveStatus}
                  preview={preview}
                  stagingPreview={stagingPreview}
                  candidateApplyPreview={candidateApplyPreview}
                />
              ) : (
                <div className="border border-slate-800 bg-[#0B0F16] p-6 text-slate-400">No candidates in this view.</div>
              )}
            </div>

            <BatchExpansionControl plan={batchPlan} progress={batchProgress} promotion={batchPromotion} loading={batchLoading} promotionLoading={batchPromotionLoading} status={batchStatus} promotionStatus={batchPromotionStatus} batchSize={batchSize} setBatchSize={setBatchSize} targetFields={batchTargetFields} setTargetFields={setBatchTargetFields} options={batchOptions} setOptions={setBatchOptions} onPlan={planBatch} onRefreshProgress={refreshBatchProgress} onPreviewPromote={previewBatchPromotion} onPromoteReview={promoteBatchToReview} />

            <ApplyHistoryPanel history={applyHistory} loading={applyHistoryLoading} error={applyHistoryError} filter={applyHistoryFilter} setFilter={setApplyHistoryFilter} query={applyHistoryQuery} setQuery={setApplyHistoryQuery} />

            <details className="mt-5 border border-slate-800 bg-[#0B0F16] p-4 text-sm text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-200">Debug details</summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>Review report: {workspace.reportStatus.reviewReportFound ? "Loaded" : "Missing"}</div>
                <div>Apply plan: {workspace.reportStatus.applyPlanFound ? "Loaded" : "Missing"}</div>
                <div>AI result cache: {workspace.reportStatus.aiResultsFound ? "Loaded" : "Missing"}</div>
                <div>Cache status: {workspace.reportStatus.staleCache ? "May be stale" : "Current enough for review"}</div>
              </div>
              {workspace.reportStatus.errors.length ? <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-red-200">{workspace.reportStatus.errors.join("\n")}</pre> : null}
            </details>
          </>
        ) : null}
      </section>
    </main>
  );
}

function valueText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "Not available");
}

function historyStatusLabel(status: ApplyHistoryStatus) {
  const labels: Record<ApplyHistoryStatus, string> = {
    staged_pending_apply: "Staged pending apply",
    eligible_for_apply: "Eligible pending",
    applied_verified: "Applied verified",
    preserved_already_applied: "Already applied / preserved",
    blocked: "Blocked",
    conflict: "Conflict",
    rollback_available: "Rollback available",
    rollback_missing: "Rollback missing",
    post_apply_mismatch: "Mismatch",
    missing_candidate: "Missing candidate",
    missing_report_file: "Missing report file",
  };
  return labels[status] || status;
}

function historyTone(status: ApplyHistoryStatus) {
  if (status === "applied_verified" || status === "preserved_already_applied") return TONE.safe;
  if (status === "post_apply_mismatch" || status === "conflict") return TONE.rejected;
  if (status === "blocked" || status === "missing_candidate" || status === "missing_report_file") return TONE.review;
  return TONE.keep;
}

function BatchExpansionControl({ plan, progress, promotion, loading, promotionLoading, status, promotionStatus, batchSize, setBatchSize, targetFields, setTargetFields, options, setOptions, onPlan, onRefreshProgress, onPreviewPromote, onPromoteReview }: { plan: BatchPlan | null; progress: BatchProgress | null; promotion: BatchPromotion | null; loading: boolean; promotionLoading: boolean; status: string; promotionStatus: string; batchSize: number; setBatchSize: (size: number) => void; targetFields: string[]; setTargetFields: (fields: string[]) => void; options: { validationQueueOnly: boolean; includeMustRepair: boolean; highConfidenceOnly: boolean; excludeAlreadyApplied: boolean; excludeDuplicateConflict: boolean; excludeReupload: boolean }; setOptions: React.Dispatch<React.SetStateAction<{ validationQueueOnly: boolean; includeMustRepair: boolean; highConfidenceOnly: boolean; excludeAlreadyApplied: boolean; excludeDuplicateConflict: boolean; excludeReupload: boolean }>>; onPlan: () => void; onRefreshProgress: () => void; onPreviewPromote: () => void; onPromoteReview: () => void }) {
  const fieldOptions = [
    ["currentCompany", "Missing employer/company"],
    ["title", "Missing title"],
    ["primarySapModule", "Missing module"],
    ["sapSkills", "Missing skills"],
    ["location", "Missing location"],
  ] as const;
  const progressItems = progress?.items?.length ? progress.items : plan?.selectedCandidates || [];
  const summaryCards = plan ? [
    ["Total candidate records", plan.summary.totalCandidateRecords],
    ["Candidates needing AI review", plan.summary.candidatesNeedingAiReview],
    ["Eligible for batch", plan.summary.candidatesEligibleForBatch],
    ["Excluded candidates", plan.summary.excludedCandidates],
    ["Selected batch size", plan.summary.selectedBatchSize],
    ["Estimated AI calls", plan.summary.estimatedAiCalls],
    ["Provider mode", plan.summary.providerMode],
    ["Safety status", plan.summary.safetyStatus],
  ] : [];
  const promotionCards = promotion ? [
    ["Batch review items", promotion.summary.batchReviewItems],
    ["New review items", promotion.summary.newReviewItems],
    ["Existing preserved", promotion.summary.existingReviewItemsPreserved],
    ["Duplicates skipped", promotion.summary.duplicateReviewItemsSkipped],
    ["Invalid blocked", promotion.summary.invalidReviewItemsBlocked],
    ["Ready for recruiter review", promotion.summary.readyForRecruiterReview],
    ["Approvals preserved", promotion.summary.existingApprovalsPreserved],
  ] : [];
  function toggleField(field: string) {
    setTargetFields(targetFields.includes(field) ? targetFields.filter((item) => item !== field) : [...targetFields, field]);
  }
  return (
    <section className="mt-5 border border-emerald-500/20 bg-[#0B0F16]">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Batch Expansion Control</h2>
            <p className="mt-1 text-sm text-emerald-100">BATCH MODE IS REVIEW-FIRST. This section does not update candidate records.</p>
          </div>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">No external AI calls by default</span>
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.length ? summaryCards.map(([label, value]) => (
              <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{String(value)}</div>
              </div>
            )) : <div className="border border-slate-800 bg-[#05070A] p-4 text-sm text-slate-400 lg:col-span-4">No batch plan loaded yet. Use Plan batch to preview the next safe batch.</div>}
          </div>
          {plan?.guardrails.warnings.length ? <div className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{plan.guardrails.warnings.join("; ")}</div> : null}
          {plan?.guardrails.errors.length ? <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{plan.guardrails.errors.join("; ")}</div> : null}
          <div className="border border-cyan-500/20 bg-[#05070A] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Promotion summary</h3>
                <p className="mt-1 text-sm text-cyan-100">This only moves batch review items into the review file. It does not approve, stage, or apply candidate updates.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={onPreviewPromote} disabled={promotionLoading} className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm font-bold text-cyan-100 hover:border-cyan-300 disabled:opacity-50">{promotionLoading ? "Checking..." : "Preview promote to review"}</button>
                <button onClick={onPromoteReview} disabled={promotionLoading} className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">Promote to Review Workspace</button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {promotionCards.length ? promotionCards.map(([label, value]) => (
                <div key={String(label)} className="border border-slate-800 bg-[#070A0F] p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{String(value)}</div>
                </div>
              )) : <div className="border border-slate-800 bg-[#070A0F] p-4 text-sm text-slate-400 lg:col-span-4">No promotion preview yet.</div>}
            </div>
            {promotion ? (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {promotion.promotedItems.slice(0, 5).map((item) => <div key={item.promotionId} className="border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-100">{item.candidateName || item.candidateId} / {item.fieldName}</div>)}
                {promotion.duplicateItems.slice(0, 5).map((item) => <div key={`${item.promotionId}-duplicate`} className="border border-slate-700 bg-slate-500/5 p-2 text-xs text-slate-300">Skipped duplicate: {item.candidateName || item.candidateId} / {item.fieldName}</div>)}
                {promotion.blockedItems.slice(0, 5).map((item) => <div key={`${item.promotionId}-blocked`} className="border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">Blocked: {item.candidateName || item.candidateId} / {item.fieldName} - {item.validationReasons.join("; ")}</div>)}
              </div>
            ) : null}
            {promotionStatus ? <div className="mt-3 text-sm text-cyan-100">{promotionStatus}</div> : null}
          </div>
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-800">
                  {['Candidate','Candidate ID','Missing fields','Selected target fields','Current status','AI status','Review status','Staging status','Apply preview status','Last updated','Safety note'].map((head) => <th key={head} className="px-3 py-2 font-semibold">{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {progressItems.map((item) => (
                  <tr key={item.candidateId} className="align-top hover:bg-slate-900/40">
                    <td className="px-3 py-3 text-slate-100">{item.candidateName}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{item.candidateId}</td>
                    <td className="px-3 py-3 text-slate-300">{item.missingFields.join(", ") || "None"}</td>
                    <td className="px-3 py-3 text-cyan-100">{item.selectedTargetFields.join(", ") || "None"}</td>
                    <td className="px-3 py-3 text-slate-300">{item.currentStatus}</td>
                    <td className="px-3 py-3 text-slate-300">{item.aiStatus}</td>
                    <td className="px-3 py-3 text-slate-300">{item.reviewStatus}</td>
                    <td className="px-3 py-3 text-slate-300">{item.stagingStatus}</td>
                    <td className="px-3 py-3 text-slate-300">{item.applyPreviewStatus}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{item.lastUpdated}</td>
                    <td className="px-3 py-3 text-slate-400">{item.safetyNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!progressItems.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No batch candidates selected yet.</div> : null}
          </div>
        </div>
        <div className="space-y-4 border border-slate-800 bg-[#05070A] p-4">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Batch size</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((size) => <button key={size} onClick={() => setBatchSize(size)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${batchSize === size ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300"}`}>{size}</button>)}
            </div>
            {batchSize === 50 ? <div className="mt-2 text-xs text-amber-100">Batch size 50 should be reviewed carefully.</div> : null}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Batch filters</div>
            <div className="mt-2 space-y-2">
              {fieldOptions.map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={targetFields.includes(field)} onChange={() => toggleField(field)} /> {label}</label>)}
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={options.validationQueueOnly} onChange={(event) => setOptions((current) => ({ ...current, validationQueueOnly: event.target.checked }))} /> Validation queue only</label>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={options.includeMustRepair} onChange={(event) => setOptions((current) => ({ ...current, includeMustRepair: event.target.checked }))} /> Must repair before search</label>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={options.highConfidenceOnly} onChange={(event) => setOptions((current) => ({ ...current, highConfidenceOnly: event.target.checked }))} /> High confidence only</label>
              <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={options.excludeAlreadyApplied} readOnly /> Exclude already applied / verified</label>
              <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={options.excludeDuplicateConflict} readOnly /> Exclude duplicate conflict</label>
              <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={options.excludeReupload} readOnly /> Exclude requires original file reupload</label>
            </div>
          </div>
          <div className="border border-slate-800 p-3 text-sm text-slate-300">
            <div className="font-semibold text-white">Provider mode</div>
            <div className="mt-1">cached/mock/default</div>
            <div className="mt-1 text-xs text-cyan-100">External provider only if explicitly requested in CLI with confirm flag and max call limit.</div>
          </div>
          <div className="grid gap-2">
            <button onClick={onPlan} disabled={loading} className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">Plan batch</button>
            <button disabled className="rounded-md border border-slate-800 px-4 py-3 text-sm font-bold text-slate-500">Run dry-run batch from CLI</button>
            <button disabled className="rounded-md border border-slate-800 px-4 py-3 text-sm font-bold text-slate-500">Load cached AI results</button>
            <button disabled className="rounded-md border border-slate-800 px-4 py-3 text-sm font-bold text-slate-500">Generate review file</button>
            <button onClick={onRefreshProgress} disabled={loading} className="rounded-md border border-cyan-500/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:border-cyan-300 disabled:opacity-50">Refresh progress</button>
          </div>
          {status ? <div className="text-sm text-emerald-100">{status}</div> : null}
        </div>
      </div>
    </section>
  );
}
function ApplyHistoryPanel({ history, loading, error, filter, setFilter, query, setQuery }: { history: ApplyHistory | null; loading: boolean; error: string; filter: "all" | "applied_verified" | "preserved_already_applied" | "eligible_for_apply" | "blocked" | "conflict" | "post_apply_mismatch" | "missing_backup_rollback"; setFilter: (filter: "all" | "applied_verified" | "preserved_already_applied" | "eligible_for_apply" | "blocked" | "conflict" | "post_apply_mismatch" | "missing_backup_rollback") => void; query: string; setQuery: (query: string) => void }) {
  const filters = [
    ["all", "All"],
    ["applied_verified", "Applied verified"],
    ["preserved_already_applied", "Already applied / preserved"],
    ["eligible_for_apply", "Eligible pending"],
    ["blocked", "Blocked"],
    ["conflict", "Conflicts"],
    ["post_apply_mismatch", "Mismatch"],
    ["missing_backup_rollback", "Missing backup / rollback"],
  ] as const;
  const text = query.trim().toLowerCase();
  const items = (history?.items || []).filter((item) => {
    const matchesFilter = filter === "all" || (filter === "missing_backup_rollback" ? !item.backupAvailable || !item.rollbackAvailable : item.status === filter || (filter === "conflict" && item.status === "post_apply_mismatch"));
    const searchText = `${item.candidateName} ${item.candidateId} ${item.fieldName} ${item.dbFieldName} ${valueText(item.approvedValue)} ${valueText(item.currentDbValue)}`.toLowerCase();
    return matchesFilter && (!text || searchText.includes(text));
  });
  const cards = history ? [
    ["Staged fields", history.summary.stagedFields],
    ["Eligible fields", history.summary.eligibleFields],
    ["Already applied / preserved", history.summary.alreadyAppliedPreservedFields],
    ["Applied fields", history.summary.appliedFields],
    ["Blocked fields", history.summary.blockedFields],
    ["Conflicts", history.summary.conflicts],
    ["Backup available", history.summary.backupAvailable ? "Yes" : "No"],
    ["Rollback available", history.summary.rollbackAvailable ? "Yes" : "No"],
    ["Post-apply verified", history.summary.postApplyVerified],
    ["Post-apply mismatch", history.summary.postApplyMismatch],
  ] : [];
  return (
    <section className="mt-5 border border-cyan-500/20 bg-[#0B0F16]">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Post-Apply Audit & History</h2>
            <p className="mt-1 text-sm text-cyan-100">READ-ONLY AUDIT VIEW. This dashboard does not update candidate records.</p>
          </div>
          <span className="rounded-md border border-slate-700 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Talent Search remains source of truth</span>
        </div>
      </div>
      {loading ? <div className="p-5 text-sm text-slate-400">Loading apply history...</div> : null}
      {error ? <div className="m-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
      {history ? (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-4 grid gap-2 text-sm text-amber-100">
            {!history.files.stagingFound ? <div className="border border-amber-500/30 bg-amber-500/10 p-3">No staged changes found yet.</div> : null}
            {!history.files.backupFound ? <div className="border border-amber-500/30 bg-amber-500/10 p-3">No backup file found. Real apply may not have been run yet.</div> : null}
            {!history.files.rollbackFound ? <div className="border border-amber-500/30 bg-amber-500/10 p-3">No rollback file found. Rollback is not available.</div> : null}
            {!history.files.postAuditFound ? <div className="border border-amber-500/30 bg-amber-500/10 p-3">No post-apply audit file found. Run apply or audit to generate it.</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-y border-slate-800 p-4">
            {filters.map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>{label}</button>
            ))}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate, field, company, approved value" className="min-w-72 flex-1 rounded-md border border-slate-700 bg-[#05070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          <div className="overflow-auto p-4">
            <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-800">
                  {['Candidate','Candidate ID','Field','DB field','Before value','Approved value','Current DB value','Status','Source','Risk level','Backup','Rollback','Last checked'].map((head) => <th key={head} className="px-3 py-2 font-semibold">{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item) => (
                  <tr key={item.historyId} className="align-top hover:bg-slate-900/40">
                    <td className="px-3 py-3 text-slate-100">{item.candidateName}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{item.candidateId}</td>
                    <td className="px-3 py-3 text-slate-200">{item.fieldName}</td>
                    <td className="px-3 py-3 text-slate-300">{item.dbFieldName || "Not mapped"}</td>
                    <td className="px-3 py-3 text-slate-400">{valueText(item.beforeValue)}</td>
                    <td className="px-3 py-3 font-semibold text-cyan-100">{valueText(item.approvedValue)}</td>
                    <td className="px-3 py-3 text-slate-200">{valueText(item.currentDbValue)}</td>
                    <td className="px-3 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${historyTone(item.status)}`}>{historyStatusLabel(item.status)}</span></td>
                    <td className="px-3 py-3 text-slate-400">{item.source}</td>
                    <td className="px-3 py-3 text-slate-300">{item.riskLevel}</td>
                    <td className="px-3 py-3 text-slate-300">{item.backupStatus}</td>
                    <td className="px-3 py-3 text-slate-300">{item.rollbackStatus}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{item.lastChecked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No apply history rows match this view.</div> : null}
          </div>
          <div className="space-y-2 p-4 pt-0">
            {items.slice(0, 20).map((item) => (
              <details key={`${item.historyId}-details`} className="border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-200">Details: {item.candidateName} / {item.fieldName}</summary>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <div>Candidate ID: <span className="text-slate-200">{item.candidateId}</span></div>
                  <div>Field: <span className="text-slate-200">{item.fieldName}</span></div>
                  <div>DB field: <span className="text-slate-200">{item.dbFieldName || "Not mapped"}</span></div>
                  <div>Staging current: <span className="text-slate-200">{valueText(item.stagingCurrentValue)}</span></div>
                  <div>Approved value: <span className="text-slate-200">{valueText(item.approvedValue)}</span></div>
                  <div>Final DB value: <span className="text-slate-200">{valueText(item.finalDbValue)}</span></div>
                  <div>Backup old value: <span className="text-slate-200">{valueText(item.backupOldValue)}</span></div>
                  <div>Rollback value: <span className="text-slate-200">{valueText(item.rollbackValue)}</span></div>
                  <div>Evidence: <span className="text-slate-200">{item.evidence || "Not available"}</span></div>
                </div>
                {item.validationMessages.length ? <div className="mt-3 text-amber-100">Reason: {item.validationMessages.join("; ")}</div> : null}
                <div className="mt-3 text-xs text-slate-500">Files: {item.filePaths.join(", ") || "No file references"}</div>
                <div className="mt-2 text-xs text-cyan-100">{item.safetyNote}</div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
function StickyApprovalSummary({ summary, previewLoading, stagingLoading, candidateApplyLoading, onPreview, onSave, onPreviewStaging, onStageApproved, onPreviewCandidateApply, hasUnsavedChanges, saveStatus, stagingStatus, candidateApplyStatus }: { summary: { approvedFields: number; rejectedFields: number; manualReviewFields: number; readyForApplyPreview: number }; previewLoading: boolean; stagingLoading: boolean; candidateApplyLoading: boolean; onPreview: () => void; onSave: () => void; onPreviewStaging: () => void; onStageApproved: () => void; onPreviewCandidateApply: () => void; hasUnsavedChanges: boolean; saveStatus: string; stagingStatus: string; candidateApplyStatus: string }) {
  const items = [
    ["Approved fields", summary.approvedFields],
    ["Rejected fields", summary.rejectedFields],
    ["Manual review fields", summary.manualReviewFields],
    ["Ready for apply preview", summary.readyForApplyPreview],
  ];
  return (
    <div className="sticky top-0 z-20 mt-5 border border-slate-800 bg-[#080B10]/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {items.map(([label, value]) => (
          <div key={String(label)} className="min-w-36 border border-slate-800 bg-[#05070A] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
            <div className="text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasUnsavedChanges ? <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Unsaved changes</span> : null}
          {saveStatus ? <span className="max-w-sm text-xs text-slate-300">{saveStatus}</span> : null}
          {stagingStatus ? <span className="max-w-sm text-xs text-amber-100">{stagingStatus}</span> : null}
          {candidateApplyStatus ? <span className="max-w-sm text-xs text-cyan-100">{candidateApplyStatus}</span> : null}
          <button onClick={onSave} className="rounded-md border border-slate-600 px-4 py-3 text-sm font-bold text-slate-100 hover:border-cyan-400 hover:text-cyan-100">Save review decisions</button>
          <button onClick={onPreview} disabled={previewLoading} className="rounded-md bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            {previewLoading ? "Building preview..." : "Generate apply preview"}
          </button>
          <button onClick={onPreviewStaging} disabled={stagingLoading} className="rounded-md border border-emerald-500/40 px-4 py-3 text-sm font-bold text-emerald-100 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">Preview staging</button>
          <button onClick={onStageApproved} disabled={stagingLoading} title="This only saves to staging. It will not update Talent Search." className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100 hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50">Stage approved changes</button>
          <button onClick={onPreviewCandidateApply} disabled={candidateApplyLoading} className="rounded-md border border-cyan-500/40 px-4 py-3 text-sm font-bold text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{candidateApplyLoading ? "Checking candidates..." : "Preview candidate updates"}</button>
          <button disabled title="Real candidate updates are disabled in v1" className="rounded-md border border-slate-800 px-4 py-3 text-sm font-bold text-slate-500">Real DB apply disabled in v1</button>
        </div>
      </div>
    </div>
  );
}

function CandidateList({ candidates, selectedId, onSelect }: { candidates: WorkspaceCandidate[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-hidden border border-slate-800 bg-[#0B0F16]">
      <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">{candidates.length} candidates</div>
      <div className="max-h-[calc(100vh-190px)] divide-y divide-slate-800 overflow-auto">
        {candidates.map((candidate) => (
          <button key={candidate.candidateId} onClick={() => onSelect(candidate.candidateId)} className={`block w-full px-4 py-4 text-left hover:bg-slate-900/70 ${selectedId === candidate.candidateId ? "bg-slate-900" : "bg-[#070A0F]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{candidate.candidateName}</div>
                <div className="mt-1 text-xs text-slate-500">{candidate.currentScore} score - {candidate.searchReadyBefore ? "Search-ready now" : "Not search-ready yet"}</div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(candidate)}`}>{candidate.aiStatus}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-emerald-100">{candidate.safeCount} Safe</span>
              <span className="border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-amber-100">{candidate.riskyCount} Review</span>
              <span className="border border-red-500/20 bg-red-500/5 px-2 py-1 text-red-100">{candidate.rejectedCount} Rejected</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">{candidate.recommendedAction}</div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{candidate.missingBlockers.length ? candidate.missingBlockers.join(", ") : "No blocker listed"}</div>
          </button>
        ))}
        {!candidates.length ? <div className="p-5 text-sm text-slate-400">No candidates match this filter.</div> : null}
      </div>
    </div>
  );
}

function CandidateDetail({
  candidate,
  approvals,
  fieldView,
  setFieldView,
  overrideReasons,
  setOverrideReasons,
  setFieldApproval,
  setHasUnsavedChanges,
  setSaveStatus,
  preview,
  stagingPreview,
  candidateApplyPreview,
}: {
  candidate: WorkspaceCandidate;
  approvals: ApprovalState;
  fieldView: FieldViewMode;
  setFieldView: (view: FieldViewMode) => void;
  overrideReasons: Record<string, string>;
  setOverrideReasons: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveStatus: (value: string) => void;
  preview: ApplyPreview | null;
  stagingPreview: StagingPreview | null;
  candidateApplyPreview: CandidateApplyPreview | null;
}) {
  const fields = filterFieldsForView(candidate.fields, fieldView);
  return (
    <div className="border border-slate-800 bg-[#0B0F16]">
      <div className="sticky top-24 z-10 border-b border-slate-800 bg-[#0B0F16]/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{candidate.candidateName}</h2>
            <p className="mt-1 text-sm text-slate-400">{candidate.recommendedAction} - {candidate.searchReadyAfterManualApprovals ? "Ready after approval" : "Still blocked"}</p>
          </div>
          <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusTone(candidate)}`}>{candidate.recommendedAction}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FIELD_VIEWS.map((view) => (
            <button key={view.key} onClick={() => setFieldView(view.key)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${fieldView === view.key ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-[#070A0F] text-slate-300 hover:border-slate-500"}`}>
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-auto p-4">
        {fields.map((field) => (
          <FieldReviewCard
            key={approvalKey(candidate.candidateId, field.field)}
            candidate={candidate}
            field={field}
            approval={approvals[approvalKey(candidate.candidateId, field.field)]?.action || "pending"}
            overrideReason={overrideReasons[approvalKey(candidate.candidateId, field.field)] || ""}
            setOverrideReason={(value) => {
              setOverrideReasons((current) => ({ ...current, [approvalKey(candidate.candidateId, field.field)]: value }));
              setHasUnsavedChanges(true);
              setSaveStatus("");
            }}
            setFieldApproval={setFieldApproval}
          />
        ))}
        {!fields.length ? <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No fields match this view.</div> : null}
        <StagingPreviewPanel preview={stagingPreview} />
        <CandidateApplyPreviewPanel preview={candidateApplyPreview} />
        <ApplyPreviewPanel preview={preview} />
        <details className="border border-slate-800 bg-[#070A0F] p-4 text-sm text-slate-400">
          <summary className="cursor-pointer font-semibold text-slate-200">Debug details</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(candidate.debug, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

function FieldReviewCard({
  candidate,
  field,
  approval,
  overrideReason,
  setOverrideReason,
  setFieldApproval,
}: {
  candidate: WorkspaceCandidate;
  field: WorkspaceField;
  approval: FieldApprovalAction;
  overrideReason: string;
  setOverrideReason: (value: string) => void;
  setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void;
}) {
  const disabledReason = getApprovalDisabledReason(field, overrideReason);
  const approveDisabled = !field.canApprove || (field.requiresOverride && !overrideReason.trim());
  const quiet = !field.aiValue && !field.evidence && field.decision === "missing_evidence";
  return (
    <article className={`border p-4 ${quiet ? "border-slate-800 bg-[#070A0F]/60 opacity-75" : "border-slate-700 bg-[#070A0F]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{field.label}</h3>
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${TONE[field.statusTone]}`}>{field.statusLabel}</span>
            <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">Confidence {field.confidence}</span>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Current value</div>
              <div className="mt-1 text-sm text-slate-200">{empty(field.existingValue)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">AI Suggestion</div>
              <div className="mt-1 text-sm font-semibold text-cyan-100">{empty(field.aiValue)}</div>
            </div>
          </div>
        </div>
        <DecisionControls candidate={candidate} field={field} approval={approval} approveDisabled={approveDisabled} disabledReason={disabledReason} setFieldApproval={setFieldApproval} />
      </div>
      <div className="mt-3 text-sm text-slate-400">
        <span className="font-semibold text-slate-300">Evidence from CV:</span> {empty(field.evidence)}
      </div>
      {disabledReason ? <div className="mt-2 text-xs font-semibold text-amber-200">Approval blocked: {disabledReason}</div> : null}
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer text-slate-400">Parser result and reason</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>Parser Result: <span className="text-slate-300">{empty(field.parserValue)}</span></div>
          <div>Reason: <span className="text-slate-300">{field.reason || "No reason listed"}</span></div>
        </div>
      </details>
      {field.requiresOverride ? (
        <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Manual override reason required before local approval" className="mt-3 min-h-16 w-full rounded-md border border-amber-500/30 bg-[#05070A] p-2 text-xs text-slate-100 outline-none focus:border-amber-400" />
      ) : null}
    </article>
  );
}

function DecisionControls({ candidate, field, approval, approveDisabled, disabledReason, setFieldApproval }: { candidate: WorkspaceCandidate; field: WorkspaceField; approval: FieldApprovalAction; approveDisabled: boolean; disabledReason: string; setFieldApproval: (candidateId: string, field: WorkspaceField, action: FieldApprovalAction) => void }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:w-[310px]">
      <button title={disabledReason || "Approve suggestion"} onClick={() => setFieldApproval(candidate.candidateId, field, "approve")} disabled={approveDisabled} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "approve" ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-slate-700 text-slate-300 hover:border-emerald-500"} disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600`}>
        Approve suggestion
      </button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "reject")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "reject" ? "border-red-400 bg-red-500/15 text-red-100" : "border-slate-700 text-slate-300 hover:border-red-500"}`}>Reject suggestion</button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "keep")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "keep" ? "border-slate-400 bg-slate-500/15 text-slate-100" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>Keep current value</button>
      <button onClick={() => setFieldApproval(candidate.candidateId, field, "manual_review")} className={`rounded-md border px-2 py-2 text-xs font-semibold ${approval === "manual_review" ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-slate-700 text-slate-300 hover:border-amber-500"}`}>Mark for review</button>
    </div>
  );
}

function StagingPreviewPanel({ preview }: { preview: StagingPreview | null }) {
  if (!preview) return <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No staging preview yet. This only saves to staging. It will not update Talent Search.</div>;
  const cards = [
    ["Ready to stage", preview.stagedSafeCount],
    ["Manual review", preview.manualReviewCount],
    ["Rejected", preview.rejectedStagingItems],
    ["Blocked candidates", preview.blockedCandidates],
  ];
  return (
    <section className="border border-slate-800 bg-[#070A0F]">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Staging preview</h2>
        <p className="mt-1 text-sm text-amber-100">This only saves to staging. It will not update Talent Search.</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-4 pt-0">
        {preview.items.slice(0, 20).map((item) => (
          <div key={item.stagingId} className="grid gap-2 border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300 md:grid-cols-[1fr_1fr_1fr_1fr]">
            <div><span className="text-slate-500">Candidate:</span> {item.candidateName || item.candidateId}</div>
            <div><span className="text-slate-500">Field:</span> {item.fieldName}</div>
            <div><span className="text-slate-500">After:</span> <span className="font-semibold text-emerald-100">{empty(item.approvedValue)}</span></div>
            <div><span className="text-slate-500">Status:</span> {(preview.existingStagedIds || []).includes(item.stagingId) ? "staged" : item.applyReadiness === "blocked" ? "blocked" : "not staged"}</div>
          </div>
        ))}
        {preview.rejectedItems.slice(0, 10).map((item) => (
          <div key={`${item.sourceApprovalId}-rejected`} className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {item.candidateId} / {item.fieldName}: {item.validationReasons.join("; ")}
          </div>
        ))}
        {!preview.items.length && !preview.rejectedItems.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No approvals are ready for staging.</div> : null}
      </div>
    </section>
  );
}
function CandidateApplyPreviewPanel({ preview }: { preview: CandidateApplyPreview | null }) {
  if (!preview) return <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No candidate update preview yet. Real DB apply is disabled in v1.</div>;
  const cards = [
    ["Staged fields", preview.stagedItemsLoaded],
    ["Eligible fields", preview.fieldsEligibleForApply],
    ["Blocked fields", preview.fieldsBlocked],
    ["Conflicts", preview.conflictsDetected],
    ["Backup needed", preview.backupRequired ? "Yes" : "No"],
    ["Rollback ready", preview.rollbackReady ? "Yes" : "No"],
  ];
  return (
    <section className="border border-cyan-500/20 bg-[#070A0F]">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Candidate Apply Preview</h2>
            <p className="mt-1 text-sm text-cyan-100">Dry-run only. This compares staged changes with current Talent Search data and does not update candidates.</p>
          </div>
          <span className="rounded-md border border-slate-700 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Real DB apply disabled in v1</span>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{String(value)}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-4 pt-0">
        {preview.eligibleItems.slice(0, 20).map((item) => (
          <div key={`${item.stagingId}-eligible`} className="grid gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-slate-300 md:grid-cols-[1fr_1fr_1fr_1fr]">
            <div><span className="text-slate-500">Candidate:</span> {item.candidateName || item.candidateId}</div>
            <div><span className="text-slate-500">Field:</span> {item.fieldName}</div>
            <div><span className="text-slate-500">Current:</span> {String(item.currentDbValue ?? "Not available")}</div>
            <div><span className="text-slate-500">Would update to:</span> <span className="font-semibold text-emerald-100">{empty(item.approvedValue)}</span></div>
          </div>
        ))}
        {preview.blockedItems.slice(0, 20).map((item) => (
          <div key={`${item.stagingId}-blocked`} className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="font-semibold">{item.candidateName || item.candidateId} / {item.fieldName}</div>
            <div className="mt-1 text-xs text-amber-100/80">{item.reasons.join("; ") || "Blocked for review"}</div>
          </div>
        ))}
        {!preview.eligibleItems.length && !preview.blockedItems.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No staged fields are ready for candidate update preview.</div> : null}
      </div>
    </section>
  );
}

function ApplyPreviewPanel({ preview }: { preview: ApplyPreview | null }) {
  if (!preview) return <div className="border border-slate-800 bg-[#070A0F] p-5 text-sm text-slate-400">No dry-run preview yet.</div>;
  return (
    <section className="border border-slate-800 bg-[#070A0F]">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Apply preview</h2>
        <p className="mt-1 text-sm text-slate-400">Only locally approved safe changes are shown. Current Talent Search data stays unchanged.</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Approved fields", preview.approvedFieldsCount],
          ["Candidates ready", preview.candidatesReadyForApply],
          ["Need review", preview.candidatesStillRequiringManualReview],
          ["Rejected fields", preview.rejectedFields],
          ["Current values kept", preview.existingFieldsPreserved],
          ["Unsafe changes prevented", preview.unsafeDowngradePrevented],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-slate-800 bg-[#05070A] p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      {preview.warnings.length ? <div className="mx-4 mb-4 border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{preview.warnings.slice(0, 6).join(" ")}</div> : null}
      <div className="space-y-2 p-4 pt-0">
        {preview.changes.map((change) => (
          <div key={`${change.candidateId}-${change.field}`} className="grid gap-2 border border-slate-800 bg-[#05070A] p-3 text-sm text-slate-300 md:grid-cols-[1fr_1fr_1fr_1fr]">
            <div><span className="text-slate-500">Field:</span> {change.label}</div>
            <div><span className="text-slate-500">Before:</span> {empty(change.beforeValue)}</div>
            <div><span className="text-slate-500">After:</span> <span className="font-semibold text-cyan-100">{empty(change.afterValue)}</span></div>
            <div><span className="text-slate-500">Status:</span> {change.approvalStatus}</div>
          </div>
        ))}
        {!preview.changes.length ? <div className="border border-slate-800 p-4 text-sm text-slate-400">No approved safe changes are ready in this preview.</div> : null}
      </div>
    </section>
  );
}









