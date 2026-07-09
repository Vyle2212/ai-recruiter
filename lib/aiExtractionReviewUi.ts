import fs from "node:fs";
import path from "node:path";

export type FieldApprovalAction = "pending" | "approve" | "reject" | "keep" | "manual_review";
export type ReviewFilter =
  | "all"
  | "safe"
  | "risky"
  | "manual_review"
  | "reupload_required"
  | "still_blocked"
  | "search_ready_after_approval"
  | "missing_ai"
  | "module_conflict"
  | "employer_issue"
  | "title_issue"
  | "identity_issue";

export type ApprovalState = Record<string, { action: FieldApprovalAction; overrideReason?: string }>;

export type WorkspaceField = {
  field: string;
  label: string;
  existingValue: string;
  parserValue: string;
  aiValue: string;
  confidence: number;
  evidence: string;
  decision: string;
  reason: string;
  statusLabel: string;
  statusTone: "safe" | "review" | "rejected" | "keep" | "reupload" | "missing";
  canApprove: boolean;
  requiresOverride: boolean;
  warning: string;
};

export type WorkspaceCandidate = {
  candidateId: string;
  candidateName: string;
  currentScore: number;
  searchReadyBefore: boolean;
  searchReadyAfterManualApprovals: boolean;
  decisionAction: string;
  safeCount: number;
  riskyCount: number;
  rejectedCount: number;
  missingBlockers: string[];
  aiStatus: string;
  recommendedAction: string;
  stillBlocked: boolean;
  reuploadRequired: boolean;
  fields: WorkspaceField[];
  debug: Record<string, any>;
};

export type ReviewWorkspace = {
  mode: string;
  exportedAt: string;
  reportStatus: {
    reviewReportFound: boolean;
    applyPlanFound: boolean;
    aiResultsFound: boolean;
    staleCache: boolean;
    errors: string[];
  };
  summary: {
    totalQueued: number;
    aiResultsAvailable: number;
    safeFieldSuggestions: number;
    riskySuggestions: number;
    rejectedSuggestions: number;
    manualReviewRequired: number;
    potentialSearchReadyAfterApproval: number;
    reuploadRequired: number;
    missingAiResult: number;
  };
  candidates: WorkspaceCandidate[];
  applyPlan: any;
};

export type ApplyPreview = {
  mode: string;
  approvedFieldsCount: number;
  candidatesReadyForApply: number;
  candidatesStillRequiringManualReview: number;
  rejectedFields: number;
  existingFieldsPreserved: number;
  unsafeDowngradePrevented: number;
  changes: Array<{
    candidateId: string;
    field: string;
    label: string;
    beforeValue: string;
    afterValue: string;
    evidence: string;
    riskLevel: string;
    approvalStatus: string;
  }>;
  preserved: Array<{ candidateId: string; field: string; label: string; reason: string }>;
  warnings: string[];
};

const FIELD_LABELS: Record<string, string> = {
  displayName: "Full name",
  email: "Email",
  phone: "Phone",
  title: "Current title",
  currentCompany: "Current employer",
  previousCompany: "Previous employer",
  locationCountry: "Location",
  primarySapModule: "Primary SAP module",
  sapModules: "SAP modules",
  sapSkills: "SAP skills",
  salary: "Salary",
  noticePeriod: "Notice period",
};

export const REVIEW_FIELDS = Object.keys(FIELD_LABELS);

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJsonIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return { found: false, data: null, error: "" };
  try {
    return { found: true, data: JSON.parse(fs.readFileSync(filePath, "utf8")), error: "" };
  } catch (error) {
    return { found: true, data: null, error: error instanceof Error ? error.message : "Malformed report file" };
  }
}

export function loadAiExtractionReviewReports(baseDir = process.cwd()): ReviewWorkspace {
  const reportsDir = path.join(baseDir, "reports");
  const review = readJsonIfExists(path.join(reportsDir, "ai-extraction-review.json"));
  const applyPlan = readJsonIfExists(path.join(reportsDir, "ai-extraction-apply-plan.json"));
  const aiResults = readJsonIfExists(path.join(reportsDir, "background-ai-extraction-results.json"));
  return buildReviewWorkspace(review.data, applyPlan.data, aiResults.data, {
    reviewReportFound: review.found,
    applyPlanFound: applyPlan.found,
    aiResultsFound: aiResults.found,
    errors: [review.error, applyPlan.error, aiResults.error].filter(Boolean),
  });
}

