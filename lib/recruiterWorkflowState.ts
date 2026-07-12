import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";
import type { CandidateAuditIssue } from "./candidateAudit";
import type { RecruiterWorkflowState, RecruiterWorkflowStatus } from "./recruiterWorkflowTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

export function workflowCandidateId(candidate: Record<string, any>) {
  return clean(candidate.id || candidate.candidate_id || candidate.email || candidate.phone || candidate.name || "unknown");
}

export function workflowCandidateName(candidate: Record<string, any>) {
  const profile = buildCanonicalCandidateProfile(candidate);
  return clean(profile.displayName || candidate.name || candidate.full_name || candidate.display_name || workflowCandidateId(candidate));
}

export function workflowMissingData(candidate: Record<string, any>) {
  const profile = buildCanonicalCandidateProfile(candidate);
  const missing: string[] = [];
  if (!profile.displayName || profile.identityReviewRequired) missing.push("identity");
  if (!profile.currentCompany || profile.currentCompany === "Not disclosed") missing.push("currentCompany");
  if (!clean(candidate.current_title || candidate.title || candidate.currentTitle)) missing.push("title");
  if (!clean(candidate.primary_module || candidate.primarySapModule || candidate.module)) missing.push("primarySapModule");
  return missing;
}

function issuesFor(candidateId: string, auditIssues: CandidateAuditIssue[] = []) {
  return auditIssues.filter((issue) => clean(issue.candidateId) === clean(candidateId));
}

function hasReviewItem(candidateId: string, reviewReport: any) {
  return (Array.isArray(reviewReport?.fieldComparisons) ? reviewReport.fieldComparisons : []).some((item: any) => clean(item.candidateId) === clean(candidateId) && (item.manualReviewRequired || item.aiAvailable));
}

function hasApplyVerified(candidateId: string, applyHistory: any) {
  return (Array.isArray(applyHistory?.items) ? applyHistory.items : []).some((item: any) => clean(item.candidateId) === clean(candidateId) && /applied_verified|preserved_already_applied/i.test(clean(item.status)));
}

function localStateFor(candidateId: string, localState: any) {
  return (Array.isArray(localState?.states) ? localState.states : []).find((item: any) => clean(item.candidateId) === clean(candidateId));
}

export function inferWorkflowStatus(candidate: Record<string, any>, context: { auditIssues?: CandidateAuditIssue[]; reviewReport?: any; applyHistory?: any; localState?: any } = {}): RecruiterWorkflowState {
  const candidateId = workflowCandidateId(candidate);
  const local = localStateFor(candidateId, context.localState);
  if (local?.status) return { ...local, source: "local_state" };
  const profile = buildCanonicalCandidateProfile(candidate);
  const missingData = workflowMissingData(candidate);
  const candidateIssues = issuesFor(candidateId, context.auditIssues || []);
  const validationBlockers = candidateIssues.filter((issue) => issue.exportBlocked || issue.severity === "critical" || /duplicate|invalid-name|missing-employer|fake-employer/i.test(issue.type)).map((issue) => `${issue.type}: ${issue.evidence}`);
  const reasonBlob = clean([candidate.extraction_decision_action, candidate.review_action, candidate.status_reason, candidate.validation_flags, candidate.duplicate_status].join(" "));
  const reasons: string[] = [];
  let status: RecruiterWorkflowStatus = "new_profile";
  if (/rejected/i.test(reasonBlob)) status = "rejected";
  else if (/archived/i.test(reasonBlob)) status = "archived";
  else if (/requires_original_file_reupload|reupload|must.?repair/i.test(reasonBlob)) status = "needs_repair";
  else if (/duplicate.*conflict|conflict.*duplicate/i.test(reasonBlob) || validationBlockers.some((item) => /duplicate/i.test(item))) status = "needs_validation";
  else if (profile.identityReviewRequired || validationBlockers.some((item) => /invalid-name|identity/i.test(item))) status = "needs_validation";
  else if (missingData.includes("currentCompany") || missingData.includes("title")) status = "needs_repair";
  else if (hasReviewItem(candidateId, context.reviewReport)) status = "ai_review_needed";
  else if (hasApplyVerified(candidateId, context.applyHistory) || (profile.allowedForRanking && profile.allowedForExecutiveExport)) status = "ready_for_shortlist";
  else if (profile.allowedForRanking) status = "validated";
  if (status === "needs_validation") reasons.push("Profile needs validation before recruiter workflow can continue");
  if (status === "needs_repair") reasons.push("Profile has missing or repair-required data");
  if (status === "ai_review_needed") reasons.push("AI extraction review is pending");
  if (status === "ready_for_shortlist") reasons.push("Profile is validated enough for shortlist review");
  if (!reasons.length) reasons.push("Workflow status inferred from current Talent Search data");
  return {
    workflowId: `workflow-${candidateId}`,
    candidateId,
    candidateName: workflowCandidateName(candidate),
    status,
    source: "inferred",
    reasons,
    missingData,
    validationBlockers,
    lastUpdated: new Date().toISOString(),
  };
}

export function buildWorkflowStates(candidates: Record<string, any>[], context: { auditIssues?: CandidateAuditIssue[]; reviewReport?: any; applyHistory?: any; localState?: any } = {}) {
  return candidates.map((candidate) => inferWorkflowStatus(candidate, context));
}
