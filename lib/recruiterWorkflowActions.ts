import { actionForStatus } from "./recruiterWorkflowRules";
import { buildCanonicalCandidateProfile } from "./canonicalCandidateProfile";
import type { RecruiterActionQueueItem, RecruiterWorkflowActionType, RecruiterWorkflowState, WorkflowActionDecision, WorkflowPriority } from "./recruiterWorkflowTypes";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function currentTitle(candidate: Record<string, any>) {
  return clean(candidate.current_title || candidate.title || candidate.currentTitle);
}

function currentCompany(candidate: Record<string, any>) {
  const profile = buildCanonicalCandidateProfile(candidate);
  return clean(profile.currentCompany);
}

function primaryModule(candidate: Record<string, any>) {
  return clean(candidate.primary_module || candidate.primarySapModule || candidate.module);
}

function flags(candidate: Record<string, any>, state: RecruiterWorkflowState) {
  return clean([candidate.extraction_decision_action, candidate.review_action, candidate.status_reason, candidate.validation_flags, candidate.duplicate_status, ...state.validationBlockers].join(" "));
}

export function priorityForState(state: RecruiterWorkflowState): WorkflowPriority {
  if (state.missingData.some((item) => ["identity", "currentCompany", "title"].includes(item)) || state.validationBlockers.length || state.status === "ready_for_shortlist") return "high";
  if (state.status === "ai_review_needed" || state.missingData.length) return "medium";
  return "low";
}

export function buildActionQueue(states: RecruiterWorkflowState[]): RecruiterActionQueueItem[] {
  return states
    .filter((state) => !["placed", "rejected", "archived"].includes(state.status))
    .map((state) => ({
      actionId: `${state.candidateId}:${actionForStatus(state.status)}`,
      candidateId: state.candidateId,
      candidateName: state.candidateName,
      currentStatus: state.status,
      recommendedNextAction: actionForStatus(state.status),
      reason: state.reasons[0] || "Review candidate workflow status",
      priority: priorityForState(state),
      missingData: state.missingData,
      lastUpdated: state.lastUpdated,
      safetyNote: "Dry-run workflow action only. Candidate records are not updated.",
    }));
}

export function evaluateWorkflowAction(candidate: Record<string, any>, state: RecruiterWorkflowState, action: RecruiterWorkflowActionType): WorkflowActionDecision {
  const reasons: string[] = [];
  const profile = buildCanonicalCandidateProfile(candidate);
  const flagText = flags(candidate, state);
  if (["archived", "rejected"].includes(state.status) && !["mark_rejected", "archive_candidate"].includes(action)) reasons.push("Candidate is archived or rejected");
  if (action === "add_to_shortlist") {
    if (profile.identityReviewRequired) reasons.push("Identity must be validated first");
    if (/must.?repair|requires_original_file_reupload|reupload/i.test(flagText)) reasons.push("Candidate must be repaired before shortlist");
    if (/duplicate.*conflict|conflict.*duplicate/i.test(flagText)) reasons.push("Duplicate conflict unresolved");
    if (!currentTitle(candidate) || currentCompany(candidate) === "Not disclosed") reasons.push("Current title and employer are required");
    if (!profile.allowedForRanking) reasons.push("Profile quality below shortlist threshold");
  }
  if (action === "submit_to_client") {
    if (!["ready_for_shortlist", "shortlisted"].includes(state.status)) reasons.push("Candidate must be ready for shortlist or shortlisted first");
    if (profile.identityReviewRequired || state.validationBlockers.length) reasons.push("Profile is not validated");
    if (!currentTitle(candidate) || currentCompany(candidate) === "Not disclosed") reasons.push("Missing current employer or title");
    if (/sap/i.test(clean(candidate.raw_text || candidate.summary || candidate.skills || candidate.sapSkills)) && !primaryModule(candidate)) reasons.push("Primary SAP module required for SAP roles");
    if (/duplicate.*conflict|conflict.*duplicate/i.test(flagText)) reasons.push("Duplicate conflict unresolved");
    if (/requires_original_file_reupload|reupload/i.test(flagText)) reasons.push("Original CV reupload required");
  }
  if (action === "generate_submission") {
    if (!["ready_for_shortlist", "shortlisted"].includes(state.status)) reasons.push("Candidate must be ready for shortlist or shortlisted");
    if (!profile.allowedForExecutiveExport) reasons.push("Validated summary is not available");
    if (!clean(candidate.summary || candidate.raw_text || candidate.resume_text)) reasons.push("Submission evidence is missing");
    if (!primaryModule(candidate)) reasons.push("Key SAP/project details missing");
  }
  return { action, allowed: reasons.length === 0, reasons: reasons.length ? reasons : ["Action is available as a dry-run workflow preview"], previewOnly: true };
}