export function buildReviewWorkspace(
  reviewReport: any,
  applyPlanReport: any = null,
  aiResultsReport: any = null,
  status: { reviewReportFound?: boolean; applyPlanFound?: boolean; aiResultsFound?: boolean; errors?: string[] } = {},
): ReviewWorkspace {
  const candidates: WorkspaceCandidate[] = Array.isArray(reviewReport?.fieldComparisons) ? reviewReport.fieldComparisons.map((item: any) => mapCandidate(item, reviewReport)) : [];
  const exportedAt = clean(reviewReport?.exportedAt || applyPlanReport?.exportedAt || aiResultsReport?.exportedAt);
  const exportedTime = exportedAt ? Date.parse(exportedAt) : 0;
  const staleCache = Boolean(exportedTime && Date.now() - exportedTime > 1000 * 60 * 60 * 24);
  const summary = reviewReport?.summary || {};
  return {
    mode: "Read-only review workspace. No DB writes, no apply, no delete, no OpenAI calls.",
    exportedAt,
    reportStatus: {
      reviewReportFound: Boolean(status.reviewReportFound),
      applyPlanFound: Boolean(status.applyPlanFound),
      aiResultsFound: Boolean(status.aiResultsFound),
      staleCache,
      errors: status.errors || [],
    },
    summary: {
      totalQueued: Number(summary.totalQueued || candidates.length || 0),
      aiResultsAvailable: Number(summary.aiExtractionAvailable || 0),
      safeFieldSuggestions: Number(summary.fieldsSafeToAccept || 0),
      riskySuggestions: Number(summary.fieldsRisky || 0),
      rejectedSuggestions: Number(summary.fieldsRejected || 0),
      manualReviewRequired: Number(summary.candidatesRequiringManualReview || 0),
      potentialSearchReadyAfterApproval: Number(summary.searchReadyAfterManualApprovals || 0),
      reuploadRequired: candidates.filter((item) => item.reuploadRequired).length,
      missingAiResult: Number(summary.aiExtractionMissing || candidates.filter((item) => item.aiStatus === "AI Missing").length),
    },
    candidates,
    applyPlan: applyPlanReport || null,
  };
}

function mapCandidate(item: any, reviewReport: any): WorkspaceCandidate {
  const queueItem = (reviewReport?.queueItems || []).find((queue: any) => clean(queue.candidateId) === clean(item.candidateId)) || {};
  const comparisonByField = new Map((item.fieldComparisons || []).map((field: any) => [field.field, field]));
  const parserFields = queueItem.parserExtractedFields || {};
  const fields = REVIEW_FIELDS.map((field) => mapField(field, comparisonByField.get(field), parserFields));
  const missingBlockers = [
    ...(item.existingScore?.missingFields || []),
    ...(item.parserScore?.missingFields || []),
    ...(queueItem.conflicts || []),
  ].map(clean).filter(Boolean);
  const reuploadRequired = /reupload|original_file/i.test(clean(queueItem.reasonForAiQueue) + " " + missingBlockers.join(" "));
  const candidateName = clean(queueItem.existingName) || clean(fields.find((field) => field.field === "displayName")?.existingValue) || clean(fields.find((field) => field.field === "displayName")?.parserValue) || clean(item.candidateId);
  return {
    candidateId: clean(item.candidateId),
    candidateName,
    currentScore: Number(item.existingScore?.score || 0),
    searchReadyBefore: Boolean(item.searchReadyBefore),
    searchReadyAfterManualApprovals: Boolean(item.searchReadyAfterManualApprovals),
    decisionAction: clean(queueItem.reasonForAiQueue || (item.manualReviewRequired ? "requires_manual_review" : "keep_existing_record")),
    safeCount: Number(item.safeChanges?.length || 0),
    riskyCount: Number(item.riskyChanges?.length || 0),
    rejectedCount: Number(item.rejectedChanges?.length || 0),
    missingBlockers,
    aiStatus: item.aiAvailable ? "AI result available" : "AI Missing",
    recommendedAction: recommendedAction(item, reuploadRequired),
    stillBlocked: Boolean(item.stillBlocked),
    reuploadRequired,
    fields,
    debug: { queueItem, existingScore: item.existingScore, parserScore: item.parserScore },
  };
}

function mapField(field: string, source: any, parserFields: any): WorkspaceField {
  const fallbackParser = field === "currentCompany" ? parserFields.currentCompany : parserFields[field];
  const mapped = {
    field,
    label: FIELD_LABELS[field] || field,
    existingValue: clean(source?.existingValue),
    parserValue: clean(source?.parserValue || fallbackParser),
    aiValue: clean(source?.aiValue),
    confidence: Number(source?.confidence || 0),
    evidence: clean(source?.evidence),
    decision: clean(source?.decision || "missing_evidence"),
    reason: clean(source?.reason || "field_not_available_in_report"),
  };
  const guard = approvalGuard(mapped);
  return { ...mapped, ...statusForDecision(mapped.decision), ...guard };
}

function statusForDecision(decision: string) {
  if (decision === "safe_accept") return { statusLabel: "Safe to accept", statusTone: "safe" as const };
  if (decision === "reject") return { statusLabel: "Rejected", statusTone: "rejected" as const };
  if (decision === "keep_existing") return { statusLabel: "Keep existing", statusTone: "keep" as const };
  if (decision === "missing_evidence") return { statusLabel: "Missing evidence", statusTone: "missing" as const };
  if (decision === "conflict") return { statusLabel: "Conflict detected", statusTone: "review" as const };
  return { statusLabel: "Needs review", statusTone: "review" as const };
}

export function approvalGuard(field: Pick<WorkspaceField, "decision" | "evidence" | "confidence" | "existingValue" | "aiValue" | "field" | "reason">) {
  const reasonText = clean(field.reason);
  if (field.decision === "reject") return { canApprove: false, requiresOverride: true, warning: "This suggestion was rejected and needs a manual override reason." };
  if (!clean(field.evidence) && field.field !== "primarySapModule") return { canApprove: false, requiresOverride: true, warning: "No CV evidence is available for this suggestion." };
  if (field.decision === "conflict") return { canApprove: false, requiresOverride: true, warning: "This suggestion conflicts with another part of the CV." };
  if (clean(field.existingValue) && clean(field.aiValue) && clean(field.existingValue).toLowerCase() !== clean(field.aiValue).toLowerCase() && Number(field.confidence) < 90) {
    return { canApprove: false, requiresOverride: true, warning: "This would replace an existing value with a lower-confidence suggestion." };
  }
  if (/dirty_or_invalid_identity|generic_or_invalid_title|dirty_or_invalid_employer|module_conflicts/i.test(reasonText)) {
    return { canApprove: false, requiresOverride: true, warning: "This suggestion was flagged as unsafe." };
  }
  return { canApprove: field.decision === "safe_accept", requiresOverride: false, warning: "" };
}

function recommendedAction(item: any, reuploadRequired: boolean) {
  if (reuploadRequired) return "Reupload original CV";
  if (!item.aiAvailable) return "Needs manual review";
  if (item.safeApplyCandidate) return "Ready for safe apply later";
  if (item.manualReviewRequired) return "Review AI suggestions";
  return "Keep existing";
}

export function filterCandidates(candidates: WorkspaceCandidate[], filter: ReviewFilter) {
  if (filter === "all") return candidates;
  return candidates.filter((candidate) => {
    if (filter === "safe") return candidate.safeCount > 0;
    if (filter === "risky") return candidate.riskyCount > 0;
    if (filter === "manual_review") return candidate.recommendedAction === "Review AI suggestions" || candidate.riskyCount > 0 || candidate.rejectedCount > 0;
    if (filter === "reupload_required") return candidate.reuploadRequired;
    if (filter === "still_blocked") return candidate.stillBlocked;
    if (filter === "search_ready_after_approval") return candidate.searchReadyAfterManualApprovals;
    if (filter === "missing_ai") return candidate.aiStatus === "AI Missing";
    if (filter === "module_conflict") return candidate.fields.some((field) => field.field.includes("Module") || field.reason.includes("module_conflicts"));
    if (filter === "employer_issue") return candidate.fields.some((field) => /Company|employer/i.test(field.field) && /invalid|dirty|review|missing|not_disclosed/i.test(field.reason));
    if (filter === "title_issue") return candidate.fields.some((field) => field.field === "title" && /invalid|generic|missing|review/i.test(field.reason));
    if (filter === "identity_issue") return candidate.fields.some((field) => field.field === "displayName" && /identity|name|missing|invalid|dirty/i.test(field.reason));
    return true;
  });
}

export function updateApprovalState(state: ApprovalState, candidateId: string, field: string, action: FieldApprovalAction, overrideReason = ""): ApprovalState {
  return { ...state, [`${candidateId}:${field}`]: { action, overrideReason } };
}

export function generateApplyPreview(workspace: ReviewWorkspace, approvals: ApprovalState): ApplyPreview {
  const changes: ApplyPreview["changes"] = [];
  const preserved: ApplyPreview["preserved"] = [];
  const warnings: string[] = [];
  let rejectedFields = 0;
  let unsafeDowngradePrevented = Number(workspace.applyPlan?.summary?.unsafeDowngradePrevented || 0);

  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) {
      const approval = approvals[`${candidate.candidateId}:${field.field}`];
      if (approval?.action === "reject") rejectedFields += 1;
      if (approval?.action === "approve" && field.canApprove && field.decision === "safe_accept") {
        changes.push({
          candidateId: candidate.candidateId,
          field: field.field,
          label: field.label,
          beforeValue: field.existingValue,
          afterValue: field.aiValue,
          evidence: field.evidence,
          riskLevel: "Safe",
          approvalStatus: "Approved locally",
        });
      } else {
        const blockedApproval = approval?.action === "approve" && !field.canApprove;
        if (blockedApproval) {
          unsafeDowngradePrevented += 1;
          warnings.push(`${candidate.candidateName}: ${field.label} was not included because ${field.warning || "it needs review first"}`);
        }
        preserved.push({
          candidateId: candidate.candidateId,
          field: field.field,
          label: field.label,
          reason: approval?.action === "keep" ? "Keep current value" : blockedApproval ? "Approval blocked by safety guardrail" : field.statusLabel,
        });
      }
    }
  }

  const candidatesReady = new Set(changes.map((change) => change.candidateId));
  return {
    mode: "Dry-run preview only. No DB writes, no apply, no delete.",
    approvedFieldsCount: changes.length,
    candidatesReadyForApply: candidatesReady.size,
    candidatesStillRequiringManualReview: workspace.candidates.filter((candidate) => candidate.riskyCount > 0 || candidate.rejectedCount > 0 || candidate.stillBlocked).length,
    rejectedFields,
    existingFieldsPreserved: preserved.length,
    unsafeDowngradePrevented,
    changes,
    preserved,
    warnings,
  };
}


export type FieldViewMode = "suggested" | "all" | "risk";

export function fieldHasSuggestion(field: WorkspaceField) {
  return Boolean(clean(field.aiValue) || field.decision === "safe_accept" || field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict");
}

export function fieldNeedsDecision(field: WorkspaceField) {
  return field.decision === "safe_accept" || field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict";
}

export function sortFieldsForReview(fields: WorkspaceField[]) {
  const rank = (field: WorkspaceField) => {
    if (field.decision === "reject") return 0;
    if (field.decision === "conflict" || field.decision === "risky_needs_review") return 1;
    if (field.decision === "safe_accept") return 2;
    if (fieldHasSuggestion(field)) return 3;
    if (field.evidence) return 4;
    return 5;
  };
  return [...fields].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

export function filterFieldsForView(fields: WorkspaceField[], mode: FieldViewMode) {
  const sorted = sortFieldsForReview(fields);
  if (mode === "all") return sorted;
  if (mode === "risk") return sorted.filter((field) => field.decision === "risky_needs_review" || field.decision === "reject" || field.decision === "conflict");
  const suggested = sorted.filter(fieldHasSuggestion);
  return suggested.length ? suggested : sorted.filter((field) => field.evidence || field.existingValue || field.parserValue).slice(0, 4);
}

export function getApprovalDisabledReason(field: WorkspaceField, overrideReason = "") {
  if (field.canApprove) return "";
  if (field.decision === "conflict") return "Conflict detected";
  if (!clean(field.evidence) && field.field !== "primarySapModule") return "No CV evidence";
  if (field.decision === "reject") return overrideReason.trim() ? "Rejected suggestion stays out of preview" : "Manual override reason required";
  if (clean(field.existingValue) && clean(field.aiValue) && clean(field.existingValue).toLowerCase() !== clean(field.aiValue).toLowerCase() && Number(field.confidence) < 90) return "Lower confidence than current data";
  if (field.requiresOverride && !overrideReason.trim()) return "Manual override reason required";
  return field.warning || "Needs review first";
}

export function buildLocalApprovalSummary(workspace: ReviewWorkspace, approvals: ApprovalState) {
  let approvedFields = 0;
  let rejectedFields = 0;
  let manualReviewFields = 0;
  const readyCandidateIds = new Set<string>();
  for (const candidate of workspace.candidates) {
    for (const field of candidate.fields) {
      const approval = approvals[`${candidate.candidateId}:${field.field}`];
      if (approval?.action === "approve" && field.canApprove && field.decision === "safe_accept") {
        approvedFields += 1;
        readyCandidateIds.add(candidate.candidateId);
      }
      if (approval?.action === "reject") rejectedFields += 1;
      if (approval?.action === "manual_review") manualReviewFields += 1;
    }
  }
  return { approvedFields, rejectedFields, manualReviewFields, readyForApplyPreview: readyCandidateIds.size };
}
